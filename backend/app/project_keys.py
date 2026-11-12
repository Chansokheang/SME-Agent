"""A project's keys and settings: API keys, a model's address, an email service key...

Values are encrypted in the project's Deployment row (`encrypted_settings`, the same store Stage 5
uses for the live website's settings), so a key entered once works in the preview and online.
The AI never sees a value: the workspace gets only `docs/keys.json` with names, what each is for
and whether it is set. The running website gets the values through its environment, from
processes Gagesite starts itself (the preview and the live site), never from the AI's own runs.
"""

import json
import re

from sqlmodel import Session

from . import secrets_store, workspace
from .db import DatabaseConnection, Deployment, engine

KEYS_JSON = "docs/keys.json"
SCOPE_JSON = "docs/01-scope.json"
DEPLOY_JSON = "docs/05-deploy.json"
NAME = re.compile(r"^[A-Z][A-Z0-9_]{1,63}$")
# Set by Gagesite itself; the owner never enters these.
RESERVED = {"DATABASE_URL", "AUTH_SECRET", "NEXTAUTH_SECRET", "AUTH_TRUST_HOST", "AUTH_URL", "NEXTAUTH_URL",
            "NODE_ENV", "VERCEL", "VERCEL_URL", "VERCEL_ENV", "NEXT_RUNTIME", "NEXT_DIST_DIR", "PORT",
            "API_URL", "NEXT_PUBLIC_API_URL", "SERVICE_JWT_SECRET", "ALLOWED_ORIGINS", "PATH"}

# Text that looks like a secret key (checked before any chat message reaches the AI).
SECRET_PATTERNS = [
    re.compile(r"\bsk-(?:ant-|proj-)?[A-Za-z0-9_\-]{20,}"),                 # Anthropic, OpenAI and similar
    re.compile(r"\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}"),               # Stripe secret and restricted keys
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}"),                             # GitHub
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}"),
    re.compile(r"\bxox[abpr]-[A-Za-z0-9\-]{20,}"),                           # Slack
    re.compile(r"\bAIza[0-9A-Za-z_\-]{30,}"),                                # Google
    re.compile(r"\bAQ\.[A-Za-z0-9_\-]{40,}"),                                # Google (newer keys, e.g. Stitch)
    re.compile(r"\bhf_[A-Za-z0-9]{30,}"),                                    # Hugging Face
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),                                     # AWS access key
    re.compile(r"\bre_[A-Za-z0-9]{20,}"),                                    # Resend
    re.compile(r"\bSG\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,}"),           # SendGrid
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\beyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}"),  # a JWT
    re.compile(r"(?i)\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*['\"]?[A-Za-z0-9_\-./+]{24,}"),
]


def looks_secret(text: str) -> bool:
    return any(p.search(text or "") for p in SECRET_PATTERNS)


def _read(project_id: str, relative: str) -> dict:
    raw = workspace.read_text(project_id, relative)
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        data = {}
    return data if isinstance(data, dict) else {}


def saved_values(project_id: str) -> dict[str, str]:
    with Session(engine) as session:
        row = session.get(Deployment, project_id)
        if not row or not row.encrypted_settings:
            return {}
        return json.loads(secrets_store.decrypt(row.encrypted_settings))


def save_values(project_id: str, updates: dict[str, str | None]) -> None:
    """Set (a value) or clear (None / "") keys. Other saved settings are kept."""
    with Session(engine) as session:
        row = session.get(Deployment, project_id) or Deployment(project_id=project_id)
        saved = json.loads(secrets_store.decrypt(row.encrypted_settings)) if row.encrypted_settings else {}
        for name, value in updates.items():
            if value and value.strip():
                saved[name] = value.strip()
            else:
                saved.pop(name, None)
        row.encrypted_settings = secrets_store.encrypt(json.dumps(saved))
        session.add(row)
        session.commit()


# The owner's own key list (names, what each is for, secret or not) is kept with the values in the
# encrypted store, under this entry: never in a workspace file the AI could change.
DEFS = "__keys__"


def owner_keys(project_id: str) -> list[dict]:
    defs = saved_values(project_id).get(DEFS) or []
    return [d for d in defs if isinstance(d, dict) and NAME.match(str(d.get("name", "")))]


def _save_defs(project_id: str, defs: list[dict]) -> None:
    with Session(engine) as session:
        row = session.get(Deployment, project_id) or Deployment(project_id=project_id)
        saved = json.loads(secrets_store.decrypt(row.encrypted_settings)) if row.encrypted_settings else {}
        saved[DEFS] = defs
        row.encrypted_settings = secrets_store.encrypt(json.dumps(saved))
        session.add(row)
        session.commit()


