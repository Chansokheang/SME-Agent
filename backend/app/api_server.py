"""Stage 5, "UI + dedicated API": the API service on a server the owner controls, in Docker.

Only the API goes there. The API uses the database the owner connected in Stage 2. After that,
every change Gagesite makes to the API is put online by itself (when the owner leaves "update
automatically" on): Gagesite compares the code with what is online and runs the same steps again.

Targets:
- this_pc: Docker on the computer running Gagesite, to try it. The API answers on
  http://localhost:<port> only (not the local network).
- ssh: the owner's own server, reached with Gagesite's own SSH key. The API listens on the server
  itself only (127.0.0.1:<port>); a Cloudflare quick tunnel next to it gives it a public HTTPS
  address with no open ports and no account. The tunnel is never restarted by an update, so the
  address stays the same; when the server restarts, the address changes and Gagesite notices
  (watch_tunnels), saves the new one and points the live website at it.

Secrets (the database address, the token-signing secret): on this computer they travel only
through the environment of the docker commands; on the owner's server they are in one file only
the owner's user can read (~/gagesite/<project>/.env), sent over SSH's encrypted channel. Never a
command line, a file in the workspace or a log.
"""

import hashlib
import json
import os
import re
import secrets
import shlex
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

from sqlmodel import Session, select

from . import project_keys, secrets_store, site_runner, smoke, vercel, workspace
from .config import settings
from .db import ApiServer, DatabaseConnection, Deployment, VercelConnection, engine, utcnow
from .deploy_runner import SERVICE_DIR, production_schema, runtime_database_url, service_settings, service_setup, site_files
from .server_ssh import Server, SshError

SERVERS_DIR = settings.data_dir / "api-servers"
INNER_PORT = 8000  # the port the API listens on inside its container (see the starters' Dockerfile)
TARGETS = ("this_pc", "ssh")
DEFAULT_PORT = {"this_pc": 4800, "ssh": 9020}
TUNNEL_IMAGE = "cloudflare/cloudflared:latest"
TUNNEL_URL = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")
STEPS = [
    ("files", "Copy your API's code"),
    ("build", "Build your API"),
    ("database", "Prepare its tables in your database"),
    ("account", "Create your first login"),
    ("start", "Start your API"),
    ("check", "Check it answers"),
    ("smoke", "Test its main addresses"),
]
WEBSITE_STEP = ("website", "Point your website at it")
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
LOCAL_HOSTS = re.compile(r"@(localhost|127\.0\.0\.1|\[::1\])(?=[:/?]|$)")

_active: set[str] = set()
_lock = threading.Lock()


class StepFailed(Exception):
    """Ends the job with a plain-language reason (already recorded on the failed step)."""


def service_folder(project_id: str) -> Path:
    return workspace.workspace_path(project_id) / SERVICE_DIR


def is_python(project_id: str) -> bool:
    return (service_folder(project_id) / "requirements.txt").exists()


def code_files(project_id: str) -> dict[str, bytes]:
    """The API's code as it goes online: what Vercel would get, without local environments."""
    folder = service_folder(project_id)
    schema = None if is_python(project_id) else production_schema(folder)
    files = site_files(folder, schema)
    return {k: v for k, v in files.items()
            if not k.startswith((".venv/", "__pycache__/")) and "/__pycache__/" not in k}


def with_dockerfile(project_id: str, files: dict[str, bytes]) -> dict[str, bytes]:
    """The starter's Dockerfile when the API was made before the starters had one."""
    starter = site_runner.SERVICE_TEMPLATES["python" if is_python(project_id) else "typescript"]
    extra = {name: (starter / name).read_bytes() for name in ("Dockerfile", ".dockerignore") if name not in files}
    return {**files, **extra}


def account_script(project_id: str) -> str | None:
    """The API's production script (written by Stage 5 "Get it ready"): it creates the owner's first
    account from OWNER_EMAIL / OWNER_NAME / OWNER_PASSWORD when it's missing. None when not written."""
    if is_python(project_id):
        return "scripts/production.py" if (service_folder(project_id) / "scripts" / "production.py").exists() else None
    return "prisma/production.ts" if (service_folder(project_id) / "prisma" / "production.ts").exists() else None


