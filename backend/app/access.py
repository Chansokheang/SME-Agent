"""Sign-in for Gagesite opened from the internet (compose profile "public", deploy/Caddyfile).

Gagesite itself has no accounts. When it is opened on a public port, Caddy asks this module before
every request (`/auth/check`): without a valid session cookie the browser is sent to a small
sign-in page that asks for the one shared password (GAGESITE_PASSWORD in .env). The cookie is
signed with a key derived from the password and the server's own secret, so changing the password
signs everyone out. Opened through the SSH tunnel (localhost), nothing here is involved.

Through Cloudflare quick tunnels (tunnel.py) Gagesite, its previews and the previews' APIs have three
different links, and a browser never shares cookies between them. A preview or API link without a
session goes to `/auth/handoff` on Gagesite's link: once signed in there, it gets a one-minute
ticket that `/__gagesite/enter` on that link turns into a session of its own.
"""
import hashlib
import hmac
import html
import time
from urllib.parse import quote, urlsplit

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response

from . import secrets_store, tunnel
from .config import settings

router = APIRouter()

COOKIE = "gagesite_session"
SESSION_DAYS = 30
TICKET_SECONDS = 60
# Wrong passwords per address before a pause, and how long the pause lasts.
MAX_FAILURES = 5
LOCK_SECONDS = 15 * 60
_failures: dict[str, list[float]] = {}


def _key() -> bytes:
    secret = b""
    try:
        secrets_store.ensure_key()  # made now, not on the first saved secret (that signed everyone out)
        secret = settings.secret_key_file.read_bytes()
    except OSError:
        pass
    material = b"gagesite-session\0" + settings.gagesite_password.encode() + b"\0" + secret + settings.secret_key.encode()
    return hashlib.sha256(material).digest()


def _sign(expires: int, purpose: str = "") -> str:
    message = f"{purpose}:{expires}" if purpose else str(expires)
    mac = hmac.new(_key(), message.encode(), hashlib.sha256).hexdigest()
    return f"{expires}.{mac}"