def declared(project_id: str) -> list[dict]:
    """The keys the website reads: the ones the OWNER defined (any names they like), plus the ones
    the finished code needs to go online (Stage 5, fixed by the code). The plan only suggests."""
    keys: dict[str, dict] = {}
    for item in owner_keys(project_id):
        keys[item["name"]] = {"name": item["name"], "purpose": str(item.get("purpose", "")),
                              "secret": item.get("secret", True) is not False, "required": False, "source": "owner"}
    for item in _read(project_id, DEPLOY_JSON).get("env") or []:
        if (isinstance(item, dict) and item.get("source") == "owner" and NAME.match(str(item.get("name", "")))
                and item["name"] not in RESERVED and item["name"] not in keys):
            keys[item["name"]] = {"name": item["name"], "purpose": str(item.get("purpose") or item.get("label") or ""),
                                  "secret": True, "required": bool(item.get("required")), "source": "online"}
    return list(keys.values())


def suggestions(project_id: str) -> list[dict]:
    """Keys the plan thinks the website needs, which the owner hasn't added (yet): one click to add,
    or ignore them and name keys their own way."""
    have = {k["name"] for k in declared(project_id)}
    out = []
    for item in _read(project_id, SCOPE_JSON).get("keys") or []:
        name = str(item.get("name", "")) if isinstance(item, dict) else ""
        if NAME.match(name) and name not in RESERVED and name not in have:
            out.append({"name": name, "purpose": str(item.get("purpose", "")),
                        "secret": item.get("secret", True) is not False})
    return out


FIRST_LOGIN = "__first_login__"  # the live site's first account, kept with the settings (never sent to Vercel)


def first_login(project_id: str) -> dict | None:
    """{"email", "name", "password"} of the first account Gagesite made on the live site, or None."""
    data = saved_values(project_id).get(FIRST_LOGIN)
    return data if isinstance(data, dict) and data.get("email") else None


def save_first_login(project_id: str, login: dict) -> None:
    with Session(engine) as session:
        row = session.get(Deployment, project_id) or Deployment(project_id=project_id)
        saved = json.loads(secrets_store.decrypt(row.encrypted_settings)) if row.encrypted_settings else {}
        saved[FIRST_LOGIN] = {k: str(login.get(k) or "") for k in ("email", "name", "password")}
        row.encrypted_settings = secrets_store.encrypt(json.dumps(saved))
        session.add(row)
        session.commit()


def new_password() -> str:
    """Strong but typeable: 4 groups of letters and digits, e.g. Kp7m-Qx2a-Rt9w-Hn4c."""
    import secrets
    alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "-".join("".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(4))


def planned_login_email(project_id: str, role: str | None) -> str:
    """The email the first live account gets: the preview's test account for that role (the owner
    already knows it), else owner@<site>.test."""
    accounts = _read(project_id, "docs/04-build.json").get("test_accounts") or []
    accounts = [a for a in accounts if isinstance(a, dict) and "@" in str(a.get("email", ""))]
    for a in accounts:
        if role and str(a.get("role", "")).lower() == role.lower():
            return str(a["email"])
    return str(accounts[0]["email"]) if accounts else "owner@example.com"


# ---- live checks: a saved value is tested against its service, so "saved" means "works" ----
_CHECKS: dict[str, tuple[float, str | None]] = {}


def service_problems(project_id: str) -> dict[str, str]:
    """{setting name: what is wrong, in plain words} for settings Gagesite can test (cached 5 min)."""
    import hashlib, time, urllib.error, urllib.request
    saved = saved_values(project_id)
    names = {k["name"] for k in declared(project_id)}
    problems: dict[str, str] = {}
    url = (saved.get("SUPABASE_URL") or "").strip().rstrip("/")
    key = (saved.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if "SUPABASE_SERVICE_ROLE_KEY" in names and url and key and not value_problem("SUPABASE_SERVICE_ROLE_KEY", key):
        bucket = (saved.get("SUPABASE_BUCKET") or "").strip() or "documents"
        cache_key = hashlib.sha256(f"{url}|{key}|{bucket}".encode()).hexdigest()
        hit = _CHECKS.get(cache_key)
        if hit and time.time() - hit[0] < 300:
            problem = hit[1]
        else:
            def call(path: str, method: str = "GET", body: dict | None = None) -> int:
                headers = {"Authorization": f"Bearer {key}", "apikey": key}
                data = None
                if body is not None:
                    headers["Content-Type"] = "application/json"
                    data = json.dumps(body).encode()
                req = urllib.request.Request(f"{url}/storage/v1{path}", method=method, headers=headers, data=data)
                try:
                    return urllib.request.urlopen(req, timeout=10).status
                except urllib.error.HTTPError as e:
                    return e.code
            try:
                status = call(f"/bucket/{bucket}")
                if status in (400, 404):  # no bucket yet: make the private one the website expects
                    status = call("/bucket", "POST", {"id": bucket, "name": bucket, "public": False})
                problem = None if status == 200 else (
                    "Supabase refused this key. Copy the secret key (sb_secret_...) or the legacy service_role key "
                    "from Project Settings > API Keys." if status in (401, 403) else
                    f"Supabase storage answered with an error ({status}). Check the key and the project address.")
            except Exception:
                problem = "Gagesite couldn't reach your Supabase project. Check the address (https://xxxx.supabase.co)."
            _CHECKS[cache_key] = (time.time(), problem)
        if problem:
            problems["SUPABASE_SERVICE_ROLE_KEY"] = problem
    for name in names:
        if name not in problems and (bad := value_problem(name, saved.get(name) or "")):
            problems[name] = bad
    return problems


def value_problem(name: str, value: str) -> str | None:
    """A value that can't work for this key, in plain words (or None). Never echoes the value."""
    v = (value or "").strip()
    if name == "SUPABASE_SERVICE_ROLE_KEY" and v:
        if v.startswith("sb_publishable_"):
            return ("This is Supabase's publishable (public) key. The file storage needs the SECRET key: "
                    "in Supabase open Project Settings > API Keys and copy a secret key (sb_secret_...), "
                    "or the legacy service_role key.")
        if v.startswith("eyJ"):
            import base64
            try:
                part = v.split(".")[1]
                role = json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))).get("role")
            except Exception:
                role = None
            if role == "anon":
                return ("This is Supabase's anon (public) key. Copy the service_role key instead "
                        "(Project Settings > API Keys > Legacy API keys), or a secret key (sb_secret_...).")
    if name == "SUPABASE_URL" and v and not re.match(r"^https://[a-z0-9-]+\.supabase\.(co|in)/?$", v):
        if v.startswith("postgres"):
            return "This is the database connection string. SUPABASE_URL is the project address, like https://xxxx.supabase.co."
    return None


