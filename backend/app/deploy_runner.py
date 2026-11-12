"""Stage 5's "Put my website online" job: GitHub -> the owner's database -> the owner's Vercel.

Runs in a background thread and records each step in the Deployment row, so the owner's
screen can follow along. Secrets (tokens, the database address, the owner's first password)
only travel through memory and environment variables: never a command line, a file or a log.
"""

import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import threading
import urllib.error
import urllib.request
from pathlib import Path

from sqlmodel import Session

from . import github, secrets_store, site_runner, vercel, workspace
from .db import DatabaseConnection, Deployment, GitHubConnection, VercelConnection, engine, utcnow

DEPLOY_JSON = "docs/05-deploy.json"
DEPLOY_MD = "docs/05-deploy.md"
DEPLOY_LOG = "docs/05-deploy-log.txt"  # the last failed attempt's output
SCHEMA_JSON = "docs/02-schema.json"
PRODUCTION_DIR = "prisma/.production"  # temporary: the live database's version of the schema
PRODUCTION_SCRIPT = "prisma/production.ts"

STEPS = [
    ("code", "Save your code to GitHub"),
    ("database", "Prepare your database"),
    ("upload", "Upload your website to Vercel"),
    ("build", "Vercel builds your website"),
    ("check", "Check it's online"),
]
# "UI + dedicated API": the API service goes online first, on its own Vercel project.
SERVICE_STEP = ("service", "Put your API service online")
SERVICE_DIR = "service"


def service_setup(project_id: str) -> dict | None:
    """The build setup when it is "UI + dedicated API" and the service exists, else None."""
    try:
        setup = json.loads(workspace.read_text(project_id, "docs/04-setup.json") or "{}")
    except json.JSONDecodeError:
        return None
    folder = workspace.workspace_path(project_id) / SERVICE_DIR
    if setup.get("setup") != "api_service" or not ((folder / "package.json").exists() or (folder / "requirements.txt").exists()):
        return None
    return setup
# Never uploaded: installed packages, build output, local secrets and the practice database.
SKIP_DIRS = {"node_modules", ".git", ".production"}
SKIP_FILE = re.compile(r"^(\.env(\..+)?|.*\.db|.*\.db-journal|tsconfig\.tsbuildinfo)$")


_FINGERPRINTS: dict[str, tuple[tuple, str]] = {}
# Rewritten by Next.js itself whenever the preview switches between development and production:
# never a change of the owner's.
NOT_CHANGES = {"next-env.d.ts"}


def _tree_signature(folder: Path) -> tuple:
    """Cheap: how many files, their total size and the newest change (to reuse a fingerprint)."""
    count = size = newest = 0
    for root, dirs, names in os.walk(folder):
        # Never walks into installed packages or build output (tens of thousands of files).
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".next") and d not in (".venv", "__pycache__")]
        for name in names:
            if (SKIP_FILE.match(name) and name != ".env.example") or name in NOT_CHANGES:
                continue
            stat = os.stat(os.path.join(root, name))
            count, size, newest = count + 1, size + stat.st_size, max(newest, stat.st_mtime_ns)
    return count, size, newest


def online_fingerprint(project_id: str) -> str:
    """What going online would put there now: the website's code, the API's code when it goes to
    Vercel with it, the saved settings and the API's address. Same fingerprint, nothing to put online."""
    from . import api_server  # (imports this module)

    site = site_runner.site_path(project_id)
    api_url = api_server.live_api_url(project_id)
    with_service = service_setup(project_id) is not None and not api_url
    service = workspace.workspace_path(project_id) / SERVICE_DIR
    with Session(engine) as session:
        row = session.get(Deployment, project_id)
        settings_blob = secrets_store.decrypt(row.encrypted_settings) if row and row.encrypted_settings else ""
    signature = (_tree_signature(site), _tree_signature(service) if with_service else None,
                 hashlib.sha256(settings_blob.encode()).hexdigest(), api_url)
    cached = _FINGERPRINTS.get(project_id)
    if cached and cached[0] == signature:
        return cached[1]
    digest = hashlib.sha256()
    parts = [("site", site_files(site, None))]
    if with_service:
        parts.append(("service", {k: v for k, v in site_files(service, None).items()
                                  if not k.startswith((".venv/", "__pycache__/")) and "/__pycache__/" not in k}))
    for label, files in parts:
        for name in sorted(files):
            if Path(name).name in NOT_CHANGES:
                continue
            digest.update(f"{label}/{name}".encode() + b"\0" + hashlib.sha256(files[name]).digest())
    digest.update(signature[2].encode() + (api_url or "").encode())
    _FINGERPRINTS[project_id] = (signature, digest.hexdigest())
    return digest.hexdigest()


