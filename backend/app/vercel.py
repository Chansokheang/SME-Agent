"""Puts the generated website online in the owner's own Vercel account (Stage 5).

The owner gives an access token (vercel.com/account/settings/tokens). It is stored encrypted
(secrets_store) and only sent to api.vercel.com. Files are uploaded straight from site/, so
Vercel doesn't need access to GitHub.
"""

import hashlib
import json
import time
import urllib.error
import urllib.request

API = "https://api.vercel.com"


class VercelError(Exception):
    """A plain-language reason a Vercel call failed."""


def _call(method: str, path: str, token: str, body: dict | bytes | None = None, headers: dict | None = None,
          timeout: int = 60) -> dict:
    data = body if isinstance(body, bytes) else json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(API + path, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/octet-stream" if isinstance(body, bytes) else "application/json",
        "User-Agent": "Gagesite",
        **(headers or {}),
    })
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        try:
            detail = json.loads(exc.read()).get("error", {})
        except (ValueError, AttributeError):
            detail = {}
        if exc.code in (401, 403) and path.startswith("/v2/user"):
            raise VercelError("Vercel didn't accept that token. Check it was copied completely and hasn't expired.") from None
        if exc.code == 403:
            raise VercelError("Vercel refused: the token can't do this. Create a token with Full Account scope.") from None
        message = detail.get("message") if isinstance(detail, dict) else None
        raise VercelError(f"Vercel answered with an error ({exc.code}){': ' + message if message else ''}.") from None
    except urllib.error.URLError:
        raise VercelError("Vercel couldn't be reached. Check the internet connection.") from None


def connect(token: str) -> dict:
    """Checks the token and returns who it belongs to."""
    user = _call("GET", "/v2/user", token).get("user") or {}
    return {"username": user.get("username") or user.get("email") or "your account"}


def project_name(value: str) -> str:
    name = "".join(c if c.isalnum() else "-" for c in value.lower()).strip("-")
    while "--" in name:
        name = name.replace("--", "-")
    return (name or "my-website")[:90]


def ensure_project(token: str, name: str, known_id: str | None, framework: str | None = "nextjs") -> dict:
    """The Vercel project for this website: the one we made before, or a new one with a free name."""
    if known_id:
        try:
            return _call("GET", f"/v9/projects/{known_id}", token)
        except VercelError:
            pass  # deleted on Vercel: make a new one
    candidate = project_name(name)
    for attempt in range(1, 20):
        try:
            _call("GET", f"/v9/projects/{candidate}", token)
            candidate = f"{project_name(name)}-{attempt + 1}"  # taken by something else of theirs
        except VercelError:
            return _call("POST", "/v11/projects", token, {"name": candidate, "framework": framework})
    raise VercelError("Couldn't find a free name for the website on Vercel.")


def pause(token: str, project_id: str) -> None:
    """Takes the website offline: visitors see Vercel's "paused" page; code, settings and address are kept."""
    _call("POST", f"/v1/projects/{project_id}/pause", token, {})


def unpause(token: str, project_id: str) -> None:
    """Puts a paused website back online, as it was."""
    _call("POST", f"/v1/projects/{project_id}/unpause", token, {})


def set_env(token: str, project_id: str, values: dict[str, str]) -> None:
    """Creates or replaces the website's settings (encrypted on Vercel) for live and preview."""
    if not values:
        return
    body = [{"key": k, "value": v, "type": "encrypted", "target": ["production", "preview"]} for k, v in values.items()]
    _call("POST", f"/v10/projects/{project_id}/env?upsert=true", token, body)


def upload(token: str, files: dict[str, bytes]) -> list[dict]:
    """Uploads every file (Vercel skips ones it already has); returns the deployment's file list."""
    listed = []
    for path, content in files.items():
        digest = hashlib.sha1(content).hexdigest()
        _call("POST", "/v2/files", token, content, {"x-vercel-digest": digest, "Content-Length": str(len(content))}, timeout=120)
        listed.append({"file": path, "sha": digest, "size": len(content)})
    return listed


def deploy(token: str, project: dict, files: list[dict], framework: str | None = "nextjs") -> dict:
    return _call("POST", "/v13/deployments?skipAutoDetectionConfirmation=1", token, {
        "name": project["name"],
        "project": project["id"],
        "target": "production",
        "files": files,
        "projectSettings": {"framework": framework},
    }, timeout=120)


def redeploy(token: str, project: dict, deployment_id: str) -> dict:
    """Builds the live website again from the same files, with its current settings (after one changed)."""
    return _call("POST", "/v13/deployments?forceNew=1", token, {
        "name": project["name"],
        "project": project["id"],
        "deploymentId": deployment_id,
        "target": "production",
    }, timeout=120)


def wait(token: str, deployment_id: str, limit: int = 1200) -> dict:
    """Waits until Vercel has built the website (or failed to)."""
    deadline = time.time() + limit
    while time.time() < deadline:
        info = _call("GET", f"/v13/deployments/{deployment_id}", token)
        if info.get("readyState") in ("READY", "ERROR", "CANCELED"):
            return info
        time.sleep(5)
    raise VercelError("Vercel took more than 20 minutes to build the website.")


def build_log(token: str, deployment_id: str, lines: int = 80) -> str:
    """The last lines of Vercel's build output."""
    try:
        events = _call("GET", f"/v3/deployments/{deployment_id}/events?builds=1&limit=-1", token)
    except VercelError:
        return ""
    if isinstance(events, dict):
        events = events.get("events") or []
    text = [str((e.get("payload") or {}).get("text") or e.get("text") or "") for e in events if isinstance(e, dict)]
    return "\n".join([t.rstrip() for t in text if t.strip()][-lines:])


def live_url(project: dict, deployment: dict) -> str:
    aliases = deployment.get("alias") or []
    if aliases:
        return "https://" + sorted(aliases, key=len)[0]
    return f"https://{project['name']}.vercel.app"
