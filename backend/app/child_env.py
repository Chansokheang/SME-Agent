"""What a program Gagesite starts for a project may see of Gagesite's own environment.

A project's website, its API service, its installs and builds, and the deploy tools run code that
the AI wrote. They get only the basics a process needs (PATH, HOME, locale, temp folders, proxy
and certificate settings) plus what the caller passes on purpose (the project's own keys, its
ports, its API address). Never Gagesite's Claude sign-in, its password, its database address or
its own public addresses: a website that read those could leak them, and an inherited
DATABASE_URL would even win over the project's own .env.
"""
from __future__ import annotations

import os

# Exact names (matched without case, for Windows) and prefixes a child process may inherit.
SAFE_NAMES = {
    "PATH", "PATHEXT", "HOME", "USER", "USERNAME", "LOGNAME", "SHELL", "HOSTNAME", "TERM", "TZ", "LANG",
    "LANGUAGE", "TMPDIR", "TEMP", "TMP", "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "COMSPEC", "APPDATA",
    "LOCALAPPDATA", "USERPROFILE", "PROGRAMDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMW6432",
    "COMMONPROGRAMFILES", "COMMONPROGRAMFILES(X86)", "PUBLIC", "ALLUSERSPROFILE", "NUMBER_OF_PROCESSORS",
    "PROCESSOR_ARCHITECTURE", "OS", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "SSL_CERT_FILE",
    "SSL_CERT_DIR", "REQUESTS_CA_BUNDLE", "NODE_EXTRA_CA_CERTS", "NODE_OPTIONS", "PLAYWRIGHT_BROWSERS_PATH",
    "PYTHONIOENCODING", "PYTHONUTF8", "CI", "DOCKER_HOST", "DOCKER_CONFIG", "DOCKER_CONTEXT",
}
SAFE_PREFIXES = ("LC_", "XDG_", "NPM_CONFIG_", "COREPACK_", "PUPPETEER_")

# Gagesite's own settings and secrets. Even an AI run (which needs its Claude sign-in) never gets
# these, and website processes started during that run drop them too (see the workspace hooks).
GAGESITE_ONLY = {
    "GAGESITE_PASSWORD", "SECRET_KEY_FILE", "DATABASE_URL", "PUBLIC_API_URL", "PUBLIC_PORT", "PREVIEW_PORT", "TUNNEL_APP_METRICS", "TUNNEL_PREVIEW_METRICS",
    "COMPOSE_PROFILES",
}


def _safe(name: str) -> bool:
    upper = name.upper()
    return upper in SAFE_NAMES or upper.startswith(SAFE_PREFIXES)


def safe_env(*extra: dict[str, str] | None) -> dict[str, str]:
    """The basics from Gagesite's environment, then each `extra` mapping in order (later wins)."""
    env = {k: v for k, v in os.environ.items() if _safe(k)}
    for more in extra:
        if more:
            env.update(more)
    return env


def without_gagesite(env: dict[str, str]) -> dict[str, str]:
    """A copy of `env` without Gagesite's own settings (for the AI's runs, which keep Claude's sign-in)."""
    return {k: v for k, v in env.items() if k.upper() not in GAGESITE_ONLY}
