"""Which Claude account Gagesite's AI runs use.

The owner adds accounts with a long-lived token from `claude setup-token` (one per account) and picks
one. Every run then gets that token in its environment (CLAUDE_CODE_OAUTH_TOKEN); with no account
picked, runs use the computer's own Claude Code login, as before. The choice is manual on purpose:
nothing switches accounts by itself (e.g. when one reaches its usage limit).

Tokens are encrypted at rest and never returned, logged or put on a command line.
"""

import json
import os
import re
import shutil
import subprocess
import tempfile
import time

from sqlmodel import Session, select

from . import secrets_store
from .db import ClaudeAccount, engine, utcnow

COMPUTER = "This computer's login"
TOKEN_ENV = "CLAUDE_CODE_OAUTH_TOKEN"
# Other ways the CLI could pick up credentials: removed so the chosen account is the one used.
OTHER_AUTH_ENV = ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")
_SECRET = re.compile(r"sk-ant-[A-Za-z0-9_\-]+")
_computer_cache: tuple[float, dict] | None = None
# Gagesite started with CLAUDE_CODE_OAUTH_TOKEN set (e.g. in Docker, from .env): that token is this
# computer's login. Read once at start; runs get it only through run_env, like any account.
SERVER_TOKEN = (os.environ.get(TOKEN_ENV) or "").strip() or None


def scrub(text: str) -> str:
    return _SECRET.sub("<hidden>", text or "")


def _claude() -> str:
    from .runner import claude_binary

    return claude_binary()


def _base_env() -> dict[str, str]:
    from .runner import NESTED_SESSION_VARS

    env = {k: v for k, v in os.environ.items() if k not in NESTED_SESSION_VARS and k not in OTHER_AUTH_ENV}
    env.pop(TOKEN_ENV, None)
    return env


def computer_login() -> dict:
    """The account Claude Code is signed in with on this computer (cached for a minute)."""
    global _computer_cache
    if _computer_cache and time.time() - _computer_cache[0] < 60:
        return _computer_cache[1]
    info = {"logged_in": False, "email": None, "plan": None}
    env = _base_env()
    if SERVER_TOKEN:
        env[TOKEN_ENV] = SERVER_TOKEN
    try:
        out = subprocess.run([_claude(), "auth", "status"], env=env, capture_output=True, text=True,
                             encoding="utf-8", errors="replace", timeout=30)
        data = json.loads(out.stdout)
        info = {"logged_in": bool(data.get("loggedIn")), "email": data.get("email"),
                "plan": data.get("subscriptionType")}
    except Exception:
        pass
    _computer_cache = (time.time(), info)
    return info


def check_token(token: str) -> str | None:
    """Make one tiny request with the token. Returns None when it works, else a plain reason."""
    env = _base_env()
    env[TOKEN_ENV] = token
    folder = tempfile.mkdtemp(prefix="gagesite-token-check-")
    try:
        out = subprocess.run(
            [_claude(), "-p", "Reply with OK", "--max-turns", "1", "--model", "haiku",
             "--setting-sources", "project", "--strict-mcp-config"],
            cwd=folder, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120,
        )
    except subprocess.TimeoutExpired:
        return "Claude didn't answer in time. Check your connection and try again."
    finally:
        shutil.rmtree(folder, ignore_errors=True)
    if out.returncode == 0:
        return None
    detail = scrub((out.stdout + out.stderr).strip())
    if "401" in detail or "invalid" in detail.lower() or "authenticate" in detail.lower():
        return "That token didn't work. Run `claude setup-token` again and paste the whole token."
    if "limit" in detail.lower():
        return "The token works, but this account has reached its usage limit right now. Try adding it later."
    return "Claude couldn't be reached with that token: " + detail[-200:]


def public(account: ClaudeAccount) -> dict:
    return {"id": account.id, "name": account.name, "hint": account.hint, "active": account.active,
            "created_at": account.created_at.isoformat() if account.created_at else None,
            "last_used_at": account.last_used_at.isoformat() if account.last_used_at else None}


def overview(session: Session) -> dict:
    accounts = session.exec(select(ClaudeAccount).order_by(ClaudeAccount.created_at)).all()
    active = next((a for a in accounts if a.active), None)
    return {"active_id": active.id if active else None, "computer": computer_login(),
            "accounts": [public(a) for a in accounts]}


def for_run() -> tuple[str, str | None]:
    """(label, token) for the next run: the active account, or the computer's login (token None)."""
    with Session(engine) as session:
        account = session.exec(select(ClaudeAccount).where(ClaudeAccount.active == True)).first()  # noqa: E712
        if not account:
            return COMPUTER, None
        account.last_used_at = utcnow()
        session.add(account)
        session.commit()
        return account.name, secrets_store.decrypt(account.encrypted_token)


def run_env(env: dict[str, str]) -> str:
    """Point a run's environment at the chosen account. Returns the account's label."""
    label, token = for_run()
    if token:
        for name in OTHER_AUTH_ENV:  # nothing else may take precedence over the chosen account
            env.pop(name, None)
        env[TOKEN_ENV] = token
    elif SERVER_TOKEN:  # this computer's login is the token Gagesite was started with
        for name in OTHER_AUTH_ENV:
            env.pop(name, None)
        env[TOKEN_ENV] = SERVER_TOKEN
    else:
        env.pop(TOKEN_ENV, None)  # the computer's login, exactly as Claude Code would use it
    return label