def owner_login(project_id: str) -> dict:
    """The first login: the one the live website uses (made once, kept encrypted), else a new one with
    the preview's admin email and a strong password, saved so Stage 5 can show it."""
    login = project_keys.first_login(project_id)
    if not login:
        login = {"email": project_keys.planned_login_email(project_id, "admin"), "name": "Owner",
                 "password": project_keys.new_password()}
        project_keys.save_first_login(project_id, login)
    return login


def code_hash(files: dict[str, bytes]) -> str:
    digest = hashlib.sha256()
    for name in sorted(files):
        digest.update(name.encode() + b"\0" + hashlib.sha256(files[name]).digest())
    return digest.hexdigest()


def compose_name(project_id: str) -> str:
    return f"gagesite-api-{project_id.lower()}"


def compose_file(project_id: str, port: int, target: str) -> str:
    name = compose_name(project_id)
    if target == "this_pc":
        # Values come from the docker command's environment (never written here). Reachable from
        # this computer only; host.docker.internal reaches a database running on it.
        return f"""# Made by Gagesite: your API, running in Docker.
name: {name}
services:
  api:
    build:
      context: ./app
      network: host
    image: {name}
    restart: unless-stopped
    environment:
      - DATABASE_URL
      - SERVICE_JWT_SECRET
      - ALLOWED_ORIGINS
    ports:
      - "127.0.0.1:{port}:{INNER_PORT}"
    extra_hosts:
      - "host.docker.internal:host-gateway"
"""
    # The owner's server: the API on the server itself only; the tunnel reaches it inside Docker's
    # own network and gives it its public HTTPS address. Updates rebuild "api" only.
    # The tunnel uses HTTP/2 over TCP 443: many networks block QUIC (UDP), its default.
    # The build uses the server's own network: on some servers Docker's default network can't look
    # up addresses (it inherits a DNS server only the host reaches), so installing packages fails.
    return f"""# Made by Gagesite: your API, running in Docker, online through a Cloudflare tunnel.
name: {name}
services:
  api:
    build:
      context: ./app
      network: host
    image: {name}
    restart: unless-stopped
    env_file: .env
    ports:
      - "127.0.0.1:{port}:{INNER_PORT}"
  tunnel:
    image: {TUNNEL_IMAGE}
    restart: unless-stopped
    command: tunnel --no-autoupdate --protocol http2 --url http://api:{INNER_PORT}
"""


def runtime_url(url: str, python: bool, target: str) -> str:
    """The Stage 2 database as the API's container sees it. On this computer, a database running on
    it is reached through host.docker.internal (inside a container, "localhost" is the container)."""
    if target == "this_pc":
        url = LOCAL_HOSTS.sub("@host.docker.internal", url)
    return url if python else runtime_database_url(url)


def saved_service_settings(project_id: str) -> dict[str, str]:
    """The settings the owner saved in Stage 5 that the API reads (an email service key...)."""
    with Session(engine) as session:
        row = session.get(Deployment, project_id)
        saved = json.loads(secrets_store.decrypt(row.encrypted_settings)) if row and row.encrypted_settings else {}
    # A value with a quote or a line break can't go in the server's settings file safely: left out.
    return {k: v for k, v in service_settings(project_id, saved).items() if "'" not in v and chr(10) not in v}


def allowed_origins(project_id: str) -> str:
    """The website's addresses that may call the API from a browser: the live website, and the
    preview on this computer."""
    origins = []
    with Session(engine) as session:
        row = session.get(Deployment, project_id)
        if row and row.url:
            origins.append(row.url.rstrip("/"))
    # The preview takes the first free port from 3100 each time it starts, so any of the first few.
    preview_port = (workspace.read_text(project_id, site_runner.PREVIEW_PORT_FILE) or "").strip()
    if preview_port.isdigit():
        origins.append(f"http://localhost:{preview_port}")
    origins += [f"http://localhost:{site_runner.FIRST_PORT + n}" for n in range(10)]
    return ",".join(dict.fromkeys(origins))


