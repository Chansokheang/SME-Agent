"""The design pattern catalogue: researched guides for each kind of page and each kind of website.

`pipeline/patterns/pages/<type>.md` says how a kind of page is laid out (a chat page, a dashboard,
a listing...), from what the leading products in that category share. `pipeline/patterns/sites/
<category>.md` says what a kind of website shows first and in what order (a research lab, a
portfolio, a cafe...). Before UI Design and the build, the guides that match the plan are copied
into the workspace (`docs/03-patterns/`), with an index of what was found and what has no guide yet.
"""

import json
import re
import shutil

from . import workspace
from .config import settings

PATTERNS_DIR = settings.pipeline_dir / "patterns"
OUT_DIR = "docs/03-patterns"
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,40}$")


def _scope(project_id: str) -> dict:
    raw = workspace.read_text(project_id, "docs/01-scope.json")
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        data = {}
    return data if isinstance(data, dict) else {}


# Plans written before pages had a type: guess it from the page's name, address and purpose.
PAGE_HINTS = [
    ("board", r"\b(board|kanban|pipeline)\b"),
    ("calendar", r"\b(calendar|schedule|agenda|timeline)\b"),
    ("editor", r"\b(editor|note|notes|write|page editor|document editor)\b"),
    ("inbox", r"\b(inbox|notifications?)\b"),
    ("auth", r"\b(log ?in|sign ?in|sign ?up|register|password|reset|invitation|invite accept)\b"),
    ("chat", r"\b(chat|conversation|ask|assistant|chatbot|messages?)\b"),
    ("dashboard", r"\b(dashboard|overview|stats|statistics|analytics|insights)\b"),
    ("admin", r"\b(admin|manage|moderat|back ?office)\b"),
    ("account", r"\b(settings?|account|profile|keys|preferences|billing)\b"),
    ("docs", r"\b(docs?|documentation|help|faq|guide|api reference)\b"),
    ("form", r"\b(new|add|create|edit|book|booking|reserve|reservation|contact|order|checkout|apply|enquir|request|import)\b"),
    ("detail", r"\[[a-z]+\]|\b(detail|item|profile of)\b"),
    ("listing", r"\b(list|browse|search|catalog|catalogue|directory|menu|gallery|library|documents|projects|people|team|publications|topics|history|records)\b"),
    ("content", r"\b(about|story|blog|news|article|research|privacy|terms|policy)\b"),
]
SITE_HINTS = [
    ("todo-tasks", r"\b(to-?do|todo|task list|tasks?)\b"),
    ("notes-docs", r"\b(notes?|note-taking|notebook)\b"),
    ("booking", r"\b(booking|reservation|reserve|appointment|scheduling|room booking|desk booking)\b"),
    ("ai-assistant", r"\b(chatbot|assistant|q&a|ask (your|our) documents?)\b"),
    ("social-media", r"\b(social|feed|followers?|community posts?)\b"),
    ("docs-knowledge", r"\b(wiki|knowledge base|notion|confluence|documentation hub)\b"),
    ("enterprise-internal", r"\b(internal|erp|crm|approvals?|back ?office|intranet)\b"),
    ("marketplace", r"\b(marketplace|sellers|listings)\b"),
    ("finance-banking", r"\b(bank|banking|finance|wallet|payments? app)\b"),
    ("research-lab", r"\b(lab|laboratory|research group|institute)\b"),
    ("portfolio", r"\b(portfolio|photographer|designer|artist)\b"),
    ("restaurant-cafe", r"\b(restaurant|cafe|café|coffee|bakery|bistro|bar)\b"),
    ("clinic-health", r"\b(clinic|dental|hospital|therapy|health)\b"),
    ("salon-beauty", r"\b(salon|spa|beauty|barber|nail)\b"),
    ("shop", r"\b(shop|store|e-?commerce|boutique)\b"),
    ("education", r"\b(school|academy|tutoring|course|education)\b"),
    ("personal-tool", r"\b(personal|assistant|chatbot|q&a|tool for (me|myself))\b"),
    ("saas-tool", r"\b(saas|platform|software|portal)\b"),
]


TOOL_SITES = ("personal-tool", "saas-tool", "research-lab")