def changes_waiting(project_id: str) -> bool:
    """Is there anything new to put online since the website last went online?"""
    with Session(engine) as session:
        row = session.get(Deployment, project_id)
        if not row or row.status != "live":
            return True
        known, live_at = row.online_hash, row.live_at
    now = online_fingerprint(project_id)
    if known is None:
        # Online before Gagesite kept fingerprints: adopt this one when nothing changed since.
        site = site_runner.site_path(project_id)
        newest = _tree_signature(site)[2] / 1e9
        if live_at and newest <= live_at.replace(tzinfo=live_at.tzinfo or __import__("datetime").timezone.utc).timestamp():
            with Session(engine) as session:
                row = session.get(Deployment, project_id)
                row.online_hash = now
                session.add(row)
                session.commit()
            return False
        return True
    return now != known


class DeployError(Exception):
    """Ends the job with a plain-language reason (already recorded on the failed step)."""


def read_plan(project_id: str) -> dict:
    raw = workspace.read_text(project_id, DEPLOY_JSON)
    try:
        return json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return {}


def service_settings(project_id: str, saved: dict) -> dict[str, str]:
    """"UI + dedicated API": the saved settings the API service reads (plan items with
    "part": "service", e.g. an email service key). Empty ones are left out: the API uses its defaults."""
    values = {}
    for item in read_plan(project_id).get("env", []):
        name = item.get("name") if isinstance(item, dict) else None
        if name and item.get("part") == "service" and saved.get(name):
            values[name] = str(saved[name])
    return values


def has_database(project_id: str) -> bool:
    try:
        return json.loads(workspace.read_text(project_id, SCHEMA_JSON) or "{}").get("mode") != "none"
    except json.JSONDecodeError:
        return True


def uses_logins(project_id: str) -> bool:
    package = site_runner.site_path(project_id) / "package.json"
    return package.exists() and '"next-auth"' in package.read_text(encoding="utf-8")


def production_schema(site: Path) -> str:
    """The website's Prisma schema for the live PostgreSQL database (it builds against SQLite)."""
    text = (site / "prisma" / "schema.prisma").read_text(encoding="utf-8")
    return re.sub(r'provider\s*=\s*"sqlite"', 'provider = "postgresql"', text)


def private_client_schema(schema: str) -> str:
    """The production schema, generating its database code next to itself (prisma/.production/client)."""
    return re.sub(r'(generator\s+client\s*\{)', r'\1\n  output = "./client"', schema, count=1)


def private_client_script(source: str) -> str:
    """production.ts, moved one folder down into prisma/.production and using the private client."""
    source = re.sub(r'(from\s+|import\s*\(\s*)(["\'])(\.\.?/)', r'\1\2../\3', source)
    return re.sub(r'(from\s+|import\s*\(\s*)(["\'])@prisma/client\2', r'\1\2./client\2', source)


def runtime_database_url(url: str) -> str:
    """Serverless functions open many short connections: tell Prisma when it goes through a pooler."""
    if ":6543/" in url and "pgbouncer=" not in url:
        url += ("&" if "?" in url else "?") + "pgbouncer=true&connection_limit=1"
    return url


def site_files(site: Path, schema: str | None) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    for root, dirs, names in os.walk(site):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith(".next"))
        for name in sorted(names):
            if SKIP_FILE.match(name) and name != ".env.example":
                continue
            path = Path(root) / name
            files[path.relative_to(site).as_posix()] = path.read_bytes()
    if schema is not None:
        files["prisma/schema.prisma"] = schema.encode()
    return files


