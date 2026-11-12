"""Google Stitch, an optional extra for UI Design: Google's design AI draws the style options.

The owner chooses per project (docs/03-design-kit.json `design_engine`): "gagesite" (the default,
Gagesite's own designer only) or "stitch". With Stitch, the UI Design run gets Google's Stitch MCP
server as extra tools; Claude still writes the design library and key pages Stage 4 builds from.

The Google API key belongs to this Gagesite install (one key, used for every project that chooses
Stitch). It is kept encrypted in data/stitch.json, reaches the run only as the STITCH_API_KEY
environment variable (the MCP config refers to it as ${STITCH_API_KEY}), and is never returned by
the API, written to a workspace or shown to the AI.
"""

import json
import urllib.error
import urllib.request
from dataclasses import replace
from datetime import datetime, timezone

from . import secrets_store
from .config import settings
from .stages import Stage

URL = "https://stitch.googleapis.com/mcp"
HEADER = "X-Goog-Api-Key"
ENV = "STITCH_API_KEY"
SERVER = "stitch"
FILE = settings.data_dir / "stitch.json"
# What the run gets: the remote server, its key read from the environment, never written out.
MCP_CONFIG = json.dumps({"mcpServers": {SERVER: {"type": "http", "url": URL, "headers": {HEADER: "${" + ENV + "}"}}}})


class StitchError(Exception):
    pass


def _load() -> dict:
    try:
        return json.loads(FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def key() -> str | None:
    saved = _load().get("encrypted_key")
    if not saved:
        return None
    try:
        return secrets_store.decrypt(saved)
    except Exception:
        return None


def status() -> dict:
    data = _load()
    return {
        "connected": bool(key()),
        "hint": data.get("hint"),
        "tools": data.get("tools", []),
        "connected_at": data.get("connected_at"),
    }


def _rpc(api_key: str, method: str, params: dict, rpc_id: int, session_id: str | None = None) -> tuple[dict, str | None]:
    """One MCP request over streamable HTTP. Answers come as JSON or as a short event stream."""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        HEADER: api_key,
    }
    if session_id:
        headers["Mcp-Session-Id"] = session_id
    body = json.dumps({"jsonrpc": "2.0", "id": rpc_id, "method": method, "params": params}).encode()
    request = urllib.request.Request(URL, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            text = response.read().decode("utf-8", errors="replace")
            new_session = response.headers.get("Mcp-Session-Id") or session_id
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            raise StitchError("Google refused this key. Check it is a Stitch API key from stitch.withgoogle.com (Settings → API key).") from None
        raise StitchError(f"Stitch answered {exc.code}. Try again in a minute.") from None
    except (urllib.error.URLError, TimeoutError):
        raise StitchError("Gagesite couldn't reach Stitch. Check the internet connection and try again.") from None
    if text.lstrip().startswith("{"):
        payload = json.loads(text)
    else:  # event stream: the answer is the last "data:" line
        lines = [line[5:].strip() for line in text.splitlines() if line.startswith("data:")]
        payload = json.loads(lines[-1]) if lines else {}
    if payload.get("error"):
        raise StitchError(f"Stitch refused: {payload['error'].get('message', 'unknown error')}")
    return payload.get("result") or {}, new_session


def check(api_key: str) -> list[str]:
    """Connects with the key and returns Stitch's tool names (proof the key works)."""
    _, session_id = _rpc(api_key, "initialize", {
        "protocolVersion": "2025-03-26",
        "capabilities": {},
        "clientInfo": {"name": "Gagesite", "version": "0.1"},
    }, 1)
    result, _ = _rpc(api_key, "tools/list", {}, 2, session_id)
    tools = [t.get("name", "") for t in result.get("tools", []) if t.get("name")]
    if not tools:
        raise StitchError("Stitch answered, but offered no design tools.")
    # Stitch lists its tools to anyone: only a real call proves the key (a bad one gets 401/403).
    answer, _ = _rpc(api_key, "tools/call", {"name": "list_projects", "arguments": {}}, 3, session_id)
    if answer.get("isError"):
        text = " ".join(c.get("text", "") for c in answer.get("content", []) if isinstance(c, dict))[:200]
        raise StitchError(f"Stitch refused this key: {text or 'no reason given'}")
    return tools


def connect(api_key: str) -> dict:
    api_key = api_key.strip()
    if not api_key:
        raise StitchError("Paste your Stitch API key")
    tools = check(api_key)
    FILE.parent.mkdir(parents=True, exist_ok=True)
    FILE.write_text(json.dumps({
        "encrypted_key": secrets_store.encrypt(api_key),
        "hint": api_key[-4:],
        "tools": tools,
        "connected_at": datetime.now(timezone.utc).isoformat(),
    }), encoding="utf-8")
    return status()


def disconnect() -> dict:
    FILE.unlink(missing_ok=True)
    return status()


def design_stage(stage: Stage) -> Stage:
    """UI Design with Stitch's tools and the extra instructions for using them."""
    return replace(
        stage,
        variant="stitch",
        mcp_config=MCP_CONFIG,
        prompt_files=[*stage.prompt_files, "stitch.md"],
        allowed_tools=[*stage.allowed_tools, f"mcp__{SERVER}", "Bash(npm run design-fetch:*)"],
        max_turns=stage.max_turns + 40,  # each screen is a few extra tool calls
    )
