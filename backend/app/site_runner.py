"""Stage 4's website: the starter template, the live preview and the page screenshots.

The generated website lives in <workspace>/site. Gagesite (the stage AI) writes its code;
this module copies the starter template in, runs `next dev` so the owner can try the site
while it is being built, and runs the website self-test (.claude/hooks/site_check.py: logs in
with the test accounts, opens every finished page, saves docs/04-screens/<slug>.jpg and
docs/04-check.json) after each of its turns.
"""

import importlib.util
import json
import os
import re
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

from .config import settings
from . import workspace

SITE_TEMPLATE = settings.pipeline_dir / "templates" / "site"
# "UI + dedicated API": the separate API service's starter, by language.
SERVICE_TEMPLATES = {"typescript": settings.pipeline_dir / "templates" / "service-ts",
                     "python": settings.pipeline_dir / "templates" / "service-py"}
SETUP_JSON = "docs/04-setup.json"
SERVICE_PORT_FILE = ".claude/service-port"
SERVICE_LOG_FILE = ".claude/service.log"
FIRST_SERVICE_PORT = 4100

# The same helper the self-test uses to run the API service (one place for both).
_spec = importlib.util.spec_from_file_location(
    "service_proc", settings.pipeline_dir / "templates" / "workspace" / ".claude" / "hooks" / "service_proc.py")
service_proc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(service_proc)
BUILD_JSON = "docs/04-build.json"
BUILD_MD = "docs/04-build.md"
SCREENS_DIR = "docs/04-screens"
CHECK_JSON = "docs/04-check.json"
# Where the self-test finds the running preview and its server output (see site_check.py).
PREVIEW_PORT_FILE = ".claude/preview-port"
PREVIEW_LOG_FILE = ".claude/preview.log"
FIRST_PORT = 3100


def site_path(project_id: str) -> Path:
    return workspace.workspace_path(project_id) / "site"


def read_setup(project_id: str) -> dict:
    raw = workspace.read_text(project_id, SETUP_JSON)
    try:
        return json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return {}


def ensure_site(project_id: str) -> None:
    """Copies the starter template into site/ on the first build, and keeps a local .env.
    With "UI + dedicated API", also the API service's starter into service/."""
    site = site_path(project_id)
    if not (site / "package.json").exists():
        shutil.copytree(SITE_TEMPLATE, site, dirs_exist_ok=True)
    # Sites started before the vetted motion effects existed get them too (never overwritten).
    effects = site / "src" / "components" / "effects"
    if not effects.exists() and (SITE_TEMPLATE / "src" / "components" / "effects").exists():
        shutil.copytree(SITE_TEMPLATE / "src" / "components" / "effects", effects)
    env = site / ".env"
    if not env.exists() and (site / ".env.example").exists():
        shutil.copy2(site / ".env.example", env)
    setup = read_setup(project_id)
    if setup.get("setup") == "api_service":
        ensure_service(project_id, setup.get("api_language") or "typescript")


def ensure_service(project_id: str, language: str) -> None:
    service = workspace.workspace_path(project_id) / "service"
    if not service_proc.exists(workspace.workspace_path(project_id)):
        shutil.copytree(SERVICE_TEMPLATES.get(language, SERVICE_TEMPLATES["typescript"]), service, dirs_exist_ok=True)
    env = service / ".env"
    if not env.exists() and (service / ".env.example").exists():
        # A local signing secret of its own, never the example's.
        text = (service / ".env.example").read_text(encoding="utf-8")
        env.write_text(re.sub(r'SERVICE_JWT_SECRET="[^"]*"', f'SERVICE_JWT_SECRET="{secrets.token_urlsafe(32)}"', text),
                       encoding="utf-8")


def page_slug(path: str) -> str:
    slug = re.sub(r"[\[\]]", "", path.strip("/")).replace("/", "-")
    return slug or "home"


def read_build(project_id: str) -> dict | None:
    raw = workspace.read_text(project_id, BUILD_JSON)
    try:
        return json.loads(raw) if raw else None
    except json.JSONDecodeError:
        return None


def npm_bin() -> str:
    return shutil.which("npm") or "npm"


@dataclass
class Preview:
    project_id: str
    port: int
    status: str = "starting"  # installing | building | starting | running | stopped | failed
    # "dev" while Gagesite works on the site (changes show at once); "production" once the build is
    # finished, so the owner reviews exactly what goes online (next build + next start).
    mode: str = "dev"
    process: subprocess.Popen | None = None
    # The separate API service ("UI + dedicated API"), started before the website.
    service: subprocess.Popen | None = None
    service_port: int = 0
    log: deque = field(default_factory=lambda: deque(maxlen=200))
    started_at: float = field(default_factory=time.time)

    @property
    def url(self) -> str:
        return f"http://localhost:{self.port}"


