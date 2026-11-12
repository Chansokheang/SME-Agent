"""Files the owner attaches to a chat message, in any stage: a screenshot of a problem, a PDF, a
text file, a photo, a Word or PowerPoint file.

They are saved in the workspace (`docs/chat-files/`), where the stage's AI opens them with its
Read tool: it reads text, PDFs and images (screenshots) directly. Word and PowerPoint files get a
plain-text copy next to them, like the plan's documents (sources.py).
"""

import json
import re
import secrets
from pathlib import Path

from . import sources, workspace

DIR = "docs/chat-files"
MAX_BYTES = 20 * 1024 * 1024
MAX_PER_MESSAGE = 10
KINDS = {
    **sources.KINDS,
    ".gif": "image",
    ".csv": "text",
    ".json": "text",
    ".log": "text",
}
TEXT_KINDS = {".txt", ".md", ".csv", ".json", ".log"}


def folder(project_id: str) -> Path:
    path = workspace.workspace_path(project_id) / DIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def allowed(filename: str) -> bool:
    return Path(filename or "").suffix.lower() in KINDS


def add(project_id: str, filename: str, content: bytes) -> dict:
    """Save one file; a short random prefix keeps two files with the same name apart."""
    original = Path(filename or "file").name
    name = f"{secrets.token_hex(3)}-{sources.safe_name(original)}"
    path = folder(project_id) / name
    path.write_bytes(content)
    suffix = path.suffix.lower()
    if suffix in (".docx", ".pptx"):
        try:
            text = sources.docx_text(path) if suffix == ".docx" else sources.pptx_text(path)
            path.with_name(path.name + sources.TEXT_SUFFIX).write_text(text, encoding="utf-8")
        except Exception:  # damaged or unusual file: keep it; the AI is told no text copy exists
            pass
    return {"file": name, "name": original, "kind": KINDS[suffix], "size": len(content)}


def find(project_id: str, file: str) -> Path | None:
    """A saved file by its stored name (no paths: only names inside the folder)."""
    name = Path(file or "").name
    if not name or name != file or not re.match(r"^[0-9a-f]{6}-", name):
        return None
    path = folder(project_id) / name
    return path if path.is_file() else None


def describe(project_id: str, files: list[str]) -> list[dict]:
    """The attachments of one message, for the history: stored name, original name, kind."""
    out = []
    for file in files[:MAX_PER_MESSAGE]:
        path = find(project_id, file)
        if path:
            out.append({"file": path.name, "name": path.name.split("-", 1)[1], "kind": KINDS.get(path.suffix.lower(), "other")})
    return out


def prompt_block(project_id: str, attached: list[dict]) -> str:
    """What the AI is told about the files: where they are and how to open them."""
    if not attached:
        return ""
    lines = []
    for item in attached:
        path = folder(project_id) / item["file"]
        relative = f"{DIR}/{item['file']}"
        if path.suffix.lower() in (".docx", ".pptx"):
            text = path.with_name(path.name + sources.TEXT_SUFFIX)
            relative = f"{DIR}/{text.name}" if text.exists() else relative + " (no readable text copy could be made)"
        lines.append(f"- {relative} ({item['kind']}, named \"{item['name']}\" by the owner)")
    return (
        "\n\n<attached-files>\nThe owner attached these files to this message. Open every one with the Read tool "
        "before you answer (it shows images and screenshots, and reads PDFs and text), and use what they show. "
        "They are the owner's material for this message: read them, never edit or move them.\n"
        + "\n".join(lines) + "\n</attached-files>"
    )


def dumps(attached: list[dict]) -> str | None:
    return json.dumps(attached) if attached else None
