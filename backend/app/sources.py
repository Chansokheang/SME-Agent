"""The owner's own documents for Stage 1 (a menu PDF, a price list, a brochure, a pitch deck...).

They live in docs/01-sources/ inside the workspace, where Claude reads them to fill in the plan.
Claude reads PDFs and images directly; Word and PowerPoint files get a plain-text copy next to
them (`<file>.text.md`), since Claude can't open those formats.
"""

import re
from pathlib import Path

from . import link_reader, workspace

SOURCES_DIR = "docs/01-sources"
TEXT_SUFFIX = ".text.md"
MAX_BYTES = 20 * 1024 * 1024
KINDS = {
    ".pdf": "pdf",
    ".docx": "word",
    ".pptx": "slides",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
    ".txt": "text",
    ".md": "text",
}


def folder(project_id: str) -> Path:
    path = workspace.workspace_path(project_id) / SOURCES_DIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def safe_name(filename: str) -> str:
    stem, suffix = Path(filename).stem, Path(filename).suffix.lower()
    stem = re.sub(r"[^A-Za-z0-9가-힣_.-]+", "-", stem).strip("-.")[:80] or "document"
    return f"{stem}{suffix}"


def _info(path: Path) -> dict:
    text = path.with_name(path.name + TEXT_SUFFIX)
    return {
        "file": path.name,
        "kind": KINDS.get(path.suffix.lower(), "other"),
        "size": path.stat().st_size,
        # Word/PowerPoint: whether a readable text copy could be made.
        "text_ready": text.exists() if path.suffix.lower() in (".docx", ".pptx") else None,
    }


def list_sources(project_id: str) -> list[dict]:
    path = workspace.workspace_path(project_id) / SOURCES_DIR
    if not path.is_dir():
        return []
    # Websites Gagesite read from links: one entry each (their .md and .jpg are not listed apart).
    links = link_reader.load_index(path)
    def belongs_to_link(p: Path) -> bool:
        # link-<site>.md / .jpg and its item pages' screenshots, link-<site>-item-N-M.jpg
        return any(p.stem == name or p.stem.startswith(f"{name}-item-") for name in links)

    files = [
        _info(p)
        for p in sorted(path.iterdir())
        if p.is_file() and not p.name.endswith(TEXT_SUFFIX) and not p.name.startswith(".") and not belongs_to_link(p)
    ]
    return files + [
        {"file": name, "kind": "link", "size": 0, "text_ready": None, "url": info["url"], "title": info.get("title", "")}
        for name, info in links.items()
    ]


def linked_urls(project_id: str) -> dict[str, str]:
    """url -> saved name, for links already read."""
    path = workspace.workspace_path(project_id) / SOURCES_DIR
    return {info["url"]: name for name, info in link_reader.load_index(path).items()} if path.is_dir() else {}


def add_link(project_id: str, url: str) -> dict:
    """Opens a website and saves what it shows (raises link_reader.LinkError with a plain reason)."""
    return link_reader.save(folder(project_id), link_reader.read(url), url)


def _md_table(rows: list[list[str]]) -> list[str]:
    rows = [[c.replace("\n", " ").replace("|", "/").strip() for c in r] for r in rows if any(c.strip() for c in r)]
    if not rows:
        return []
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    return ["| " + " | ".join(rows[0]) + " |", "|" + "---|" * width] + ["| " + " | ".join(r) + " |" for r in rows[1:]]


def docx_text(path: Path) -> str:
    import docx

    document = docx.Document(str(path))
    lines: list[str] = [f"# {path.name}", ""]
    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if not text:
            continue
        style = (paragraph.style.name or "").lower() if paragraph.style is not None else ""
        level = re.search(r"heading (\d)", style)
        lines.append(f"{'#' * (int(level.group(1)) + 1)} {text}" if level else ("- " + text if "list" in style else text))
        lines.append("")
    for number, table in enumerate(document.tables, 1):
        lines += [f"## Table {number}", ""] + _md_table([[cell.text for cell in row.cells] for row in table.rows]) + [""]
    return "\n".join(lines).strip() + "\n"


def pptx_text(path: Path) -> str:
    from pptx import Presentation

    deck = Presentation(str(path))
    lines: list[str] = [f"# {path.name}", ""]
    for number, slide in enumerate(deck.slides, 1):
        title = slide.shapes.title.text.strip() if slide.shapes.title is not None and slide.shapes.title.has_text_frame else ""
        lines += [f"## Slide {number}{': ' + title if title else ''}", ""]
        for shape in slide.shapes:
            if shape == slide.shapes.title:
                continue
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    text = "".join(run.text for run in paragraph.runs).strip()
                    if text:
                        lines.append(("  " * paragraph.level) + "- " + text)
            if getattr(shape, "has_table", False) and shape.has_table:
                lines += [""] + _md_table([[cell.text for cell in row.cells] for row in shape.table.rows])
        notes = slide.notes_slide.notes_text_frame.text.strip() if slide.has_notes_slide and slide.notes_slide.notes_text_frame else ""
        if notes:
            lines += ["", f"Speaker notes: {notes}"]
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def add(project_id: str, filename: str, content: bytes) -> dict:
    name = safe_name(filename)
    path = folder(project_id) / name
    path.write_bytes(content)
    suffix = path.suffix.lower()
    text_path = path.with_name(path.name + TEXT_SUFFIX)
    text_path.unlink(missing_ok=True)
    if suffix in (".docx", ".pptx"):
        try:
            text_path.write_text(docx_text(path) if suffix == ".docx" else pptx_text(path), encoding="utf-8")
        except Exception:  # damaged or unusual file: keep it, report that no text copy exists
            pass
    return _info(path)


def remove(project_id: str, filename: str) -> None:
    if link_reader.remove(folder(project_id), Path(filename).name):
        return
    path = folder(project_id) / Path(filename).name
    path.unlink(missing_ok=True)
    path.with_name(path.name + TEXT_SUFFIX).unlink(missing_ok=True)