def guess_page_type(page: dict, category: str = "") -> str:
    """The page's own name and address decide first; its purpose only when they say nothing."""
    name = f"{page.get('name') or ''} {page.get('path') or ''}".lower()
    purpose = str(page.get("purpose") or "").lower()
    kind = next((k for k, pattern in PAGE_HINTS if re.search(pattern, name)), "")
    if kind:
        return kind
    if str(page.get("path") or "").strip() == "/":
        return "dashboard" if category in TOOL_SITES else "landing"  # a tool's home is the tool
    return next((k for k, pattern in PAGE_HINTS if re.search(pattern, purpose)), "")


def categories(project_id: str) -> list[str]:
    """The kinds of website the plan combines, the main one first: `site_category` plus any
    `site_categories` (a to-do + notes app is `todo-tasks`, `project-board` and `notes-docs`)."""
    scope = _scope(project_id)
    main = str(scope.get("site_category") or "").strip().lower()
    if not SLUG.match(main):
        text = f"{scope.get('site_type') or ''} {(scope.get('business') or {}).get('industry') or ''}".lower()
        main = next((c for c, pattern in SITE_HINTS if re.search(pattern, text)), "")
    found = [main] if main else []
    for extra in scope.get("site_categories") or []:
        slug = str(extra or "").strip().lower()
        if SLUG.match(slug) and slug not in found:
            found.append(slug)
    return found[:4]


def wanted(project_id: str) -> tuple[str, list[str]]:
    """The plan's main site category and the page types it uses (most used first). When the plan
    predates these fields, they are guessed from its pages and its `site_type`."""
    scope = _scope(project_id)
    category = (categories(project_id) or [""])[0]
    counts: dict[str, int] = {}
    for page in scope.get("pages") or []:
        if not isinstance(page, dict):
            continue
        kind = str(page.get("type") or "").strip().lower() or guess_page_type(page, category)
        if SLUG.match(kind):
            counts[kind] = counts.get(kind, 0) + 1
    return category, sorted(counts, key=lambda k: -counts[k])