def answers(url: str, tries: int = 30) -> bool:
    for _ in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=8) as response:
                if response.status < 500:
                    return True
        except urllib.error.HTTPError as exc:
            if exc.code < 500:
                return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(2)
    return False


# ---- where the docker commands run ----
class ThisPc:
    def __init__(self, project_id: str) -> None:
        self.folder = SERVERS_DIR / project_id
        self.env: dict[str, str] = {}

    def __enter__(self) -> "ThisPc":
        try:
            ready = subprocess.run(["docker", "info", "--format", "{{.ServerVersion}}"], capture_output=True,
                                   timeout=20, creationflags=NO_WINDOW).returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            ready = False
        if not ready:
            raise SshError("Docker isn't running on this computer. Start Docker Desktop, then try again.")
        return self

    def __exit__(self, *exc) -> None:
        pass

    def put(self, files: dict[str, bytes], compose: str, env: dict[str, str]) -> None:
        app = self.folder / "app"
        shutil.rmtree(app, ignore_errors=True)
        for name, data in files.items():
            path = app / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        (self.folder / "compose.yml").write_text(compose, encoding="utf-8")
        self.env = env

    def compose(self, *args: str, timeout: int = 900, extra_env: dict[str, str] | None = None) -> tuple[int, str]:
        done = subprocess.run(["docker", "compose", "-f", "compose.yml", *args], cwd=self.folder,
                              env={**os.environ, **self.env, **(extra_env or {})}, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=timeout, creationflags=NO_WINDOW)
        return done.returncode, done.stdout + done.stderr

    def down(self) -> None:
        if (self.folder / "compose.yml").exists():
            self.compose("down", timeout=180)


class OwnServer:
    def __init__(self, project_id: str) -> None:
        self.server = Server(project_id)
        self.folder = f"gagesite/{project_id}"

    def __enter__(self) -> "OwnServer":
        self.server.__enter__()
        code, output = self.server.run("docker compose version --short", timeout=60)
        if code != 0:
            self.server.__exit__()
            raise SshError(f"Docker Compose doesn't work for {self.server.user} on your server. Install Docker "
                           f"and add {self.server.user} to the docker group, then try again.")
        return self

    def __exit__(self, *exc) -> None:
        self.server.__exit__()

    def put(self, files: dict[str, bytes], compose: str, env: dict[str, str]) -> None:
        self.server.put_files(f"{self.folder}/app", files)
        folder = shlex.quote(self.folder)
        code, output = self.server.run(f"cat > {folder}/compose.yml", stdin=compose)
        if code != 0:
            raise SshError(f"Gagesite couldn't write to ~/{self.folder} on your server: {output.strip()[-300:]}")
        # Only the owner's user can read it; single quotes keep values exactly as they are.
        lines = "".join(f"{key}='{value}'\n" for key, value in env.items())
        code, output = self.server.run(f"umask 077 && cat > {folder}/.env && chmod 600 {folder}/.env", stdin=lines)
        if code != 0:
            raise SshError("Gagesite couldn't save your API's settings on your server.")

    def compose(self, *args: str, timeout: int = 900, extra_env: dict[str, str] | None = None) -> tuple[int, str]:
        command = f"cd {shlex.quote(self.folder)} && docker compose -f compose.yml " + " ".join(map(shlex.quote, args))
        if not extra_env:
            return self.server.run(command, timeout=timeout)
        # Secret values arrive on stdin (one per line, in order) and are exported for this command only.
        names = list(extra_env)
        reads = " && ".join(f"IFS= read -r {n} && export {n}" for n in names)
        return self.server.run(f"{reads} && {command}", stdin="".join(extra_env[n] + "\n" for n in names),
                               timeout=timeout)

    def tunnel_url(self, wait: int = 90) -> str | None:
        """The tunnel's public address (the latest one it printed)."""
        deadline = time.time() + wait
        while time.time() < deadline:
            _, output = self.compose("logs", "--no-log-prefix", "tunnel", timeout=60)
            found = TUNNEL_URL.findall(output)
            if found:
                return found[-1]
            time.sleep(3)
        return None

    def down(self) -> None:
        code, _ = self.server.run(f"test -f {shlex.quote(self.folder)}/compose.yml", timeout=30)
        if code == 0:
            self.compose("down", timeout=180)


