"""Project workspaces: one folder per project where `claude -p` runs and writes stage outputs."""

import hashlib
import io
import json
import shutil
import zipfile
from pathlib import Path

from .config import settings

TEMPLATE_DIR = settings.pipeline_dir / "templates" / "workspace"
UPLOADS_DIR = ".uploads"
# Left out of downloads: platform internals and the owner's raw uploads, not part of the project.


def workspace_path(project_id: str) -> Path:
    return settings.workspaces_dir / project_id


REMOVED_PREFIX = ".removed-"


def removed_path(project_id: str) -> Path:
    return settings.workspaces_dir / f"{REMOVED_PREFIX}{project_id}"


def _clear_read_only(func, path, _exc) -> None:
    # git keeps its object files read-only; Windows refuses to delete those until the flag is cleared.
    import os
    import stat

    os.chmod(path, stat.S_IWRITE)
    func(path)


def purge_removed() -> None:
    """Delete folders of removed projects. Anything still locked is retried at the next start or removal."""
    if not settings.workspaces_dir.exists():
        return
    for folder in settings.workspaces_dir.glob(f"{REMOVED_PREFIX}*"):
        try:
            shutil.rmtree(folder, onerror=_clear_read_only)
        except OSError:
            pass


def create_workspace(project_id: str) -> Path:
    path = workspace_path(project_id)
    shutil.copytree(TEMPLATE_DIR, path)
    return path


def refresh_platform_files(project_id: str) -> None:
    """Re-copy CLAUDE.md and .claude/ from the template so older workspaces get current rules and hooks."""
    path = workspace_path(project_id)
    shutil.copy2(TEMPLATE_DIR / "CLAUDE.md", path / "CLAUDE.md")
    shutil.copy2(TEMPLATE_DIR / "package.json", path / "package.json")
    shutil.copytree(TEMPLATE_DIR / ".claude", path / ".claude", dirs_exist_ok=True)


def uploads_path(project_id: str) -> Path:
    path = workspace_path(project_id) / UPLOADS_DIR
    path.mkdir(exist_ok=True)
    return path


def stage_prompt_path(stage_key: str) -> Path:
    return settings.pipeline_dir / "stages" / stage_key / "system.md"


def read_text(project_id: str, relative: str) -> str | None:
    path = workspace_path(project_id) / relative
    return path.read_text(encoding="utf-8") if path.exists() else None


def file_hash(project_id: str, relative: str) -> str | None:
    path = workspace_path(project_id) / relative
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def write_pipeline_state(project_id: str, stages: dict[str, dict], database: dict | None = None) -> None:
    """Mirror stage state into docs/pipeline.json so later stages can read it. Never holds secrets."""
    path = workspace_path(project_id) / "docs" / "pipeline.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"stages": stages, "database": database}, indent=2), encoding="utf-8")


def purge_uploads(project_id: str) -> int:
    """Delete the owner's raw uploaded files (called once their rows are imported). Returns files removed."""
    folder = workspace_path(project_id) / UPLOADS_DIR
    if not folder.exists():
        return 0
    count = sum(1 for p in folder.iterdir() if p.is_file())
    shutil.rmtree(folder)
    return count


# What the owner downloads is the website itself: its code and README. Nothing of Gagesite's own
# working files (the plan, QA verdicts, agent reports, instructions), no secrets, no build output.
CODE_DIRS = ("site", "service")
CODE_EXCLUDES = {"node_modules", ".next", ".next-build", ".next-check", ".git", ".vercel", ".claude",
                 ".env", ".env.local", "dev.db", "dev.db-journal", "__pycache__", ".venv"}
CODE_EXCLUDE_SUFFIXES = (".tsbuildinfo", ".pyc", ".log")


def has_code(project_id: str) -> bool:
    return (workspace_path(project_id) / "site" / "package.json").exists()


def zip_code(project_id: str) -> bytes:
    """The website's code: site/ at the top of the zip, or site/ and service/ side by side when the
    website has its own API service."""
    root = workspace_path(project_id)
    parts = [d for d in CODE_DIRS if (root / d).is_dir()]
    nested = len(parts) > 1
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for part in parts:
            base = root / part
            for path in base.rglob("*"):
                relative = path.relative_to(base)
                if (not path.is_file() or CODE_EXCLUDES.intersection(relative.parts)
                        or path.name.endswith(CODE_EXCLUDE_SUFFIXES)):
                    continue
                archive.write(path, (f"{part}/" if nested else "") + relative.as_posix())
    return buffer.getvalue()