def sync(project_id: str) -> dict:
    """Copy the matching guides into the workspace and write docs/03-patterns/index.json."""
    category, page_types = wanted(project_id)
    out = workspace.workspace_path(project_id) / OUT_DIR
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)
    kinds = categories(project_id)
    index = {"site_category": category, "site_categories": kinds, "site_guide": None, "site_guides": {},
             "page_guides": {}, "missing": [], "studied": {}}
    for site_kind in kinds:
        source = PATTERNS_DIR / "sites" / f"{site_kind}.md"
        if source.exists():
            shutil.copy2(source, out / f"site-{site_kind}.md")
            index["site_guides"][site_kind] = f"{OUT_DIR}/site-{site_kind}.md"
            if site_kind == category:
                index["site_guide"] = f"{OUT_DIR}/site-{site_kind}.md"
            index["studied"][f"site:{site_kind}"] = studied(source)
        else:
            index["missing"].append(f"site:{site_kind}")
    for kind in page_types:
        source = PATTERNS_DIR / "pages" / f"{kind}.md"
        if source.exists():
            shutil.copy2(source, out / f"page-{kind}.md")
            index["page_guides"][kind] = f"{OUT_DIR}/page-{kind}.md"
            index["studied"][f"page:{kind}"] = studied(source)
        else:
            index["missing"].append(f"page:{kind}")
    (out / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
    return index


# ---------- Researching the guides that don't exist yet (before UI Design) ----------

RESEARCH_DIR = settings.data_dir / "pattern-research"
ATTEMPTS = RESEARCH_DIR / "attempts.json"
MAX_PER_RUN = 6  # the website's kind first, then the most used kinds of page; the rest next time
RETRY_AFTER_S = 24 * 3600  # a guide whose research failed isn't tried again on every message
MIN_GUIDE = 1500  # characters: shorter is not a guide


def studied(path) -> list[str]:
    """The products a guide was researched from: its `Studied:` line."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return []
    match = re.search(r"^\**Studied:?\**:?\s*(.+)$", text, re.MULTILINE | re.IGNORECASE)
    if not match:
        return []
    names = [n.strip(" .*`") for n in re.split(r",|;", match.group(1))]
    return [n for n in names if n][:12]


def _attempts() -> dict:
    try:
        data = json.loads(ATTEMPTS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {}
    return data if isinstance(data, dict) else {}


def to_research(index: dict) -> list[str]:
    """The missing guides to research now, e.g. ["site:booking", "page:admin"]."""
    import time

    tried = _attempts()
    now = time.time()
    missing = [m for m in index.get("missing") or [] if m.split(":", 1)[-1] and SLUG.match(m.split(":", 1)[-1])]
    fresh = [m for m in missing if now - float(tried.get(m, 0)) > RETRY_AFTER_S]
    return sorted(fresh, key=lambda m: 0 if m.startswith("site:") else 1)[:MAX_PER_RUN]


def _target(item: str) -> tuple[str, str]:
    """("sites", "booking") for "site:booking"; ("pages", "admin") for "page:admin"."""
    kind, name = item.split(":", 1)
    return ("sites" if kind == "site" else "pages"), name


def prepare_research(project_id: str, items: list[str]) -> tuple:
    """A folder for the researcher: the brief, an example guide, and where each guide goes.
    Returns (folder, prompt)."""
    import time

    folder = RESEARCH_DIR / f"{project_id}-{int(time.time())}"
    (folder / "out" / "sites").mkdir(parents=True, exist_ok=True)
    (folder / "out" / "pages").mkdir(parents=True, exist_ok=True)
    (folder / "out" / "research").mkdir(parents=True, exist_ok=True)
    example = PATTERNS_DIR / "pages" / "chat.md"
    if example.exists():
        shutil.copy2(example, folder / "example-page-guide.md")
    scope = _scope(project_id)
    business = scope.get("business") if isinstance(scope.get("business"), dict) else {}
    pages = [f"- {p.get('name')} (`{p.get('path')}`), kind: {p.get('type') or '?'}: {p.get('purpose') or ''}"
             for p in scope.get("pages") or [] if isinstance(p, dict)][:30]
    jobs = []
    for item in items:
        group, name = _target(item)
        jobs.append(f"- `{item}`: write `out/{group}/{name}.md` and its notes `out/research/{name}-research.md`")
    brief = "\n".join([
        "# The website this research is for",
        "",
        f"- What it is: {scope.get('site_type') or ''}",
        f"- Kind of website: {scope.get('site_category') or ''}",
        f"- Business: {business.get('name') or ''}, {business.get('industry') or ''}",
        f"- In short: {str(business.get('description') or scope.get('summary') or '')[:600]}",
        "",
        "## Its pages",
        *pages,
        "",
        "## Guides to write",
        *jobs,
        "",
        "Guides are reused for EVERY later website of the same kind: write them for the kind, "
        "not for this business (use this one only to understand the kind).",
    ])
    (folder / "brief.md").write_text(brief, encoding="utf-8")
    prompt = ("Research and write the design guides listed in brief.md, following your instructions. "
              "Start by reading brief.md and example-page-guide.md.")
    return folder, prompt


def adopt_research(folder, items: list[str]) -> list[str]:
    """Copy the guides the researcher wrote into the shared library (never over an existing one).
    Notes every item as tried, so a failed one isn't retried on every message. Returns what was added."""
    import time

    added = []
    for item in items:
        group, name = _target(item)
        guide = folder / "out" / group / f"{name}.md"
        try:
            text = guide.read_text(encoding="utf-8")
        except OSError:
            continue
        if len(text) < MIN_GUIDE or not text.lstrip().startswith("#") or not studied(guide):
            continue
        target = PATTERNS_DIR / group / f"{name}.md"
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_text(text, encoding="utf-8")
            added.append(item)
        notes = folder / "out" / "research" / f"{name}-research.md"
        notes_target = PATTERNS_DIR / "research" / f"{name}-research.md"
        if notes.exists() and not notes_target.exists():
            shutil.copy2(notes, notes_target)
    tried = _attempts()
    now = time.time()
    for item in items:
        tried[item] = now
    RESEARCH_DIR.mkdir(parents=True, exist_ok=True)
    ATTEMPTS.write_text(json.dumps(tried, indent=2), encoding="utf-8")
    return added


# ---------- Project research: every project, before the design plan ----------
# The library guides are the baseline for a KIND; this studies THIS project's mix (other layouts,
# products that combine the same parts, newer ideas) and lands in the project only.

PROJECT_RESEARCH_DIR = settings.data_dir / "project-research"
PROJECT_OUT = "docs/03-research"


def _scope_hash(project_id: str) -> str:
    import hashlib

    raw = workspace.read_text(project_id, "docs/01-scope.json") or ""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def needs_project_research(project_id: str) -> bool:
    """True until this plan has been researched (again after the plan changes)."""
    root = workspace.workspace_path(project_id) / PROJECT_OUT
    try:
        meta = json.loads((root / "meta.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return True
    return not (root / "research.md").exists() or meta.get("scope_hash") != _scope_hash(project_id)


def prepare_project_research(project_id: str) -> tuple:
    """A folder for the project researcher: the plan, the guides it already has, where to write."""
    import time

    folder = PROJECT_RESEARCH_DIR / f"{project_id}-{int(time.time())}"
    (folder / "out").mkdir(parents=True, exist_ok=True)
    (folder / "guides").mkdir(parents=True, exist_ok=True)
    guides = workspace.workspace_path(project_id) / OUT_DIR
    for guide in guides.glob("*.md") if guides.exists() else []:
        shutil.copy2(guide, folder / "guides" / guide.name)
    scope = _scope(project_id)
    business = scope.get("business") if isinstance(scope.get("business"), dict) else {}
    pages = [f"- {p.get('name')} (`{p.get('path')}`), kind: {p.get('type') or '?'}: {p.get('purpose') or ''}"
             for p in scope.get("pages") or [] if isinstance(p, dict)][:40]
    features = [f"- {f.get('name')}: {f.get('description') or ''}"
                for f in scope.get("features") or [] if isinstance(f, dict)][:30]
    roles = [f"- {r.get('name')}: {r.get('description') or ''}" for r in scope.get("roles") or [] if isinstance(r, dict)]
    brief = "\n".join([
        "# The website to research for",
        "",
        f"- What it is: {scope.get('site_type') or ''}",
        f"- Kinds of website it combines: {', '.join(categories(project_id)) or '?'}",
        f"- Business: {business.get('name') or ''}, {business.get('industry') or ''}",
        f"- In short: {str(business.get('description') or scope.get('summary') or '')[:800]}",
        "",
        "## Who uses it", *roles,
        "", "## Its pages", *pages,
        "", "## What it must do", *features,
        "",
        "## Guides Gagesite already has (in guides/): the baseline. Read them first.",
        *[f"- guides/{g.name}" for g in sorted((folder / "guides").glob("*.md"))],
    ])
    (folder / "brief.md").write_text(brief, encoding="utf-8")
    prompt = ("Research this website as your instructions say. Start by reading brief.md and the guides in guides/, "
              "then write out/research.md and out/candidates.json.")
    return folder, prompt


def adopt_project_research(folder, project_id: str) -> bool:
    """Copy the project research into the project (docs/03-research/). False when nothing usable came back."""
    research = folder / "out" / "research.md"
    candidates = folder / "out" / "candidates.json"
    try:
        text = research.read_text(encoding="utf-8")
        listed = json.loads(candidates.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    if len(text) < 1000 or not isinstance(listed, list) or not listed:
        return False
    root = workspace.workspace_path(project_id) / PROJECT_OUT
    root.mkdir(parents=True, exist_ok=True)
    (root / "research.md").write_text(text, encoding="utf-8")
    (root / "candidates.json").write_text(json.dumps(listed, indent=2, ensure_ascii=False), encoding="utf-8")
    (root / "meta.json").write_text(json.dumps({"scope_hash": _scope_hash(project_id)}), encoding="utf-8")
    return True


def project_candidates(project_id: str) -> list:
    raw = workspace.read_text(project_id, f"{PROJECT_OUT}/candidates.json")
    try:
        data = json.loads(raw) if raw else []
    except json.JSONDecodeError:
        data = []
    return data if isinstance(data, list) else []