def place(project_id: str, target: str):
    return OwnServer(project_id) if target == "ssh" else ThisPc(project_id)


# ---- the live website follows the API's address ----
def point_website(project_id: str, api_url: str) -> str | None:
    """Gives the live website (on Vercel) the API's new address and rebuilds it with it.
    Returns a plain-language problem, or None when done (or when the website isn't online)."""
    with Session(engine) as session:
        row = session.get(Deployment, project_id)
        connection = session.get(VercelConnection, project_id)
        if not row or row.status != "live" or not row.vercel_project_id or not row.deployment_id or not connection:
            return None
        token = secrets_store.decrypt(connection.encrypted_token)
        project = {"id": row.vercel_project_id, "name": row.vercel_project_name or row.vercel_project_id}
        deployment_id = row.deployment_id
    try:
        vercel.set_env(token, project["id"], {"API_URL": api_url, "NEXT_PUBLIC_API_URL": api_url})
        started = vercel.redeploy(token, project, deployment_id)
        result = vercel.wait(token, started["id"])
    except vercel.VercelError as exc:
        return f"Your website couldn't be given the API's new address: {exc}"
    if result.get("readyState") != "READY":
        return "Vercel couldn't rebuild your website with the API's new address. Try Update now."
    from .deploy_runner import online_fingerprint

    with Session(engine) as session:
        row = session.get(Deployment, project_id)
        row.deployment_id = started["id"]
        if row.online_hash:  # the website online now has the new address: nothing new is waiting for it
            row.online_hash = online_fingerprint(project_id)
        session.add(row)
        session.commit()
    return None


def website_live(project_id: str) -> bool:
    with Session(engine) as session:
        row = session.get(Deployment, project_id)
        return bool(row and row.status == "live" and row.vercel_project_id)


