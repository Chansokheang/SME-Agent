"""Stage 3 inputs from the owner: logo, colours, photos, a 3D model, reference screenshots and style notes.

Logo and photos are website assets, so they live in the workspace's `brand/` folder and ship
with the site. Reference screenshots are inspiration only: `.design-refs/`, never shipped.
"""

import json
import re
from pathlib import Path

from pydantic import BaseModel, Field

from . import workspace

KIT_FILE = "docs/03-design-kit.json"
BRAND_DIR = "brand"
REFS_DIR = ".design-refs"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024
# A 3D model of the product, for the optional 3D showcase on the home page. Only GLB: one
# self-contained file (a .gltf points at separate texture files the site would miss).
MODEL_EXTENSIONS = {".glb"}
MAX_MODEL_BYTES = 25 * 1024 * 1024
MODEL_NAME = "model.glb"
PHOTO_TAGS = ("hero", "menu", "about", "gallery", "other")
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


class Photo(BaseModel):
    file: str
    tag: str = "other"


class DesignKit(BaseModel):
    logo: str | None = None
    colors: list[str] = Field(default_factory=list)
    photos: list[Photo] = Field(default_factory=list)
    references: list[str] = Field(default_factory=list)
    style_notes: str = ""
    avoid: str = ""
    # "html": static HTML + Tailwind mockups. "nextjs": live Next.js pages (not available yet).
    mockup_format: str = "html"
    model: str | None = None  # brand/model.glb when the owner uploaded a 3D model
    # Show the model as the home page's 3D showcase (it turns and moves as visitors scroll).
    showcase_3d: bool = False
    # Who draws the style options: "gagesite" (our own designer) or "stitch" (Google Stitch as well).
    design_engine: str = "gagesite"


class KitSettings(BaseModel):
    """The text fields the owner edits directly (files are managed by upload/delete)."""
    colors: list[str] = Field(default_factory=list)
    style_notes: str = ""
    avoid: str = ""
    mockup_format: str = "html"
    showcase_3d: bool = False
    design_engine: str | None = None  # left out: keep the current choice


ENGINES = ("gagesite", "stitch")


def load(project_id: str) -> DesignKit:
    raw = workspace.read_text(project_id, KIT_FILE)
    return DesignKit.model_validate_json(raw) if raw else DesignKit()


def save(project_id: str, kit: DesignKit) -> DesignKit:
    path = workspace.workspace_path(project_id) / KIT_FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(kit.model_dump(), indent=2, ensure_ascii=False), encoding="utf-8")
    return kit


def update_settings(project_id: str, settings: KitSettings) -> DesignKit:
    kit = load(project_id)
    kit.colors = [c for c in settings.colors if HEX.match(c)][:4]
    kit.style_notes = settings.style_notes.strip()[:1000]
    kit.avoid = settings.avoid.strip()[:500]
    kit.mockup_format = "html"  # live Next.js pages are not available yet
    kit.showcase_3d = settings.showcase_3d and bool(kit.model)  # nothing to show without a model
    if settings.design_engine in ENGINES:
        kit.design_engine = settings.design_engine
    return save(project_id, kit)


def is_glb(content: bytes) -> bool:
    """A binary glTF starts with the magic "glTF" and version 2."""
    return len(content) >= 12 and content[:4] == b"glTF" and int.from_bytes(content[4:8], "little") == 2


def safe_name(filename: str) -> str:
    stem, suffix = Path(filename).stem, Path(filename).suffix.lower()
    stem = re.sub(r"[^A-Za-z0-9가-힣_-]+", "-", stem).strip("-")[:60] or "image"
    return f"{stem}{suffix}"


def add_file(project_id: str, kind: str, filename: str, content: bytes, tag: str = "other") -> DesignKit:
    kit = load(project_id)
    name = safe_name(filename)
    folder = workspace.workspace_path(project_id) / (REFS_DIR if kind == "reference" else BRAND_DIR)
    folder.mkdir(exist_ok=True)
    if kind == "model":
        name = MODEL_NAME
        kit.model = name
        kit.showcase_3d = True  # uploading a model means they want it shown; they can switch it off
    elif kind == "logo":
        name = f"logo{Path(name).suffix}"
        if kit.logo:
            (folder / kit.logo).unlink(missing_ok=True)
        kit.logo = name
    elif kind == "photo":
        kit.photos = [p for p in kit.photos if p.file != name] + [Photo(file=name, tag=tag if tag in PHOTO_TAGS else "other")]
    else:
        kit.references = [r for r in kit.references if r != name] + [name]
    (folder / name).write_bytes(content)
    return save(project_id, kit)


def tag_photo(project_id: str, filename: str, tag: str) -> DesignKit:
    kit = load(project_id)
    for photo in kit.photos:
        if photo.file == filename:
            photo.tag = tag if tag in PHOTO_TAGS else "other"
    return save(project_id, kit)


def remove_file(project_id: str, kind: str, filename: str) -> DesignKit:
    kit = load(project_id)
    root = workspace.workspace_path(project_id)
    name = Path(filename).name
    if kind == "model" and kit.model:
        (root / BRAND_DIR / kit.model).unlink(missing_ok=True)
        kit.model, kit.showcase_3d = None, False
    elif kind == "logo" and kit.logo:
        (root / BRAND_DIR / kit.logo).unlink(missing_ok=True)
        kit.logo = None
    elif kind == "photo":
        (root / BRAND_DIR / name).unlink(missing_ok=True)
        kit.photos = [p for p in kit.photos if p.file != name]
    elif kind == "reference":
        (root / REFS_DIR / name).unlink(missing_ok=True)
        kit.references = [r for r in kit.references if r != name]
    return save(project_id, kit)
