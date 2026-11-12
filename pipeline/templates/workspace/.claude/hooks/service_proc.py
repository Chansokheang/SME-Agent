"""Runs the separate API service ("UI + dedicated API") for the preview and the self-test.

Shared by the platform's live preview and site_check.py: the service in service/ is either a
TypeScript (Hono + Prisma, package.json) or a Python (FastAPI, requirements.txt) app. It is
started on its own port with its .env, and is up when GET /health answers.
"""

import os
import re
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HEALTH = "/health"


def service_dir(root: Path) -> Path:
    return root / "service"


def exists(root: Path) -> bool:
    folder = service_dir(root)
    return (folder / "package.json").exists() or (folder / "requirements.txt").exists()


def is_python(root: Path) -> bool:
    return (service_dir(root) / "requirements.txt").exists()


def venv_python(root: Path) -> Path:
    return service_dir(root) / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def dotenv(root: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    file = service_dir(root) / ".env"
    if file.exists():
        for line in file.read_text(encoding="utf-8", errors="replace").splitlines():
            match = re.match(r'^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$', line)
            if match:
                values[match.group(1)] = match.group(2)
    return values


def installed(root: Path) -> bool:
    folder = service_dir(root)
    return venv_python(root).exists() if is_python(root) else (folder / "node_modules").is_dir()


def healthy(url: str, timeout: float = 5) -> bool:
    try:
        with urllib.request.urlopen(url + HEALTH, timeout=timeout) as response:
            return response.status == 200
    except urllib.error.HTTPError:
        return False
    except Exception:
        return False


# Windows: a console of its own (hidden). uvicorn --reload restarts by sending Ctrl+C, which reaches
# EVERY process on the same console: without this it also shut down Gagesite's backend.
ISOLATED = (subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW) if os.name == "nt" else 0


def start(root: Path, port: int, log, reload: bool = False, extra_env: dict[str, str] | None = None) -> subprocess.Popen:
    """Starts the service on `port`, writing its output to `log` (an open file)."""
    folder = service_dir(root)
    env = {**os.environ, **dotenv(root), **(extra_env or {}), "PORT": str(port), "PYTHONIOENCODING": "utf-8"}
    if is_python(root):
        command = [str(venv_python(root)), "-m", "uvicorn", "app.main:app", "--port", str(port)] + (["--reload"] if reload else [])
    else:
        npm = "npm.cmd" if os.name == "nt" else "npm"
        command = [npm, "run", "dev" if reload else "start"]
    return subprocess.Popen(
        command, cwd=folder, env=env, stdout=log, stderr=subprocess.STDOUT,
        creationflags=ISOLATED if os.name == "nt" else 0,
        start_new_session=os.name != "nt",
    )


def wait_healthy(url: str, process: subprocess.Popen, seconds: float = 90) -> bool:
    deadline = time.time() + seconds
    while time.time() < deadline:
        if process.poll() is not None:
            return False
        if healthy(url):
            return True
        time.sleep(1)
    return False


def stop(process: subprocess.Popen | None) -> None:
    if not process or process.poll() is not None:
        return
    if os.name == "nt":  # npm -> node, or python -> uvicorn workers: end the whole tree
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(process.pid)], capture_output=True)
    else:
        os.killpg(process.pid, signal.SIGTERM)


if __name__ == "__main__":  # quick manual check: python service_proc.py <workspace> <port>
    workspace, port = Path(sys.argv[1]), int(sys.argv[2])
    with open(workspace / ".claude" / "service-test.log", "w") as out:
        proc = start(workspace, port, out)
        print("healthy:", wait_healthy(f"http://localhost:{port}", proc))
        stop(proc)