def supabase_project_url(project_id: str) -> str | None:
    """https://<ref>.supabase.co for a project whose database is on Supabase (from the pooler user
    `postgres.<ref>` or the direct host `db.<ref>.supabase.co`), else None."""
    with Session(engine) as session:
        connection = session.get(DatabaseConnection, project_id)
    if not connection or connection.provider != "supabase":
        return None
    ref = None
    if connection.username.startswith("postgres."):
        ref = connection.username.split(".", 1)[1]
    elif connection.host.startswith("db.") and connection.host.endswith(".supabase.co"):
        ref = connection.host.split(".")[1]
    return f"https://{ref}.supabase.co" if ref and re.fullmatch(r"[a-z0-9]{10,40}", ref) else None


def fill_from_connections(project_id: str) -> None:
    """Settings Gagesite already knows from the owner's connections, so they aren't asked twice:
    SUPABASE_URL from the Supabase database connected in Database Design. Only fills an empty one."""
    names = {k["name"] for k in declared(project_id)}
    if "SUPABASE_URL" in names and not saved_values(project_id).get("SUPABASE_URL"):
        url = supabase_project_url(project_id)
        if url:
            save_values(project_id, {"SUPABASE_URL": url})


def overview(project_id: str) -> list[dict]:
    """For the owner's panel: each key, whether it is set, and its last 4 characters (never the value)."""
    fill_from_connections(project_id)
    saved = saved_values(project_id)
    rows = []
    for key in declared(project_id):
        value = saved.get(key["name"]) or ""
        # A value that looks like a token is a secret, whatever the owner ticked.
        secret = key["secret"] or looks_secret(value) or looks_secret(f"token = {value}")
        # Never the value itself: only its last 4 characters, for every key.
        rows.append({**key, "secret": secret, "set": bool(value), "hint": value[-4:] if value else ""})
    return rows


def write_manifest(project_id: str) -> None:
    """docs/keys.json for the AI: the owner's key names, purposes and whether each is set, plus the
    plan's suggestions the owner hasn't added. Never a value."""
    keys = [{k: v for k, v in key.items() if k != "hint"} for key in overview(project_id)]
    path = workspace.workspace_path(project_id) / KEYS_JSON
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"version": 1, "note": "Managed by Gagesite. Values are never in the workspace.",
                                "keys": keys, "suggested": suggestions(project_id)},
                               indent=2, ensure_ascii=False), encoding="utf-8")


def add_owner_key(project_id: str, name: str, purpose: str, secret: bool) -> None:
    defs = [d for d in owner_keys(project_id) if d.get("name") != name]
    defs.append({"name": name, "purpose": purpose, "secret": secret})
    _save_defs(project_id, defs)


def edit_owner_key(project_id: str, name: str, new_name: str, purpose: str, secret: bool) -> None:
    """Rename or describe one of the owner's keys; its value (if any) moves with it."""
    defs = owner_keys(project_id)
    for d in defs:
        if d.get("name") == name:
            d.update(name=new_name, purpose=purpose, secret=secret)
    _save_defs(project_id, defs)
    if new_name != name:
        value = saved_values(project_id).get(name)
        save_values(project_id, {name: None, **({new_name: value} if value else {})})


def remove_owner_key(project_id: str, name: str) -> None:
    _save_defs(project_id, [d for d in owner_keys(project_id) if d.get("name") != name])


def run_env(project_id: str) -> dict[str, str]:
    """The values the running website gets (the preview; the live site gets them at Stage 5)."""
    saved = saved_values(project_id)
    return {k["name"]: saved[k["name"]] for k in declared(project_id) if saved.get(k["name"])}