class Job:
    def __init__(self, project_id: str, reason: str) -> None:
        self.project_id = project_id
        self.reason = reason
        steps = list(STEPS)
        if website_live(project_id):
            steps.append(WEBSITE_STEP)
        self.steps = [{"key": k, "label": label, "status": "pending", "detail": ""} for k, label in steps]
        self.secrets: list[str] = []

    # ---- progress, recorded for the owner's screen ----
    def save(self, **fields) -> None:
        with Session(engine) as session:
            row = session.get(ApiServer, self.project_id) or ApiServer(project_id=self.project_id)
            row.steps = json.dumps(self.steps)
            for key, value in fields.items():
                setattr(row, key, value)
            session.add(row)
            session.commit()

    def step(self, key: str, status: str, detail: str = "") -> None:
        for item in self.steps:
            if item["key"] == key:
                item["status"], item["detail"] = status, detail
        self.save()

    def fail(self, key: str, message: str, output: str = "") -> None:
        if output:
            self.save(log=self.clean(output)[-6000:])
        self.step(key, "failed", message)
        raise StepFailed(message)

    def clean(self, text: str) -> str:
        for value in self.secrets:
            if value:
                text = text.replace(value, "•••")
        return text

    # ---- the steps ----
    def run(self) -> None:
        self.save(status="running", error=None, log=None, reason=self.reason, started_at=utcnow(), finished_at=None)
        try:
            with Session(engine) as session:
                row = session.get(ApiServer, self.project_id)
                connection = session.get(DatabaseConnection, self.project_id)
                target, port, previous_url = row.target, row.port, row.url
                secret = secrets_store.decrypt(row.encrypted_secret) if row.encrypted_secret else None
                db_url = secrets_store.decrypt(connection.encrypted_url) if connection else None
            if not db_url:
                self.fail("files", "Connect your database in Stage 2 first: your API keeps its data there.")
            if target == "ssh" and LOCAL_HOSTS.search(db_url):
                self.fail("files", "Your database is on this computer, which your server can't reach. Connect a "
                                   "database your server can reach in Stage 2 (Supabase or Neon, for example).")
            if not secret:
                secret = secrets.token_urlsafe(32)
                self.save(encrypted_secret=secrets_store.encrypt(secret))
            python = is_python(self.project_id)
            env = {
                "DATABASE_URL": runtime_url(db_url, python, target),
                "SERVICE_JWT_SECRET": secret,
                "ALLOWED_ORIGINS": allowed_origins(self.project_id),
                **saved_service_settings(self.project_id),
            }
            self.secrets = [env["DATABASE_URL"], secret, db_url, *saved_service_settings(self.project_id).values()]

            self.step("files", "running", "Connecting to your server" if target == "ssh" else "")
            try:
                place_ = place(self.project_id, target).__enter__()
            except SshError as exc:
                self.fail("files", str(exc))
            try:
                url = self.steps_on(place_, target, port, env, python)
            finally:
                place_.__exit__(None, None, None)

            if any(s["key"] == "website" for s in self.steps):
                if url == previous_url:
                    self.step("website", "skipped", "Same address as before: nothing to change")
                else:
                    self.step("website", "running", "Vercel rebuilds your website: 1 to 3 minutes")
                    problem = point_website(self.project_id, url)
                    if problem:
                        self.fail("website", problem)
                    self.step("website", "done", url)
            self.save(status="live", finished_at=utcnow())
        except StepFailed as exc:
            self.save(status="failed", error=str(exc), finished_at=utcnow())
        except Exception as exc:  # never leave the owner's screen stuck on "running"
            running = next((s["key"] for s in self.steps if s["status"] == "running"), "check")
            self.step(running, "failed", "Something unexpected went wrong.")
            self.save(status="failed", error=f"Something unexpected went wrong ({type(exc).__name__}). Try again.",
                      finished_at=utcnow())

    def steps_on(self, where, target: str, port: int, env: dict[str, str], python: bool) -> str:
        """Copy, build, tables, start, check. Returns the API's address."""
        files = code_files(self.project_id)
        try:
            where.put(with_dockerfile(self.project_id, files), compose_file(self.project_id, port, target), env)
        except SshError as exc:
            self.fail("files", str(exc))
        self.step("files", "done", f"{len(files)} files")

        # The first time installs everything: a few minutes.
        self.step("build", "running", "The first time takes a few minutes")
        code, output = where.compose("build", "api")
        if code != 0:
            self.fail("build", "Your API couldn't be built. Ask Gagesite to look at it.", output)
        self.step("build", "done")

        # Missing tables in the Stage 2 database, created from inside the new image.
        self.step("database", "running", "Creating the tables your API needs")
        command = ["python", "scripts/db.py"] if python else ["npx", "prisma", "db", "push", "--skip-generate"]
        code, output = where.compose("run", "--rm", "--no-deps", "-T", "api", *command, timeout=300)
        if code != 0:
            low = output.lower()
            if "data loss" in low or "will be lost" in low:
                self.fail("database", "Your database already has tables that differ from your API's, and changing them "
                                      "would delete data. Nothing was changed. Ask Gagesite how to bring them together.",
                          output)
            if any(k in low for k in ("could not connect", "connection refused", "timeout", "p1001", "can't reach")):
                self.fail("database", "Your database couldn't be reached from your API. Check it's running, then try "
                                      "again.", output)
            if "password authentication" in low or "p1000" in low:
                self.fail("database", "Your database refused the password. Connect it again in Stage 2.", output)
            self.fail("database", "Your API's tables couldn't be created. Ask Gagesite to look at it.", output)
        self.step("database", "done", "Tables ready")

        # The first login, created by the API's own production script only when it's missing (so an
        # update never changes it, and a password changed by the owner stays changed).
        script = account_script(self.project_id)
        if not script:
            self.step("account", "skipped", "Gagesite hasn't written the script that makes it yet")
        else:
            self.step("account", "running")
            login = owner_login(self.project_id)
            self.secrets.append(login["password"])
            command = ["python", script] if python else ["npx", "tsx", script]
            owner = ["-e", f"OWNER_EMAIL={login['email']}", "-e", f"OWNER_NAME={login.get('name') or 'Owner'}",
                     "-e", "OWNER_PASSWORD"]
            code, output = where.compose("run", "--rm", "--no-deps", "-T", *owner, "api", *command, timeout=300,
                                         extra_env={"OWNER_PASSWORD": login["password"]})
            if code != 0:
                self.fail("account", "Your first login couldn't be created. Ask Gagesite to look at it.", output)
            self.save(first_account_email=login["email"])
            self.step("account", "done", login["email"])

        # Replaces the running version (a few seconds without answers); the tunnel keeps running.
        self.step("start", "running")
        code, output = where.compose("up", "-d", "--remove-orphans", timeout=300)
        if code != 0:
            if "port is already allocated" in output or "address already in use" in output.lower():
                self.fail("start", f"Port {port} is already used by something else. Pick another port, then try "
                                   "again.", output)
            self.fail("start", "Your API couldn't be started. Ask Gagesite to look at it.", output)
        self.step("start", "done")

        if target == "ssh":
            self.step("check", "running", "Waiting for its public address")
            url = where.tunnel_url()
            if not url:
                _, logs = where.compose("logs", "--tail", "60", "tunnel", timeout=60)
                self.fail("check", "Your API is running, but its public address didn't come up. Try again in a "
                                   "minute.", logs)
        else:
            url = f"http://localhost:{port}"
        self.step("check", "running", url)
        if not answers(url + "/health", tries=45):
            _, logs = where.compose("logs", "--tail", "80", "api", timeout=60)
            self.fail("check", "Your API started but doesn't answer. Ask Gagesite to look at it.", logs)
        self.step("check", "done", url)
        self.save(url=url, files_hash=code_hash(files), live_at=utcnow())

        # Read-only test of the live address from the outside (never changes data). A failure is
        # reported, but the API stays online: it's the new version, already answering.
        self.step("smoke", "running", "Signing in and reading each address")
        login = project_keys.first_login(self.project_id) if script else None
        result = smoke.run(url, login)
        self.save(smoke=json.dumps(result))
        failed = [c for c in result["checks"] if not c["ok"]]
        summary = f"{result['passed']} of {result['total']} checks passed"
        if failed:
            self.step("smoke", "failed", summary)
            self.save(log=chr(10).join(f"{c['name']}: {c['status'] or 'no answer'} {c['detail']}" for c in failed))
        else:
            self.step("smoke", "done", summary + ("" if result["signed_in"] else " (not signed in: no first login yet)"))
        return url