class Job:
    def __init__(self, project_id: str, owner: dict | None) -> None:
        self.project_id = project_id
        self.owner = owner  # {"email", "name", "password"}: memory only
        self.site = site_runner.site_path(project_id)
        self.service = workspace.workspace_path(project_id) / SERVICE_DIR
        self.has_service = service_setup(project_id) is not None
        self.python_service = self.has_service and (self.service / "requirements.txt").exists()
        steps = list(STEPS)
        if self.has_service:
            steps.insert(2, SERVICE_STEP)
        self.steps = [{"key": k, "label": label, "status": "pending", "detail": ""} for k, label in steps]

    # ---- progress, recorded for the owner's screen ----
    def save(self, **fields) -> None:
        with Session(engine) as session:
            row = session.get(Deployment, self.project_id) or Deployment(project_id=self.project_id)
            row.steps = json.dumps(self.steps)
            for key, value in fields.items():
                setattr(row, key, value)
            session.add(row)
            session.commit()
        if fields.get("build_log"):
            # Gagesite reads this when the owner asks it to fix a failed attempt.
            (workspace.workspace_path(self.project_id) / DEPLOY_LOG).write_text(fields["build_log"], encoding="utf-8")

    def step(self, key: str, status: str, detail: str = "") -> None:
        for item in self.steps:
            if item["key"] == key:
                item["status"], item["detail"] = status, detail
        self.save()

    def fail(self, key: str, message: str, **fields) -> None:
        self.step(key, "failed", message)
        raise DeployError(message)

    # ---- the steps ----
    def run(self) -> None:
        self.save(status="running", error=None, build_log=None, started_at=utcnow(), finished_at=None)
        (workspace.workspace_path(self.project_id) / DEPLOY_LOG).unlink(missing_ok=True)
        try:
            with Session(engine) as session:
                gh = session.get(GitHubConnection, self.project_id)
                vc = session.get(VercelConnection, self.project_id)
                db = session.get(DatabaseConnection, self.project_id)
                row = session.get(Deployment, self.project_id)
                repo, gh_token = (gh.repo, secrets_store.decrypt(gh.encrypted_token)) if gh else (None, None)
                vc_token = secrets_store.decrypt(vc.encrypted_token) if vc else None
                db_url = secrets_store.decrypt(db.encrypted_url) if db else None
                known_project = row.vercel_project_id if row else None
                known_service = row.service_project_id if row else None
                was_offline = bool(row and row.offline_at)
                settings = json.loads(secrets_store.decrypt(row.encrypted_settings)) if row and row.encrypted_settings else {}
                auth_secret = secrets_store.decrypt(row.encrypted_auth_secret) if row and row.encrypted_auth_secret else None
            if not gh or not vc:
                raise DeployError("Connect GitHub and Vercel first.")

            fingerprint = online_fingerprint(self.project_id)
            self.push_code(repo, gh_token)
            schema = None
            if self.has_service:
                if not db_url:
                    self.fail("database", "Connect the database your API service will use first.")
                from . import api_server  # (imports this module)

                api_url = api_server.live_api_url(self.project_id)
                if api_url:  # the API already runs on the owner's own server: the website uses it there
                    self.step("database", "skipped", "Your API on your server prepares its own tables.")
                    self.step("service", "done", f"On your server: {api_url}")
                else:
                    service_schema = self.prepare_service_database(db_url)
                    api_url = self.deploy_service(vc_token, repo, known_service, db_url, service_schema, settings)
                values = {"API_URL": api_url, "NEXT_PUBLIC_API_URL": api_url, **self.settings(None, settings, None)}
            else:
                if has_database(self.project_id):
                    if not db_url:
                        self.fail("database", "Connect the database your website will use first.")
                    schema = self.prepare_database(db_url)
                else:
                    self.step("database", "skipped", "Your website has no database.")
                values = self.settings(db_url, settings, auth_secret)
            files = site_files(self.site, schema)
            self.step("upload", "running", f"{len(files)} files")
            try:
                project = vercel.ensure_project(vc_token, repo.split("/")[-1], known_project)
                self.save(vercel_project_id=project["id"], vercel_project_name=project["name"])
                if was_offline and project["id"] == known_project:  # taken offline earlier: online again
                    vercel.unpause(vc_token, project["id"])
                vercel.set_env(vc_token, project["id"], values)
                listed = vercel.upload(vc_token, files)
            except vercel.VercelError as exc:
                self.fail("upload", str(exc))
            self.step("upload", "done", f"{len(listed)} files uploaded")

            self.step("build", "running", "Usually 1 to 3 minutes")
            try:
                started = vercel.deploy(vc_token, project, listed)
                self.save(deployment_id=started["id"])
                result = vercel.wait(vc_token, started["id"])
            except vercel.VercelError as exc:
                self.fail("build", str(exc))
            if result.get("readyState") != "READY":
                log = vercel.build_log(vc_token, started["id"])
                self.save(build_log=log)
                self.fail("build", "Vercel couldn't build the website. Ask Gagesite to fix it, then try again.")
            self.step("build", "done")

            url = vercel.live_url(project, result)
            self.step("check", "running", url)
            if not self.answers(url):
                self.fail("check", "The website is online but its first page shows an error. Ask Gagesite to look at it.",
                          url=url)
            self.step("check", "done", url)
            self.save(status="live", url=url, live_at=utcnow(), finished_at=utcnow(), offline_at=None,
                      online_hash=fingerprint)
        except DeployError as exc:
            self.save(status="failed", error=str(exc), finished_at=utcnow())
        except Exception as exc:  # never leave the owner's screen stuck on "running"
            running = next((s["key"] for s in self.steps if s["status"] == "running"), "check")
            self.step(running, "failed", "Something unexpected went wrong.")
            self.save(status="failed", error=f"Something unexpected went wrong ({type(exc).__name__}). Try again.",
                      finished_at=utcnow())

    def push_code(self, repo: str, token: str) -> None:
        self.step("code", "running", repo)
        try:
            pushed = github.push(self.site, repo, token, "Gagesite: going online")
            if self.has_service:  # the API service in its own repository, e.g. me/shop-api
                service_repo = github.connect(f"{repo}-api", token)["repo"]
                github.push(self.service, service_repo, token, "Gagesite: going online")
        except github.GitHubError as exc:
            self.fail("code", str(exc))
        with Session(engine) as session:
            connection = session.get(GitHubConnection, self.project_id)
            if connection:
                connection.last_push_at, connection.last_commit, connection.last_error = utcnow(), pushed["commit"], None
                session.add(connection)
                session.commit()
        self.step("code", "done", f"{repo} @ {pushed['commit']}")

    def npx(self, *args: str, env: dict[str, str], timeout: int = 300) -> subprocess.CompletedProcess:
        return subprocess.run([shutil.which("npx") or "npx", *args], cwd=self.site, env={**os.environ, **env},
                              capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)

    def prepare_database(self, db_url: str) -> str:
        """Creates the website's tables in the owner's database, then adds the real content and
        the owner's first account. Returns the schema the live website is built with.

        Everything for the live database happens in a temporary folder with its own copy of the
        database code: the preview's copy in node_modules stays untouched (on Windows it is locked
        while the preview runs), so the preview keeps working throughout."""
        self.step("database", "running", "Creating the tables your website needs")
        schema = production_schema(self.site)
        folder = self.site / PRODUCTION_DIR
        shutil.rmtree(folder, ignore_errors=True)
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "schema.prisma").write_text(private_client_schema(schema), encoding="utf-8")
        schema_arg = f"{PRODUCTION_DIR}/schema.prisma"
        env = {"DATABASE_URL": db_url}
        try:
            pushed = self.npx("prisma", "db", "push", "--schema", schema_arg, "--skip-generate", env=env)
            if pushed.returncode != 0:
                output = (pushed.stdout + pushed.stderr).lower()
                if "data loss" in output or "will be lost" in output:
                    self.fail("database", "Your database already has tables that differ from the website's, and changing "
                                          "them would delete data. Nothing was changed. Ask Gagesite how to bring them together.")
                if "p1001" in output or "can't reach" in output or "timed out" in output:
                    self.fail("database", "Your database couldn't be reached. Check it's running, then try again.")
                if "p1000" in output or "authentication" in output:
                    self.fail("database", "Your database refused the password. Connect it again with the current one.")
                self.fail("database", "Your database's tables couldn't be created. Ask Gagesite to look at it.")
            if (self.site / PRODUCTION_SCRIPT).exists():
                self.step("database", "running", "Adding your content" + (" and your account" if self.owner else ""))
                generated = self.npx("prisma", "generate", "--schema", schema_arg, env=env)
                if generated.returncode != 0:
                    self.save(build_log=self.clean(generated.stdout + generated.stderr, env))
                    self.fail("database", "The website's database code couldn't be prepared. Ask Gagesite to look at it.")
                script = folder / Path(PRODUCTION_SCRIPT).name
                script.write_text(private_client_script((self.site / PRODUCTION_SCRIPT).read_text(encoding="utf-8")),
                                  encoding="utf-8")
                owner_env = {"OWNER_EMAIL": self.owner["email"], "OWNER_NAME": self.owner.get("name") or "",
                             "OWNER_PASSWORD": self.owner["password"]} if self.owner else {}
                filled = self.npx("tsx", script.relative_to(self.site).as_posix(), env={**env, **owner_env})
                if filled.returncode != 0:
                    self.save(build_log=self.clean(filled.stdout + filled.stderr, {**env, **owner_env}))
                    self.fail("database", "Adding your content to the database failed. Ask Gagesite to fix it, then try again.")
                if self.owner:
                    self.save(first_account_email=self.owner["email"])
            self.step("database", "done", "Tables ready" + (", your account created" if self.owner else ""))
            return schema
        finally:
            shutil.rmtree(folder, ignore_errors=True)

    # ---- "UI + dedicated API" ----
    def run_in_service(self, command: list[str], env: dict[str, str], timeout: int = 300) -> subprocess.CompletedProcess:
        return subprocess.run(command, cwd=self.service, env={**os.environ, **env, "PYTHONIOENCODING": "utf-8"},
                              capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)

    def prepare_service_database(self, db_url: str) -> str | None:
        """Creates the service's tables in the owner's database and its first account.
        Returns the TypeScript service's production Prisma schema (None for Python)."""
        self.step("database", "running", "Creating the tables your API service needs")
        owner_env = {"OWNER_EMAIL": self.owner["email"], "OWNER_NAME": self.owner.get("name") or "",
                     "OWNER_PASSWORD": self.owner["password"]} if self.owner else {}
        env = {"DATABASE_URL": db_url}
        if self.python_service:
            python = str(self.service / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python"))
            made = self.run_in_service([python, "scripts/db.py"], env)
            if made.returncode != 0:
                self.save(build_log=self.clean(made.stdout + made.stderr, env))
                self.fail("database", "Your API service's tables couldn't be created. Ask Gagesite to look at it.")
            if (self.service / "scripts" / "production.py").exists():
                filled = self.run_in_service([python, "scripts/production.py"], {**env, **owner_env})
                if filled.returncode != 0:
                    self.save(build_log=self.clean(filled.stdout + filled.stderr, {**env, **owner_env}))
                    self.fail("database", "Adding your content to the database failed. Ask Gagesite to fix it.")
            schema = None
        else:
            # The same safe route as the website's own database, run from the service's folder.
            site, self.site = self.site, self.service
            try:
                schema = self.prepare_database(db_url)
            finally:
                self.site = site
            return schema
        if self.owner:
            self.save(first_account_email=self.owner["email"])
        self.step("database", "done", "Tables ready" + (", your account created" if self.owner else ""))
        return schema

    def deploy_service(self, token: str, repo: str, known_id: str | None, db_url: str, schema: str | None,
                       saved: dict) -> str:
        """Puts the API service online on its own Vercel project; returns its live address."""
        self.step("service", "running", "Uploading your API service")
        if "SERVICE_JWT_SECRET" not in saved:
            saved["SERVICE_JWT_SECRET"] = secrets.token_urlsafe(32)
            self.save(encrypted_settings=secrets_store.encrypt(json.dumps(saved)))
        website_name = vercel.project_name(repo.split("/")[-1])
        values = {
            "DATABASE_URL": runtime_database_url(db_url),
            "SERVICE_JWT_SECRET": saved["SERVICE_JWT_SECRET"],
            "ALLOWED_ORIGINS": f"https://{website_name}.vercel.app",
            **service_settings(self.project_id, saved),
        }
        files = site_files(self.service, schema)
        files = {k: v for k, v in files.items() if not k.startswith((".venv/", "__pycache__/")) and "/__pycache__/" not in k}
        try:
            project = vercel.ensure_project(token, f"{repo.split('/')[-1]}-api", known_id, framework=None)
            self.save(service_project_id=project["id"])
            vercel.set_env(token, project["id"], values)
            listed = vercel.upload(token, files)
            started = vercel.deploy(token, project, listed, framework=None)
            result = vercel.wait(token, started["id"])
        except vercel.VercelError as exc:
            self.fail("service", str(exc))
        if result.get("readyState") != "READY":
            self.save(build_log=vercel.build_log(token, started["id"]))
            self.fail("service", "Vercel couldn't build your API service. Ask Gagesite to fix it, then try again.")
        url = vercel.live_url(project, result)
        if not self.answers(url + "/health"):
            self.fail("service", "Your API service is online but doesn't answer. Ask Gagesite to look at it.")
        self.save(service_url=url)
        self.step("service", "done", url)
        return url

    @staticmethod
    def clean(text: str, secret_env: dict[str, str]) -> str:
        for value in secret_env.values():
            if value:
                text = text.replace(value, "•••")
        return "\n".join(text.strip().splitlines()[-60:])

    def settings(self, db_url: str | None, saved: dict, auth_secret: str | None) -> dict[str, str]:
        """Everything the live website reads from its environment."""
        values: dict[str, str] = {}
        if db_url and has_database(self.project_id):
            values["DATABASE_URL"] = runtime_database_url(db_url)
        if uses_logins(self.project_id):
            if not auth_secret:
                auth_secret = secrets.token_urlsafe(32)
                self.save(encrypted_auth_secret=secrets_store.encrypt(auth_secret))
            values.update({"AUTH_SECRET": auth_secret, "NEXTAUTH_SECRET": auth_secret, "AUTH_TRUST_HOST": "true"})
        for item in read_plan(self.project_id).get("env", []):
            name = item.get("name") if isinstance(item, dict) else None
            if not name or name in values:
                continue
            if item.get("source") == "generated":
                if name not in saved:
                    saved[name] = secrets.token_urlsafe(32)
                    self.save(encrypted_settings=secrets_store.encrypt(json.dumps(saved)))
                values[name] = saved[name]
            elif saved.get(name):
                values[name] = saved[name]
        from . import project_keys

        for key in project_keys.declared(self.project_id):  # Keys & settings (e.g. a model's key)
            if key["name"] not in values and saved.get(key["name"]):
                values[key["name"]] = saved[key["name"]]
        return values

    @staticmethod
    def answers(url: str) -> bool:
        for _ in range(6):
            try:
                urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Gagesite"}), timeout=30)
                return True
            except urllib.error.HTTPError as exc:
                if exc.code < 500:
                    return True  # e.g. a login page that answers 401/404 on its own: the site is up
            except Exception:
                pass
            threading.Event().wait(10)
        return False


_active: set[str] = set()
_active_lock = threading.Lock()


def start(project_id: str, owner: dict | None) -> bool:
    """Starts the job in the background; False when this website is already going online."""
    with _active_lock:
        if project_id in _active:
            return False
        _active.add(project_id)

    def work() -> None:
        try:
            Job(project_id, owner).run()
        finally:
            with _active_lock:
                _active.discard(project_id)

    threading.Thread(target=work, daemon=True).start()
    return True