def _host(request: Request) -> str:
    """The host the browser asked for (behind Caddy), without a port."""
    return (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(":")[0].lower()


def _valid(cookie: str | None) -> bool:
    if not settings.gagesite_password or not cookie or "." not in cookie:
        return False
    expires, _, _mac = cookie.partition(".")
    if not expires.isdigit() or int(expires) < time.time():
        return False
    return hmac.compare_digest(cookie, _sign(int(expires)))


def _valid_ticket(ticket: str, host: str) -> bool:
    expires, _, _mac = ticket.partition(".")
    if not expires.isdigit() or not time.time() <= int(expires) <= time.time() + TICKET_SECONDS:
        return False
    return hmac.compare_digest(ticket, _sign(int(expires), f"enter:{host}"))


def _client(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "?")


def _locked(address: str) -> bool:
    now = time.time()
    recent = [t for t in _failures.get(address, []) if now - t < LOCK_SECONDS]
    _failures[address] = recent
    return len(recent) >= MAX_FAILURES


def _side_links() -> set[str]:
    """The tunnel links that sign in through Gagesite's link: previews and their APIs."""
    return {host for host in (tunnel.hostname("preview"), tunnel.hostname("api")) if host}


def _safe_next(target: str, request: Request) -> str:
    """Back to where the person was going: a path here, another port of this same host, or a side link."""
    if target.startswith("/") and not target.startswith("//") and "\\" not in target:
        return target
    parts = urlsplit(target)
    if parts.scheme in ("http", "https") and parts.hostname and parts.hostname in {_host(request), *_side_links()}:
        return target
    return "/"


@router.get("/auth/check")
def check(request: Request):
    """Caddy's forward_auth: 204 lets the request through; anything else is sent to the browser."""
    if _valid(request.cookies.get(COOKIE)):
        return Response(status_code=204)
    uri = request.headers.get("x-forwarded-uri", "/")
    if uri.startswith("/api/"):
        return JSONResponse({"detail": "Sign in to Gagesite again"}, status_code=401)
    host = request.headers.get("x-forwarded-host", "")
    scheme = request.headers.get("x-forwarded-proto", "http")
    app = tunnel.hostname("app")
    if app and _host(request) in _side_links():
        # The preview or API link: sign in (or already signed in) on Gagesite's link, then come back.
        return RedirectResponse(f"https://{app}/auth/handoff?next={quote(f'https://{host}{uri}', safe='')}", 302)
    login = f"/auth/login?next={quote(f'{scheme}://{host}{uri}', safe='')}"
    if settings.public_port and ":" in host:
        # A preview port: the sign-in page lives on Gagesite's own port of this host. (A tunnel
        # link has no port: its sign-in page is on the link itself.)
        login = f"{scheme}://{host.split(':')[0]}:{settings.public_port}{login}"
    return RedirectResponse(login, status_code=302)


def _page(next_url: str, message: str = "") -> HTMLResponse:
    note = f'<p class="err">{html.escape(message)}</p>' if message else ""
    missing = "" if settings.gagesite_password else (
        '<p class="err">No password is set on the server yet: add GAGESITE_PASSWORD to .env and restart.</p>')
    return HTMLResponse(f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Gagesite</title>
<style>
:root{{color-scheme:light;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}}
body{{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f6f7f9;color:#14171f}}
form{{width:min(360px,calc(100vw - 32px));background:#fff;border:1px solid #e3e6ec;border-radius:20px;padding:28px;box-shadow:0 18px 40px -28px rgba(20,23,31,.35)}}
h1{{margin:0 0 4px;font-size:20px}} p{{margin:0 0 18px;color:#5b6272;font-size:14px;line-height:1.5}}
label{{display:block;font-size:13px;font-weight:600;margin-bottom:6px}}
input{{box-sizing:border-box;width:100%;height:42px;border:1px solid #cfd4dd;border-radius:12px;padding:0 12px;font-size:15px}}
input:focus{{outline:none;border-color:#2266d4;box-shadow:0 0 0 4px #dce8fb}}
button{{margin-top:14px;width:100%;height:42px;border:0;border-radius:12px;background:#2266d4;color:#fff;font-size:15px;font-weight:600;cursor:pointer}}
button:hover{{background:#1b55b3}} .err{{color:#b42318;margin:12px 0 0}}
</style></head><body>
<form method="post" action="/auth/login">
<h1>Gagesite</h1><p>Enter the password to open Gagesite.</p>
<label for="password">Password</label>
<input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
<input type="hidden" name="next" value="{html.escape(next_url)}">
<button type="submit">Sign in</button>{note}{missing}
</form></body></html>""", headers={"Cache-Control": "no-store"})


@router.get("/auth/login")
def login_page(request: Request, next: str = "/"):
    if _valid(request.cookies.get(COOKIE)):
        return RedirectResponse(_safe_next(next, request), status_code=302)
    return _page(next)


@router.post("/auth/login")
def login(request: Request, password: str = Form(""), next: str = Form("/")):
    address = _client(request)
    if _locked(address):
        return _page(next, "Too many wrong passwords. Try again in 15 minutes.")
    if not settings.gagesite_password or not hmac.compare_digest(password.encode(), settings.gagesite_password.encode()):
        _failures.setdefault(address, []).append(time.time())
        time.sleep(1)
        return _page(next, "That password isn't right.")
    _failures.pop(address, None)
    expires = int(time.time()) + SESSION_DAYS * 86400
    response = RedirectResponse(_safe_next(next, request), status_code=303)
    response.set_cookie(COOKIE, _sign(expires), max_age=SESSION_DAYS * 86400, httponly=True, samesite="lax", path="/")
    return response


def _ticket(link: str) -> str:
    return _sign(int(time.time()) + TICKET_SECONDS, f"enter:{link}")


def _enter_url(link: str, path: str) -> str:
    return f"https://{link}/__gagesite/enter?ticket={quote(_ticket(link))}&next={quote(path, safe='')}"


@router.get("/auth/handoff")
def handoff(request: Request, next: str = "/"):
    """On Gagesite's link: passes this browser's session to the preview or API link as a short ticket."""
    if not _valid(request.cookies.get(COOKIE)):
        back = "/auth/handoff?next=" + quote(next, safe="")
        return RedirectResponse("/auth/login?next=" + quote(back, safe=""), 302)
    parts = urlsplit(next)
    if not parts.hostname or parts.hostname not in _side_links():
        return RedirectResponse("/", 302)
    return RedirectResponse(_enter_url(parts.hostname, (parts.path or "/") + (f"?{parts.query}" if parts.query else "")), 302)


@router.get("/__gagesite/enter")
def enter(request: Request, ticket: str = "", next: str = "/"):
    """On a preview or API link: a valid ticket becomes a session for this link (or one is there already).

    The cookie is partitioned (CHIPS) and SameSite=None: inside Gagesite's preview frame the preview
    link is a third-party site, where phone browsers drop ordinary cookies but keep partitioned ones.
    """
    target = next if next.startswith("/") and not next.startswith("//") and "\\" not in next else "/"
    response = RedirectResponse(target, status_code=302)
    if _valid(request.cookies.get(COOKIE)):
        return response
    host = _host(request)
    if not host or not _valid_ticket(ticket, host):
        return HTMLResponse("This link has expired. Open it again from Gagesite.", status_code=403)
    expires = int(time.time()) + SESSION_DAYS * 86400
    response.headers.append("Set-Cookie", f"{COOKIE}={_sign(expires)}; Max-Age={SESSION_DAYS * 86400}; Path=/; "
                                          "HttpOnly; Secure; SameSite=None; Partitioned")
    return response


@router.get("/api/access/preview")
def preview_access(request: Request):
    """On the tunnel link: where previews and their APIs are, with a fresh ticket for each (nulls elsewhere)."""
    app, preview, api = tunnel.hostname("app"), tunnel.hostname("preview"), tunnel.hostname("api")
    if not (app and _host(request) == app):
        preview = api = ""
    return {
        "origin": f"https://{preview}" if preview else None,
        "ticket": _ticket(preview) if preview else None,
        "api_origin": f"https://{api}" if api else None,
        "api_ticket": _ticket(api) if api else None,
    }


@router.get("/auth/logout")
def logout():
    response = RedirectResponse("/auth/login", status_code=302)
    response.delete_cookie(COOKIE, path="/")
    return response
