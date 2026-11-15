"""Gagesite's public links through Cloudflare quick tunnels (compose profile "tunnel", docs/DEPLOY.md).

When the server's own ports can't be reached from the internet, two cloudflared containers each
give a free https://<random>.trycloudflare.com link: one to Caddy's Gagesite port, one to its
preview port. Each tunnel reports its link on a small local status page (`/quicktunnel`); this
module reads them, so the sign-in can pass a session from one link to the other (access.py) and
the web app knows where previews are. The links change whenever the tunnels restart.
"""
from __future__ import annotations

import json
import time
import urllib.request

from .config import settings

_CACHE_SECONDS = 30
_cache: dict[str, tuple[str, float]] = {}


def _read(port: int) -> str:
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/quicktunnel", timeout=2) as response:
        return str(json.load(response).get("hostname") or "").strip().lower()


def hostname(which: str) -> str:
    """The tunnel's host name ("abc.trycloudflare.com") for "app" or "preview", or "" without one."""
    port = settings.tunnel_app_metrics if which == "app" else settings.tunnel_preview_metrics
    if not port:
        return ""
    hit = _cache.get(which)
    if hit and time.time() - hit[1] < _CACHE_SECONDS:
        return hit[0]
    try:
        host = _read(port)
    except Exception:
        host = ""
    _cache[which] = (host, time.time())
    return host


def links() -> dict[str, str]:
    """Both public links, for the deploy guide and the server log."""
    return {which: f"https://{host}" for which in ("app", "preview") if (host := hostname(which))}
