"""After an API goes online: a quick, read-only test of the live address, from the outside.

It never changes data (only GET requests, plus one sign-in), so it is safe on the owner's real
database. It checks:
1. /health answers;
2. the API's list of addresses (/openapi.json) loads;
3. a signed-in-only address refuses a request with no sign-in (401/403);
4. signing in with the first login works and returns a token (when there is a first login);
5. every simple read address (GET, no {id} in the path) answers without a server error (5xx) or
   a timeout, signed in.
"""

import json
import time
import urllib.error
import urllib.request

LIMIT = 40  # read addresses tested at most
SKIP_WORDS = ("logout", "export", "download", "stream", "events", "sse", "ws")


def _call(method: str, url: str, body: dict | None = None, token: str | None = None, timeout: int = 25):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Accept", "application/json")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    started = time.time()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read(), time.time() - started
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(), time.time() - started
    except (urllib.error.URLError, OSError, TimeoutError) as exc:
        return 0, str(getattr(exc, "reason", exc)).encode(), time.time() - started


def _find_token(value) -> str | None:
    """The sign-in answer's token, wherever the API puts it ({"data": {"token": ...}}, {"access_token": ...})."""
    if isinstance(value, dict):
        for key in ("token", "access_token", "accessToken", "jwt"):
            if isinstance(value.get(key), str) and len(value[key]) > 20:
                return value[key]
        for inner in value.values():
            found = _find_token(inner)
            if found:
                return found
    return None


def _message(body: bytes) -> str:
    text = body.decode("utf-8", "replace").strip()
    try:
        data = json.loads(text)
        error = data.get("error") if isinstance(data, dict) else None
        text = (error.get("message") if isinstance(error, dict) else None) or data.get("detail") or text
    except (ValueError, AttributeError):
        pass
    return str(text)[:200]


def run(base: str, login: dict | None) -> dict:
    """{"passed", "total", "checks": [{"name", "ok", "status", "detail"}], "at"}"""
    base = base.rstrip("/")
    checks: list[dict] = []

    def check(name: str, ok: bool, status: int, detail: str = "") -> bool:
        checks.append({"name": name, "ok": ok, "status": status, "detail": detail})
        return ok

    status, body, _ = _call("GET", base + "/health")
    check("GET /health", status == 200, status, "" if status == 200 else _message(body))

    status, body, _ = _call("GET", base + "/openapi.json")
    spec = None
    if status == 200:
        try:
            spec = json.loads(body)
        except ValueError:
            pass
    check("GET /openapi.json (the list of addresses)", spec is not None, status,
          "" if spec else "The API's list of addresses didn't load")
    paths: dict = (spec or {}).get("paths") or {}

    def operation(method: str, words: tuple[str, ...]) -> str | None:
        for path, item in paths.items():
            if method in item and all(w in path.lower() for w in words) and "{" not in path:
                return path
        return None

    # Signed-in-only addresses refuse strangers.
    me = operation("get", ("auth", "me"))
    if me:
        status, body, _ = _call("GET", base + me)
        check(f"GET {me} without signing in is refused", status in (401, 403), status,
              "" if status in (401, 403) else "It answered without a sign-in")

    token = None
    login_path = operation("post", ("auth", "login")) or operation("post", ("login",))
    if login and login_path:
        status, body, _ = _call("POST", base + login_path, {"email": login["email"], "password": login["password"]})
        try:
            token = _find_token(json.loads(body))
        except ValueError:
            token = None
        check(f"POST {login_path} with your first login", status == 200 and bool(token), status,
              "" if token else _message(body))
        if token and me:
            status, body, _ = _call("GET", base + me, token=token)
            check(f"GET {me} signed in", status == 200, status, "" if status == 200 else _message(body))

    # Every simple read address, signed in: no server errors, no time-outs.
    tested = 0
    for path, item in sorted(paths.items()):
        if tested >= LIMIT:
            break
        if "get" not in item or "{" in path or path in ("/health", "/openapi.json", me) or path.startswith("/docs"):
            continue
        if any(word in path.lower() for word in SKIP_WORDS):
            continue
        tested += 1
        status, body, took = _call("GET", base + path, token=token)
        ok = 0 < status < 500
        # Without a sign-in (no first login), refusals are expected; with one, a refusal is noted only.
        check(f"GET {path}", ok, status,
              "" if ok else ("No answer: " + _message(body) if status == 0 else _message(body)))

    passed = sum(1 for c in checks if c["ok"])
    return {"passed": passed, "total": len(checks), "checks": checks, "signed_in": bool(token),
            "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