def ensure_ssh_key(project_id: str) -> str:
    """Gagesite's own SSH key for this project's server (made once): returns the public half, which
    the owner adds to the server's ~/.ssh/authorized_keys. The private half stays encrypted here."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    with Session(engine) as session:
        row = session.get(ApiServer, project_id) or ApiServer(project_id=project_id)
        if not row.ssh_public_key or not row.encrypted_ssh_key:
            key = Ed25519PrivateKey.generate()
            private = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.OpenSSH,
                                        serialization.NoEncryption()).decode()
            public = key.public_key().public_bytes(serialization.Encoding.OpenSSH,
                                                   serialization.PublicFormat.OpenSSH).decode()
            row.ssh_public_key = f"{public} gagesite-{project_id}"
            row.encrypted_ssh_key = secrets_store.encrypt(private)
            session.add(row)
            session.commit()
        return row.ssh_public_key


def is_running(project_id: str) -> bool:
    with _lock:
        return project_id in _active


def start(project_id: str, reason: str = "owner") -> bool:
    """Puts the API (as it is now) on the server, in the background. False when already doing so."""
    with _lock:
        if project_id in _active:
            return False
        _active.add(project_id)

    def work() -> None:
        try:
            Job(project_id, reason).run()
        finally:
            with _lock:
                _active.discard(project_id)

    threading.Thread(target=work, daemon=True, name=f"api-server-{project_id}").start()
    return True


def stop(project_id: str) -> None:
    """Stops the API (and its tunnel) where it runs. Its data stays in the database."""
    with Session(engine) as session:
        row = session.get(ApiServer, project_id)
        target = row.target if row else "this_pc"
    with place(project_id, target) as where:
        where.down()


def needs_update(project_id: str, row: ApiServer | None) -> bool:
    if not row or not row.files_hash or service_setup(project_id) is None:
        return False
    return code_hash(code_files(project_id)) != row.files_hash


def after_change(project_id: str) -> bool:
    """After Gagesite finished changing the project: when the API is on a server, set to update by
    itself and its code differs from what is online, put the new version there."""
    try:
        with Session(engine) as session:
            row = session.get(ApiServer, project_id)
            wanted = bool(row and row.auto_update and row.status == "live" and needs_update(project_id, row))
        return wanted and start(project_id, "change")
    except Exception:  # never break the end of a build run over this
        return False


def live_api_url(project_id: str) -> str | None:
    """The API's public address on the owner's server, when it's there (Stage 5 then gives it to the
    website instead of putting a copy of the API on Vercel)."""
    with Session(engine) as session:
        row = session.get(ApiServer, project_id)
        return row.url if row and row.target == "ssh" and row.status == "live" and row.url else None


def check_tunnel(project_id: str) -> None:
    """When the API on the owner's server stops answering at its address (the server or the tunnel
    restarted), read the tunnel's new address, save it and point the live website at it."""
    with Session(engine) as session:
        row = session.get(ApiServer, project_id)
        if not row or row.target != "ssh" or row.status != "live" or not row.url:
            return
        url = row.url
    if is_running(project_id) or answers(url + "/health", tries=3):
        return
    try:
        with OwnServer(project_id) as where:
            fresh = where.tunnel_url(wait=30)
    except SshError:
        return
    if not fresh or fresh == url or not answers(fresh + "/health", tries=20):
        return
    with Session(engine) as session:
        row = session.get(ApiServer, project_id)
        row.url = fresh
        session.add(row)
        session.commit()
    problem = point_website(project_id, fresh)
    if problem:
        with Session(engine) as session:
            row = session.get(ApiServer, project_id)
            row.error = problem
            session.add(row)
            session.commit()