class PreviewManager:
    """One preview server per project, on its own port: `next dev` while the site is being built,
    the production build (`next build` + `next start`) once it is finished."""

    def __init__(self) -> None:
        self.previews: dict[str, Preview] = {}
        self.lock = threading.Lock()
        # Projects Gagesite is building right now: their preview stays in dev mode.
        self.working: set[str] = set()

    def wanted_mode(self, project_id: str) -> str:
        build = read_build(project_id) or {}
        return "production" if build.get("status") == "ready" and project_id not in self.working else "dev"

    def set_working(self, project_id: str, working: bool) -> None:
        """A build run starts (dev mode, so changes show at once) or ends (the finished site is
        previewed as its production build). A running preview in the other mode starts again."""
        if working:
            self.working.add(project_id)
        else:
            self.working.discard(project_id)
        current = self.get(project_id)
        if current and current.status in ("installing", "building", "starting", "running")                 and current.mode != self.wanted_mode(project_id):
            self.stop(project_id)
            self.start(project_id)

    def get(self, project_id: str) -> Preview | None:
        preview = self.previews.get(project_id)
        if preview and preview.process and preview.process.poll() is not None and preview.status in ("starting", "running"):
            preview.status = "failed" if preview.status == "starting" else "stopped"
        return preview

    def info(self, project_id: str) -> dict:
        preview = self.get(project_id)
        if not preview:
            return {"status": "stopped", "mode": self.wanted_mode(project_id), "url": None, "api_url": None, "log": []}
        running = preview.status == "running"
        return {
            "status": preview.status,
            "mode": preview.mode,
            "url": preview.url if running else None,
            # "UI + dedicated API": where its own API answers (its docs are at /docs), to try it directly.
            "api_url": f"http://localhost:{preview.service_port}" if running and preview.service_port else None,
            "log": list(preview.log)[-40:],
        }

    def _free_port(self) -> int:
        used = {p.port for p in self.previews.values() if p.status not in ("stopped", "failed")}
        port = FIRST_PORT
        while True:
            if port not in used:
                with socket.socket() as probe:
                    if probe.connect_ex(("127.0.0.1", port)) != 0:
                        return port
            port += 1

    def restart_if_running(self, project_id: str) -> None:
        """After the owner changes a key: a running preview starts again with the new values."""
        current = self.get(project_id)
        if current and current.status in ("installing", "building", "starting", "running"):
            self.stop(project_id)
            self.start(project_id)

    def start(self, project_id: str) -> dict:
        with self.lock:
            current = self.get(project_id)
            if current and current.status in ("installing", "building", "starting", "running"):
                return self.info(project_id)
            ensure_site(project_id)
            preview = Preview(project_id=project_id, port=self._free_port(), mode=self.wanted_mode(project_id))
            self.previews[project_id] = preview
        threading.Thread(target=self._run, args=(preview,), daemon=True).start()
        return self.info(project_id)

    def _pump(self, preview: Preview, stream) -> None:
        log_path = workspace.workspace_path(preview.project_id) / PREVIEW_LOG_FILE
        with open(log_path, "w", encoding="utf-8", errors="replace") as log:
            for line in stream:
                preview.log.append(line.rstrip())
                log.write(line)
                log.flush()

    def _ready(self, preview: Preview) -> None:
        preview.status = "running"
        (workspace.workspace_path(preview.project_id) / PREVIEW_PORT_FILE).write_text(str(preview.port))

    def _start_service(self, preview: Preview) -> dict[str, str]:
        """Installs (first time) and starts the API service; returns the settings that point the website at it."""
        root = workspace.workspace_path(preview.project_id)
        if not service_proc.exists(root):
            return {}
        if not service_proc.installed(root):
            preview.status = "installing"
            done = subprocess.run(["node", ".claude/hooks/service.cjs", "install"], cwd=root,
                                  env={**os.environ, "GAGESITE_PYTHON": sys.executable},
                                  capture_output=True, text=True, encoding="utf-8", errors="replace")
            preview.log.extend(("[api] " + line for line in (done.stdout + done.stderr).splitlines()[-20:]))
            if done.returncode != 0:
                raise RuntimeError("the API service's packages could not be installed")
        port = FIRST_SERVICE_PORT
        while True:
            with socket.socket() as probe:
                if probe.connect_ex(("127.0.0.1", port)) != 0:
                    break
            port += 1
        log = open(root / SERVICE_LOG_FILE, "w", encoding="utf-8", errors="replace")
        preview.service = service_proc.start(root, port, log, reload=preview.mode == "dev",
                                             extra_env={"ALLOWED_ORIGINS": f"http://localhost:{preview.port}",
                                                        **self._keys(preview.project_id)})
        url = f"http://localhost:{port}"
        if not service_proc.wait_healthy(url, preview.service):
            log.close()
            raise RuntimeError("the API service did not start (see its log)")
        preview.service_port = port
        (root / SERVICE_PORT_FILE).write_text(str(port))
        preview.log.append(f"[api] API service running on {url}")
        return {"API_URL": url, "NEXT_PUBLIC_API_URL": url}

    @staticmethod
    def _keys(project_id: str) -> dict[str, str]:
        from . import project_keys

        return project_keys.run_env(project_id)

    def _run(self, preview: Preview) -> None:
        site = site_path(preview.project_id)
        env = {**os.environ, "PORT": str(preview.port), "NEXT_TELEMETRY_DISABLED": "1"}
        # The owner's keys (a model's address and key, an email key...): only the running website
        # gets the values, never the AI's runs or any file in the workspace.
        from . import project_keys

        env.update(project_keys.run_env(preview.project_id))
        try:
            env.update(self._start_service(preview))
            if not (site / "node_modules").is_dir():
                preview.status = "installing"
                done = subprocess.run([npm_bin(), "install", "--no-audit", "--no-fund"], cwd=site, env=env,
                                      capture_output=True, text=True, encoding="utf-8", errors="replace")
                preview.log.extend((done.stdout + done.stderr).splitlines()[-30:])
                if done.returncode != 0:
                    preview.status = "failed"
                    return
            if preview.mode == "production" and not self._build(preview, site, env):
                if preview.status == "stopped":  # stopped (or switched back to dev) while building
                    return
                preview.mode = "dev"  # the finished site can still be tried, as in development
            preview.status = "starting"
            preview.process = subprocess.Popen(
                [npm_bin(), "run", "dev" if preview.mode == "dev" else "start", "--", "-p", str(preview.port)],
                cwd=site, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace",
                creationflags=(subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW) if os.name == "nt" else 0,
                start_new_session=os.name != "nt",
            )
            threading.Thread(target=self._pump, args=(preview, preview.process.stdout), daemon=True).start()
            deadline = time.time() + 120
            while time.time() < deadline and preview.process.poll() is None:
                try:
                    urllib.request.urlopen(preview.url, timeout=60)
                    self._ready(preview)
                    return
                except urllib.error.HTTPError:  # the server answers (even with an error page): it's up
                    self._ready(preview)
                    return
                except Exception:
                    time.sleep(1.5)
            preview.status = "failed"
        except Exception as exc:
            preview.log.append(f"Could not start the preview: {exc}")
            preview.status = "failed"

    def _build(self, preview: Preview, site: Path, env: dict) -> bool:
        """The production build of the finished site (what Vercel builds too). False if it fails."""
        preview.status = "building"
        preview.log.append("Building the final version of the website...")
        try:
            done = subprocess.run([npm_bin(), "run", "build"], cwd=site, env=env, capture_output=True, text=True,
                                  encoding="utf-8", errors="replace", timeout=900,
                                  creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        except subprocess.TimeoutExpired:
            preview.log.append("The final version took too long to build: showing the development version.")
            return False
        preview.log.extend((done.stdout + done.stderr).splitlines()[-30:])
        if done.returncode != 0:
            preview.log.append("The final version could not be built: showing the development version.")
            return False
        return preview.status == "building"  # not stopped meanwhile

    def stop(self, project_id: str) -> None:
        preview = self.previews.get(project_id)
        if not preview:
            return
        process = preview.process
        if process and process.poll() is None:
            if os.name == "nt":  # npm -> node -> next: end the whole tree
                subprocess.run(["taskkill", "/T", "/F", "/PID", str(process.pid)], capture_output=True)
            else:
                os.killpg(process.pid, signal.SIGTERM)
        service_proc.stop(preview.service)
        preview.service = None
        preview.status = "stopped"
        (workspace.workspace_path(project_id) / PREVIEW_PORT_FILE).unlink(missing_ok=True)
        (workspace.workspace_path(project_id) / SERVICE_PORT_FILE).unlink(missing_ok=True)

    def stop_all(self) -> None:
        for project_id in list(self.previews):
            self.stop(project_id)


previews = PreviewManager()


def read_check(project_id: str) -> dict | None:
    raw = workspace.read_text(project_id, CHECK_JSON)
    try:
        return json.loads(raw) if raw else None
    except json.JSONDecodeError:
        return None


def run_check(project_id: str, timeout: int = 900) -> dict | None:
    """Runs the website self-test (which also saves the page screenshots); returns its report."""
    script = workspace.workspace_path(project_id) / ".claude" / "hooks" / "site_check.py"
    if not script.exists() or not (site_path(project_id) / "node_modules").is_dir():
        return None
    try:
        subprocess.run([sys.executable, str(script)], cwd=workspace.workspace_path(project_id), capture_output=True,
                       timeout=timeout)
    except subprocess.TimeoutExpired:
        return None
    return read_check(project_id)
