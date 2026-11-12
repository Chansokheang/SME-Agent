"""Packs Gagesite's data for moving it to another computer (see docs/DEPLOY.md):

    python scripts/pack_data.py gagesite-data.tar.gz

Inside, laid out as the server's ./data folder expects:
- app.db: a consistent copy of the database (taken with SQLite's backup, safe while Gagesite runs);
- secret.key: the key that unlocks everything saved encrypted (database addresses, tokens, SSH keys).
  Without it the copied connections can't be read. KEEP THE ARCHIVE PRIVATE.
- the research Gagesite saved (pattern-research/, project-research/, stitch.json);
- workspaces/<project>/: each project's files, without what the server rebuilds by itself (installed
  packages, build output, Python environments, logs and port notes of this computer).
"""

import sqlite3
import sys
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA, WORKSPACES = ROOT / "data", ROOT / "workspaces"
SKIP_DIRS = {"node_modules", ".next", ".venv", "__pycache__", ".production", ".turbo"}
SKIP_FILES = {"preview-port", "service-port", "preview.log", "service.log"}


def keep(path: Path) -> bool:
    parts = set(path.parts)
    return not (parts & SKIP_DIRS) and path.name not in SKIP_FILES and not path.name.endswith(".pyc")


def main(target: str) -> None:
    out = Path(target).resolve()
    with tarfile.open(out, "w:gz") as tar:
        with tempfile.TemporaryDirectory() as tmp:  # the database, copied consistently
            copy = Path(tmp) / "app.db"
            source = sqlite3.connect(DATA / "app.db")
            dest = sqlite3.connect(copy)
            source.backup(dest)
            dest.close()
            source.close()
            tar.add(copy, arcname="app.db")
        tar.add(DATA / "secret.key", arcname="secret.key")
        for name in ("pattern-research", "project-research", "stitch.json"):
            if (DATA / name).exists():
                tar.add(DATA / name, arcname=name)
        count = 0
        for path in sorted(WORKSPACES.rglob("*")):
            relative = path.relative_to(WORKSPACES)
            if path.is_file() and keep(relative):
                tar.add(path, arcname=f"workspaces/{relative.as_posix()}", recursive=False)
                count += 1
    size = out.stat().st_size / 1e6
    print(f"Packed the database, the key and {count} project files into {out} ({size:.1f} MB).")
    print("It holds your encryption key: keep it private and delete it once copied.")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "gagesite-data.tar.gz")