def watch_tunnels(every: int = 300) -> None:
    """Runs for as long as Gagesite does: every few minutes, checks each API on an owner's server."""

    def loop() -> None:
        while True:
            time.sleep(every)
            try:
                with Session(engine) as session:
                    ids = [r.project_id for r in session.exec(select(ApiServer)).all() if r.target == "ssh" and r.status == "live"]
                for project_id in ids:
                    check_tunnel(project_id)
            except Exception:
                pass

    threading.Thread(target=loop, daemon=True, name="api-tunnel-watch").start()


def view(project_id: str) -> dict:
    """What the owner's screen shows: never a secret."""
    with Session(engine) as session:
        row = session.get(ApiServer, project_id)
        connection = session.get(DatabaseConnection, project_id)
    running = is_running(project_id)
    status = row.status if row else "idle"
    if status == "running" and not running:  # Gagesite restarted mid-way
        status = "failed"
    target = row.target if row else "this_pc"
    shown = row and status in ("live", "running", "failed")
    return {
        "available": service_setup(project_id) is not None,
        "targets": list(TARGETS),
        "database": {"provider": connection.provider, "host": connection.host,
                     "database": connection.database} if connection else None,
        "target": target,
        "server": {"host": row.ssh_host, "ssh_port": row.ssh_port, "user": row.ssh_user,
                   "public_key": row.ssh_public_key, "connected": bool(row.ssh_host_key)} if row else None,
        "port": row.port if row else DEFAULT_PORT[target],
        "auto_update": row.auto_update if row else True,
        "status": status,
        "url": row.url if shown else None,
        "docs_url": f"{row.url}/docs" if shown and row.url else None,
        "website_live": website_live(project_id),
        "steps": json.loads(row.steps) if row else [],
        "error": row.error if row and status == "failed" else (
            "Gagesite was restarted while this was running. Try again." if row and row.status == "running" and not running
            else None),
        "log": row.log if row and status == "failed" else None,
        "reason": row.reason if row else None,
        "live_at": row.live_at if row else None,
        "finished_at": row.finished_at if row else None,
        "out_of_date": status == "live" and needs_update(project_id, row),
        # The first login: made (its email, the password shown on request), or not possible yet.
        "first_account_email": row.first_account_email if row else None,
        "account_script": account_script(project_id) is not None,
        "smoke": json.loads(row.smoke) if row and row.smoke else None,
    }
