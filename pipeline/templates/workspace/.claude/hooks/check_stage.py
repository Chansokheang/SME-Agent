"""Stop hook: blocks Claude from ending its turn until the stage's outputs are in place.

Exit code 2 sends the stderr message back to Claude, which keeps working.
The platform sets PIPELINE_STAGE in the environment of every `claude -p` run.
Standard library only: this runs inside the generated workspace.
"""

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(os.environ.get("CLAUDE_PROJECT_DIR", Path(__file__).resolve().parents[2]))
MAX_ROUNDS = 3  # how many times one turn can be sent back to fix its outputs


def block(message: str) -> None:
    print(message, file=sys.stderr)
    sys.exit(2)


# Exact shapes of the plan's business parts: (allowed fields, example shown to Claude when wrong).
SCOPE_LIST_SHAPES = {
    ("brief", "goals"): ({"goal", "measure"}, '[{ "goal": "...", "measure": "how the owner will know, with a number if possible" }]'),
    ("brief", "customers"): ({"name", "needs"}, '[{ "name": "...", "needs": ["...", "..."] }]'),
    ("content_checklist",): ({"item", "detail", "status", "kind", "files", "sample_keywords", "samples"}, '[{ "item": "Photos of drinks", "detail": "...", "status": "needed" | "provided" | "placeholder", "kind": "image" | "text" | "info", "files": [], "sample_keywords": "latte,coffee" }]'),
    ("compliance",): ({"item", "why"}, '[{ "item": "Privacy policy page", "why": "..." }]'),
    ("brief", "discovery"): ({"channel", "action"}, '[{ "channel": "Naver Place", "action": "..." }]'),
    ("brief", "launch", "owner_time"): ({"task", "time"}, '[{ "task": "...", "time": "about 10 minutes a day" }]'),
    ("brief", "launch", "timeline"): ({"step", "when", "who"}, '[{ "step": "...", "when": "Week 1", "who": "You" }]'),
    ("brief", "economics", "costs"): ({"item", "amount", "period"}, '[{ "item": "Domain name", "amount": "about ₩20,000", "period": "once" | "month" | "year" }]'),
    ("details", "hours"): ({"days", "time"}, '[{ "days": "Mon-Fri", "time": "10:00-22:00" }]'),
    ("details", "links"): ({"name", "url"}, '[{ "name": "Instagram", "url": "..." }]'),
    ("details", "other"): ({"label", "value", "hint"}, '[{ "label": "Shipping fee", "value": "", "hint": "Fee per order and the free-shipping minimum" }]'),
    ("permissions",): ({"action", "roles"}, '[{ "action": "Request a table", "roles": ["Visitor"] }]'),
    ("flows",): ({"id", "name", "role", "goal", "features", "steps", "problems"}, '[{ "id": "FL1", "name": "...", "role": "Visitor", "goal": "...", "features": ["F2"], "steps": [...], "problems": [...] }]'),
    ("lifecycles",): ({"thing", "states", "changes"}, '[{ "thing": "Reservation", "states": [...], "changes": [...] }]'),
    ("notifications",): ({"name", "to", "when", "channel"}, '[{ "name": "...", "to": "Customer", "when": "...", "channel": "email" | "screen" | "sms" | "kakao" }]'),
}
SCOPE_OBJECT_SHAPES = {
    ("brief", "main_action"): ({"label", "why"}, '{ "label": "Request a table", "why": "..." }'),
    ("brief", "value"): ({"proposition", "revenue", "saves", "competitors"}, '{ "proposition": "one sentence", "revenue": ["..."], "saves": ["..."], "competitors": ["..."] }'),
    ("brief", "running"): ({"updates", "monthly_cost", "notes"}, '{ "updates": ["Owner: menu and hours"], "monthly_cost": "...", "notes": "..." }'),
    ("details",): ({"phone", "email", "address", "hours", "links", "legal_name", "representative", "registration_number", "domain", "other", "not_needed"}, '{ "phone": "", "email": "", "address": "", "hours": [...], "links": [...], "legal_name": "", "representative": "", "registration_number": "", "domain": "", "other": [...] }'),
    ("brief", "economics"): ({"costs", "expected_return", "payback", "basis"}, '{ "costs": [...], "expected_return": "...", "payback": "...", "basis": "..." }'),
    ("brief", "launch"): ({"owner_time", "timeline"}, '{ "owner_time": [...], "timeline": [...] }'),
    ("data_storage",): ({"needs_database", "why", "existing"}, '{ "needs_database": true | false | null, "why": "...", "existing": "" | "database" | "spreadsheets" | "other" }'),
    ("program_access",): ({"needed", "why", "users", "reads", "writes"}, '{ "needed": true | false | null, "why": "...", "users": ["Partner labs analysis scripts"], "reads": ["Proteins with their results"], "writes": [] }'),
    ("existing_site",): ({"url", "owned", "keep"}, '{ "url": "https://...", "owned": true | false | null, "keep": "..." }'),
}


def scope_shape_problems(scope: dict) -> list[str]:
    def get(path):
        value = scope
        for key in path:
            if not isinstance(value, dict):
                return None
            value = value.get(key)
        return value

    problems = []
    if "brief" in scope and not isinstance(scope["brief"], dict):
        return ['"brief" must be an object with main_action, goals, customers, value, running']
    for path, (fields, example) in SCOPE_OBJECT_SHAPES.items():
        value = get(path)
        if value is None:
            continue
        if not isinstance(value, dict) or set(value) - fields:
            problems.append(f'{".".join(path)} must look like {example} (no other fields)')
    for path, (fields, example) in SCOPE_LIST_SHAPES.items():
        value = get(path)
        if value is None:
            continue
        bad = not isinstance(value, list) or any(not isinstance(i, dict) or set(i) - fields for i in value)
        if not bad and path == ("content_checklist",):
            bad = any(i.get("status", "needed") not in ("needed", "provided", "placeholder") for i in value)
        if bad:
            problems.append(f'{".".join(path)} must look like {example} (each item an object, no other fields)')
    skippable = {"address", "hours", "links", "representative", "registration_number", "domain"}
    not_needed = (scope.get("details") or {}).get("not_needed") if isinstance(scope.get("details"), dict) else None
    if not_needed is not None and (not isinstance(not_needed, list) or set(not_needed) - skippable):
        problems.append("details.not_needed may only list: " + ", ".join(sorted(skippable)))
    for key in ("business_rules",):
        value = scope.get(key)
        if value is not None and (not isinstance(value, list) or any(not isinstance(i, str) for i in value)):
            problems.append(f"{key} must be a list of plain sentences")
    for flow in scope.get("flows", []) or []:
        if not isinstance(flow, dict):
            continue
        steps, flow_problems = flow.get("steps", []), flow.get("problems", [])
        if not isinstance(steps, list) or any(not isinstance(i, dict) or set(i) - {"actor", "page", "action", "result"} for i in steps):
            problems.append('flows[].steps must look like [{ "actor": "Visitor" | "Owner" | "System", "page": "Reserve a Table", "action": "...", "result": "..." }]')
            break
        if not isinstance(flow_problems, list) or any(not isinstance(i, dict) or set(i) - {"when", "then"} for i in flow_problems):
            problems.append('flows[].problems must look like [{ "when": "The time is already full", "then": "Show the next free times" }]')
            break
    for cycle in scope.get("lifecycles", []) or []:
        if not isinstance(cycle, dict):
            continue
        states, changes = cycle.get("states", []), cycle.get("changes", [])
        if not isinstance(states, list) or any(not isinstance(i, dict) or set(i) - {"name", "meaning"} for i in states):
            problems.append('lifecycles[].states must look like [{ "name": "pending", "meaning": "..." }]')
            break
        if not isinstance(changes, list) or any(not isinstance(i, dict) or set(i) - {"from", "to", "trigger"} for i in changes):
            problems.append('lifecycles[].changes must look like [{ "from": "pending", "to": "confirmed", "trigger": "Owner confirms" }]')
            break
    for feature in scope.get("features", []) or []:
        done = feature.get("done_when") if isinstance(feature, dict) else None
        if done is not None and (not isinstance(done, list) or any(not isinstance(i, str) for i in done)):
            problems.append("features[].done_when must be a list of plain sentences")
            break
    return problems


def check_scope() -> None:
    scope_path = ROOT / "docs" / "01-scope.json"
    if not scope_path.exists():
        block(
            "docs/01-scope.json does not exist yet. Before ending your turn, write the "
            "current draft of the scope there (status 'draft'), even if many fields are empty."
        )
    try:
        scope = json.loads(scope_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        block(f"docs/01-scope.json is not valid JSON ({exc}). Fix the file.")

    required = ["status", "business", "pages", "features", "open_questions"]
    missing = [key for key in required if key not in scope]
    if missing:
        block(f"docs/01-scope.json is missing top-level keys: {', '.join(missing)}.")
    # The app and later stages read these exact keys; anything else is invisible to them.
    known = {
        "version", "status", "business", "details", "brief", "site_type", "site_category", "site_categories", "roles", "pages", "features",
        "business_rules", "permissions", "flows", "lifecycles", "notifications", "data_storage",
        "program_access", "existing_site", "entities", "integrations", "keys", "branding", "content_checklist",
        "compliance", "assumptions", "open_questions",
    }
    unknown = sorted(set(scope) - known)
    if unknown:
        block(
            f"docs/01-scope.json has keys the app does not read: {', '.join(unknown)}. Use exactly the "
            "structure in your instructions: the main action, goals with measures, customer needs, business "
            "value and running the site go inside 'brief' (main_action, goals, customers, value, running); "
            "what the owner must send goes in 'content_checklist'; legal items go in 'compliance'. Move the "
            "content there and remove the other keys. Keep every other part of the plan as it was."
        )

    problems = scope_shape_problems(scope)
    if problems:
        block(
            "docs/01-scope.json uses shapes the app cannot read. Fix these and keep the content: "
            + " ".join(f"({i}) {p}" for i, p in enumerate(problems[:8], 1))
        )

    if scope.get("status") == "ready":
        if not (ROOT / "docs" / "01-scope.md").exists():
            block("Scope status is 'ready' but docs/01-scope.md (the plain-language summary) is missing.")
        if not scope.get("business", {}).get("name"):
            block("Scope status is 'ready' but business.name is empty.")
        if not scope.get("pages") or not scope.get("features"):
            block("Scope status is 'ready' but it has no pages or no features.")
        brief = scope.get("brief") or {}
        problems = []
        if not (brief.get("main_action") or {}).get("label"):
            problems.append("brief.main_action.label is empty (the one thing visitors should do)")
        if not any(g.get("goal") and g.get("measure") for g in brief.get("goals") or []):
            problems.append("brief.goals needs at least one goal with a measure")
        undone = [f.get("name") or f.get("id") for f in scope.get("features", [])
                  if f.get("priority") == "must" and not f.get("done_when")]
        if undone:
            problems.append("these must-have features have no done_when checks: " + ", ".join(map(str, undone)))
        if not scope.get("content_checklist"):
            problems.append("content_checklist is empty (what the owner needs to provide)")
        if not ((brief.get("economics") or {}).get("expected_return")):
            problems.append("brief.economics.expected_return is empty (a simple estimate in won)")
        if not brief.get("discovery"):
            problems.append("brief.discovery is empty (how customers will find the business)")
        if not ((brief.get("launch") or {}).get("timeline")):
            problems.append("brief.launch.timeline is empty (steps from approval to launch)")
        if not scope.get("permissions"):
            problems.append("permissions is empty (who may do what)")
        access = scope.get("program_access") or {}
        if access.get("needed") not in (True, False):
            problems.append("program_access.needed must be true or false (do other programs need to fetch the data?)")
        elif access.get("needed") and not access.get("reads"):
            problems.append("program_access.reads is empty (what other programs may fetch)")
        used = {fid for flow in scope.get("flows", []) or [] if isinstance(flow, dict) for fid in flow.get("features", []) or []}
        unused = [f.get("name") or f.get("id") for f in scope.get("features", [])
                  if f.get("priority") == "must" and f.get("id") not in used]
        if unused:
            problems.append("these must-have features are not used by any flow (add them to a flow's features): " + ", ".join(map(str, unused)))
        if problems:
            block("Scope status is 'ready' but the project brief is incomplete: " + "; ".join(problems) + ".")


def prisma_validate(schema_path: Path) -> str | None:
    """Returns Prisma's error text, or None when valid or when Prisma can't be run at all."""
    npx = shutil.which("npx")
    if not npx:
        return None
    try:
        result = subprocess.run(
            [npx, "--yes", "prisma@6", "validate", "--schema", str(schema_path)],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180, cwd=ROOT,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode == 0:
        return None
    output = (result.stdout + result.stderr).strip()
    # Only block on real schema errors, not on npm/network trouble fetching Prisma.
    if "validat" in output.lower() or "error code: p1012" in output.lower():
        return output[-3000:]
    return None


def check_database() -> None:
    schema_path = ROOT / "docs" / "02-schema.json"
    if not schema_path.exists():
        block(
            "docs/02-schema.json does not exist yet. Before ending your turn, write your current "
            "database design there (status 'draft')."
        )
    try:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        block(f"docs/02-schema.json is not valid JSON ({exc}). Fix the file.")

    missing = [key for key in ("status", "tables", "relations", "open_questions") if key not in schema]
    if missing:
        block(f"docs/02-schema.json is missing top-level keys: {', '.join(missing)}.")

    if schema.get("mode") == "none":
        # A simple site without a database: content lives in files, forms send email.
        files = schema.get("content_files")
        forms = schema.get("email_forms", [])
        if not isinstance(files, list) or any(not isinstance(f, dict) or not f.get("file") for f in files):
            block('content_files must look like [{ "file": "content/menu.json", "holds": "..." }].')
        if not isinstance(forms, list) or any(not isinstance(f, dict) or not f.get("form") for f in forms):
            block('email_forms must look like [{ "form": "Contact form", "to": "Owner", "note": "..." }].')
        if schema.get("tables"):
            block('mode is "none" (no database) but tables are listed. Empty "tables" and "relations", '
                  "or set mode to \"database\".")
        if schema.get("status") == "ready":
            if not files:
                block("Status is 'ready' but content_files is empty: list the files that hold the site's content.")
            if not (ROOT / "docs" / "02-database.md").exists():
                block("Status is 'ready' but docs/02-database.md (the plain-language summary) is missing.")
        return

    tables = {t.get("name"): {c.get("name") for c in t.get("columns", [])} for t in schema.get("tables", [])}
    problems = []
    for table in schema.get("tables", []):
        for col in table.get("columns", []):
            ref = col.get("references")
            if ref and ref.get("column") not in tables.get(ref.get("table"), set()):
                problems.append(f"{table.get('name')}.{col.get('name')} references missing {ref.get('table')}.{ref.get('column')}")
    if problems:
        block("docs/02-schema.json has broken references: " + "; ".join(problems))

    prisma_path = ROOT / "docs" / "02-schema.prisma"
    if tables and not prisma_path.exists():
        block("docs/02-schema.json has tables but docs/02-schema.prisma is missing. Write the Prisma schema too.")

    if schema.get("status") == "ready":
        if not (ROOT / "docs" / "02-database.md").exists():
            block("Status is 'ready' but docs/02-database.md (the plain-language summary) is missing.")
        # Every entity from the approved scope needs a table, or an explanation in assumptions.
        scope = json.loads((ROOT / "docs" / "01-scope.json").read_text(encoding="utf-8"))
        names = " ".join(
            f"{t.get('name', '')} {t.get('label', '')}" for t in schema.get("tables", [])
        ).lower() + " " + " ".join(schema.get("assumptions", [])).lower()
        uncovered = [e["name"] for e in scope.get("entities", []) if e.get("name") and e["name"].lower() not in names]
        if uncovered:
            block(
                "These entities from the approved scope have no table: " + ", ".join(uncovered)
                + ". Add a table for each, or explain in `assumptions` (mentioning the entity by name) why not."
            )
        error = prisma_validate(prisma_path)
        if error:
            block("docs/02-schema.prisma fails `prisma validate`. Fix it so it matches the JSON:\n" + error)


ADMIN_PAGE = re.compile(r"admin|login|log-in|sign-in|dashboard|account|관리|로그인", re.IGNORECASE)


def site_pages(scope: dict) -> list[dict]:
    """The plan's pages, minus admin and login pages when the site has no database."""
    try:
        schema = json.loads((ROOT / "docs" / "02-schema.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        schema = {}
    pages = [p for p in scope.get("pages", []) if isinstance(p, dict)]
    if schema.get("mode") != "none":
        return pages
    return [p for p in pages if not ADMIN_PAGE.search(f"{p.get('path', '')} {p.get('name', '')}")]


def page_slug(path: str) -> str:
    slug = path.strip("/").replace("/", "-")
    return slug or "home"


def check_html(relative: str) -> str | None:
    """A mockup must be a full page that works on phones and contains no filler text."""
    path = ROOT / "docs" / "03-design" / relative
    if not path.exists():
        return f"{relative} is missing"
    html = path.read_text(encoding="utf-8", errors="replace").lower()
    if "<html" not in html or "name=\"viewport\"" not in html:
        return f"{relative} must be a full HTML document with a viewport meta tag"
    if "lorem ipsum" in html:
        return f"{relative} contains 'Lorem ipsum'; use real content"
    if "cdn.tailwindcss.com" not in html:
        return f"{relative} must load Tailwind from https://cdn.tailwindcss.com"
    return None


def require_review(files: list[str]) -> None:
    """Every preview must have been screenshotted (and so looked at) after its last change."""
    design = ROOT / "docs" / "03-design"
    stale = []
    for rel in files:
        page = design / rel
        slug = re.sub(r"[^a-z0-9]+", "-", rel.lower().removesuffix(".html")).strip("-")
        shot = design / ".shots" / f"{slug}-desktop.png"
        if page.exists() and (not shot.exists() or shot.stat().st_mtime < page.stat().st_mtime):
            stale.append(rel)
    if stale:
        block("Look at your work before finishing: run `npm run design-shot -- " + " ".join(stale) + "`, Read every "
              "screenshot, fix what is wrong (see 'Check your own work'), and screenshot again.")


def check_design() -> None:
    design_path = ROOT / "docs" / "03-design" / "design.json"
    if not design_path.exists():
        block("docs/03-design/design.json does not exist yet. Write it before ending your turn (status 'choosing').")
    try:
        design = json.loads(design_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        block(f"docs/03-design/design.json is not valid JSON ({exc}).")

    status = design.get("status")
    if status not in ("choosing", "designing", "ready"):
        block("docs/03-design/design.json: status must be 'choosing', 'designing' or 'ready'.")

    if status == "choosing":
        directions_path = ROOT / "docs" / "03-design" / "directions.json"
        try:
            directions = json.loads(directions_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            block("docs/03-design/directions.json is missing or not valid JSON. Describe the style there.")
        if not isinstance(directions, list) or not 1 <= len(directions) <= 3:
            block("docs/03-design/directions.json must list one to three styles (ids 1-3); update them instead of adding more.")
        ids = [d.get("id") for d in directions if isinstance(d, dict)]
        if sorted(ids) != list(range(1, len(directions) + 1)):
            block("docs/03-design/directions.json: give the styles ids 1, 2, 3 in order.")
        if len(directions) > 1 and sum(1 for d in directions if d.get("recommended")) != 1:
            block('Mark exactly one style with "recommended": true (the one you would pick).')
        problems = [p for p in (check_html(f"directions/{d.get('id')}.html") for d in directions) if p]
        if problems:
            block("Direction previews need fixing: " + "; ".join(problems))
        require_review([f"directions/{d.get('id')}.html" for d in directions])

    if status == "ready":
        try:
            json.loads((ROOT / "docs" / "03-design" / "tokens.json").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            block("Status is 'ready' but docs/03-design/tokens.json is missing or not valid JSON.")
        if not (ROOT / "docs" / "03-design.md").exists():
            block("Status is 'ready' but docs/03-design.md (the plain-language description) is missing.")
        scope = json.loads((ROOT / "docs" / "01-scope.json").read_text(encoding="utf-8"))
        slugs = [page_slug(pg.get("path", "")) for pg in site_pages(scope)]
        key_pages = design.get("key_pages")
        if not isinstance(key_pages, list) or not 1 <= len(key_pages) <= 3:
            block('design.json needs "key_pages": the slugs of the one or two most important pages you drew.')
        bare = {s.replace("[", "").replace("]", "") for s in slugs}  # "papers-id" = "papers-[id]"
        unknown = [k for k in key_pages if k not in slugs and str(k).replace("[", "").replace("]", "") not in bare]
        if unknown:
            block(f"key_pages must be page slugs from the plan ({', '.join(slugs)}); unknown: {', '.join(map(str, unknown))}")
        problems = [p for p in (check_html(f"pages/{slug}.html") for slug in key_pages) if p]
        if problems:
            block("The key pages need a finished mockup: " + "; ".join(problems))
        require_review([f"pages/{slug}.html" for slug in key_pages])
        check_components()


def check_components() -> None:
    """The component library: components.json entries, each with a matching section in components.html."""
    try:
        components = json.loads((ROOT / "docs" / "03-design" / "components.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        block("docs/03-design/components.json (the component library) is missing or not valid JSON.")
    if not isinstance(components, list) or len(components) < 6:
        block("docs/03-design/components.json should list every reusable component the pages use (at least 6).")
    incomplete = [str(c.get("id", "?")) for c in components if not all(c.get(k) for k in ("id", "name", "group"))]
    if incomplete:
        block("Every entry in components.json needs id, name and group. Fix: " + ", ".join(incomplete))
    problem = check_html("components.html")
    if problem:
        block("Component library: " + problem)
    html = (ROOT / "docs" / "03-design" / "components.html").read_text(encoding="utf-8", errors="replace")
    missing = [c.get("id") for c in components if f'id="{c.get("id")}"' not in html]
    if missing:
        block("components.html needs a <section id=\"...\"> for: " + ", ".join(map(str, missing)))


def site_routes() -> dict[str, Path]:
    """Route path -> page file, from site/src/app (route groups like "(admin)" don't count)."""
    app = ROOT / "site" / "src" / "app"
    routes: dict[str, Path] = {}
    for page in app.rglob("page.tsx") if app.is_dir() else []:
        parts = [p for p in page.parent.relative_to(app).parts if not (p.startswith("(") and p.endswith(")"))]
        routes["/" + "/".join(parts)] = page
    return routes


def npm(script: str, timeout: int) -> tuple[bool, str]:
    """Runs one of the workspace's site:* scripts; (passed, last lines of output)."""
    npm_bin = shutil.which("npm") or "npm"
    try:
        done = subprocess.run([npm_bin, "run", script], cwd=ROOT, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=timeout)
    except subprocess.TimeoutExpired:
        return False, f"npm run {script} took longer than {timeout}s"
    lines = (done.stdout + "\n" + done.stderr).strip().splitlines()
    return done.returncode == 0, "\n".join(lines[-40:])


def build_file() -> tuple[dict, list, list, dict]:
    """docs/04-build.json must exist, be well formed and list every page of the plan."""
    build_path = ROOT / "docs" / "04-build.json"
    if not build_path.exists():
        block("docs/04-build.json does not exist yet. Write it with every page of the plan before ending your turn.")
    try:
        build = json.loads(build_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        block(f"docs/04-build.json is not valid JSON ({exc}).")
    status = build.get("status")
    if status not in ("building", "ready"):
        block("docs/04-build.json: status must be 'building' or 'ready'.")
    pages = build.get("pages")
    if not isinstance(pages, list) or any(not isinstance(p, dict) or not p.get("path") for p in pages):
        block('docs/04-build.json "pages" must look like [{ "path": "/", "name": "Home", "status": "todo", "preview": "/" }].')
    try:
        setup = json.loads((ROOT / "docs" / "04-setup.json").read_text(encoding="utf-8")).get("setup")
    except (OSError, json.JSONDecodeError):
        setup = "all_in_one"
    scope = json.loads((ROOT / "docs" / "01-scope.json").read_text(encoding="utf-8"))
    listed = {p["path"] for p in pages}
    if setup == "landing":
        # A landing page folds the plan's pages into sections of one page: only "/" is required.
        if "/" not in listed:
            block('docs/04-build.json must list the landing page: { "path": "/", "name": "Landing page", ... }.')
    else:
        missing = [p.get("path") for p in site_pages(scope) if p.get("path") and p.get("path") not in listed]
        if missing:
            block("docs/04-build.json must list every page of the plan. Missing: " + ", ".join(missing))
    api = build.get("api", [])
    # A dedicated service: /api/v1/... (projects started before the layered starter used /v1/...).
    api_prefix = ("/api/v1/", "/v1/") if setup == "api_service" else ("/api/",)
    if not isinstance(api, list) or any(not isinstance(e, dict) or not str(e.get("path", "")).startswith(api_prefix) for e in api):
        block('docs/04-build.json "api" must look like [{ "method": "GET", "path": "/api/v1/products", "name": "...", '
              '"status": "todo", "preview": "/api/v1/products?limit=5" }].')
    if setup == "api_service":
        check_service()
    if setup == "static_external":
        own_backend = [str(path.relative_to(ROOT)).replace("\\", "/")
                       for folder in ("src", "prisma") if (ROOT / "site" / folder).is_dir()
                       for path in (ROOT / "site" / folder).rglob("*.ts*")
                       if re.search(r"@prisma/client|from ['\"]next-auth|['\"]use server['\"]",
                                    path.read_text(encoding="utf-8", errors="replace"))]
        if own_backend:
            block('The owner chose "static UI + another service\'s API" (docs/04-setup.json): no backend or database '
                  "of our own. Remove these (load the data from the service instead): " + ", ".join(own_backend[:8]))
    if (scope.get("program_access") or {}).get("needed") and not api:
        block('The plan gives other programs access to the data (program_access), but docs/04-build.json has no "api" '
              'list. List every API address there (see "Access for other programs") and build them.')
    return build, pages, api, scope


def check_service() -> None:
    """UI + dedicated API: the service exists and type-checks; the website keeps no database of its own."""
    service = ROOT / "service"
    if not ((service / "package.json").exists() or (service / "requirements.txt").exists()):
        block("The owner chose UI + a dedicated API service, but service/ is missing. It should have been set up "
              "from the starter: say so to the owner.")
    if (service / "node_modules").is_dir() or (service / ".venv").is_dir():
        passed, output = npm("service:typecheck", 240)
        if not passed:
            block("The API service has errors. Fix them, then run `npm run service:typecheck` again:\n" + output)
    site_db = [str(path.relative_to(ROOT)).replace("\\", "/") for path in (ROOT / "site" / "src").rglob("*.ts*")
               if (ROOT / "site" / "src").is_dir()
               and re.search(r"@prisma/client|from ['\"]next-auth", path.read_text(encoding="utf-8", errors="replace"))]
    if site_db:
        block("With a dedicated API service the website only calls the service: no database or Auth.js in site/. "
              "Move this to the service: " + ", ".join(site_db[:8]))


def check_build() -> None:
    build, pages, api, scope = build_file()
    status = build.get("status")
    routes = site_routes()
    final_passed = False
    done = [p for p in pages if p.get("status") == "done"]
    built = {r.rstrip("/") or "/" for r in routes}
    absent = [p["path"] for p in done if (p["path"].rstrip("/") or "/") not in built]
    if absent:
        block("These pages are marked done but have no page.tsx under site/src/app: " + ", ".join(absent))

    if not (ROOT / "site" / "package.json").exists():
        block("site/package.json is missing: the website's code lives in site/.")
    if done and not (ROOT / "site" / "node_modules").is_dir():
        block("Install the packages first: run `npm run site:install`, then check your work with `npm run site:typecheck`.")
    config = ROOT / "site" / "next.config.ts"
    if config.exists() and "NEXT_DIST_DIR" not in config.read_text(encoding="utf-8"):
        block('site/next.config.ts must keep `distDir: process.env.NEXT_DIST_DIR || ".next"` so checks and builds never '
              "disturb the owner's live preview. Put it back.")
    if (ROOT / "site" / "node_modules").is_dir():
        passed, output = npm("site:typecheck", 240)
        if not passed:
            block("The website's code has type errors. Fix them, then run `npm run site:typecheck` again:\n" + output)
        check_keys_usage()
        if done:
            # Open the website like the owner would: log in, open every finished page, follow links.
            python = os.environ.get("GAGESITE_PYTHON") or sys.executable
            try:
                checked = subprocess.run([python, str(ROOT / ".claude" / "hooks" / "site_check.py")], cwd=ROOT,
                                         capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900)
                final_passed = checked.returncode == 0 and "FINAL test" in checked.stdout
                if checked.returncode == 1:
                    block("The self-test found problems in the website. Fix every one, check with `npm run site:check`, "
                          "then finish your turn:\n" + "\n".join(checked.stdout.strip().splitlines()[-80:]))
            except subprocess.TimeoutExpired:
                block("The self-test (`npm run site:check`) took longer than 15 minutes: a page is probably hanging. "
                      "Run it yourself and look at which page it stops on.")

    if status == "ready":
        not_done = [p["path"] for p in pages if p.get("status") != "done"]
        not_done += [f"API {e.get('method', 'GET')} {e['path']}" for e in api if e.get("status") != "done"]
        if not_done:
            block("Status is 'ready' but these are not done: " + ", ".join(not_done))
        if not (ROOT / "docs" / "04-build.md").exists():
            block("Status is 'ready' but docs/04-build.md (the plain-language summary for the owner) is missing.")
        check_keys_wired()
        if not final_passed:  # the final self-test already built the site; otherwise build it here
            passed, output = npm("site:build", 540)
            if not passed:
                block("Status is 'ready' but the production build fails. Fix it (`npm run site:build`):\n" + output)


USE_CLIENT = re.compile(r"""^\s*(?://[^\n]*\n\s*|/\*.*?\*/\s*)*["']use client["']""", re.DOTALL)


def check_keys_usage() -> None:
    """Secret keys (docs/keys.json) are read on the server only: never in a "use client" file and
    never under a NEXT_PUBLIC_ name, both of which reach every visitor's browser."""
    try:
        manifest = json.loads((ROOT / "docs" / "keys.json").read_text(encoding="utf-8"))
        keys = [*(manifest.get("keys") or []), *(manifest.get("suggested") or [])]
    except (OSError, json.JSONDecodeError, AttributeError):
        return
    secret = [k["name"] for k in keys if isinstance(k, dict) and k.get("name") and k.get("secret", True) is not False]
    src = ROOT / "site" / "src"
    if not secret or not src.is_dir():
        return
    problems: list[str] = []
    for path in sorted(list(src.rglob("*.tsx")) + list(src.rglob("*.ts"))):
        text = path.read_text(encoding="utf-8", errors="replace")
        relative = path.relative_to(ROOT / "site").as_posix()
        for name in secret:
            if re.search(rf"\bNEXT_PUBLIC_{re.escape(name)}\b", text):
                problems.append(f"{relative} uses NEXT_PUBLIC_{name}: a secret must never be public")
            elif USE_CLIENT.match(text) and re.search(rf"\b{re.escape(name)}\b", text):
                problems.append(f"{relative} is a browser (\"use client\") file but reads {name}: read it on the server")
    if problems:
        block("A secret key would reach visitors' browsers. Fix this:\n- " + "\n- ".join(problems[:20]))


def owner_keys() -> list[str]:
    """The keys the owner added in Keys & settings (docs/keys.json, `source: owner`)."""
    try:
        manifest = json.loads((ROOT / "docs" / "keys.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return [k["name"] for k in manifest.get("keys") or []
            if isinstance(k, dict) and k.get("name") and k.get("source") == "owner"]


def build_setup() -> str:
    try:
        return json.loads((ROOT / "docs" / "04-setup.json").read_text(encoding="utf-8")).get("setup") or "all_in_one"
    except (OSError, json.JSONDecodeError, AttributeError):
        return "all_in_one"


def check_keys_wired() -> None:
    """Every key the owner added is read by the code it is for: a feature never stays on sample
    answers because nobody connected the owner's service. (A static UI has no server to read them.)"""
    names = owner_keys()
    if not names or build_setup() == "static_external":
        return
    code = ""
    for folder, patterns in ((ROOT / "site" / "src", ("*.ts", "*.tsx")),
                             (ROOT / "service", ("*.ts", "*.py"))):
        if folder.is_dir():
            for pattern in patterns:
                for path in folder.rglob(pattern):
                    if "node_modules" not in path.parts and ".venv" not in path.parts:
                        code += path.read_text(encoding="utf-8", errors="replace") + "\n"
    unused = [n for n in names if not re.search(rf"\b{re.escape(n)}\b", code)]
    if unused:
        block("The owner added these keys in Keys & settings, but no code reads them, so their feature would only "
              "give sample answers: " + ", ".join(unused) + ". Connect each one to its service on the server "
              "(see \"Keys & settings\" in your instructions), keep mock mode for when a value is missing, "
              "and check with `npm run site:typecheck`.")


TASK_ID = re.compile(r"^T\d{2,3}$")
TASK_KINDS = ("setup", "shared", "page", "api", "change", "bug")


def check_advisor() -> None:
    """The Advisor plans: docs/04-build.json plus a task board that covers every page once."""
    build, pages, api, _ = build_file()
    board_path = ROOT / "docs" / "04-tasks.json"
    if not board_path.exists():
        block("docs/04-tasks.json does not exist yet. Write the task board (see your role instructions).")
    try:
        board = json.loads(board_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        block(f"docs/04-tasks.json is not valid JSON ({exc}).")
    tasks = board.get("tasks")
    if not isinstance(tasks, list) or not tasks:
        block('docs/04-tasks.json needs a "tasks" list with at least one task.')
    seen: list[str] = []
    problems: list[str] = []
    covered: dict[str, list[str]] = {}
    for task in tasks:
        tid = str(task.get("id", "")) if isinstance(task, dict) else ""
        if not TASK_ID.match(tid):
            problems.append(f"A task needs an id like T01 (found {tid or 'none'})")
            continue
        if tid in seen:
            problems.append(f"{tid} is used twice")
        if not str(task.get("title", "")).strip():
            problems.append(f"{tid} has no title")
        if task.get("kind") not in TASK_KINDS:
            problems.append(f"{tid}: kind must be one of {', '.join(TASK_KINDS)}")
        if not isinstance(task.get("pages", []), list):
            problems.append(f"{tid}: pages must be a list")
        deps = task.get("depends_on", [])
        if not isinstance(deps, list) or any(d not in seen for d in deps):
            problems.append(f"{tid}: depends_on may only name tasks listed before it ({deps})")
        acceptance = task.get("acceptance")
        if not isinstance(acceptance, list) or not (1 <= len(acceptance) <= 8) or any(not str(a).strip() for a in acceptance):
            problems.append(f"{tid}: give 1 to 8 concrete acceptance checks")
        if task.get("kind") not in ("change", "bug"):
            for path in task.get("pages", []) if isinstance(task.get("pages", []), list) else []:
                covered.setdefault(str(path), []).append(tid)
        seen.append(tid)
    listed = [p["path"] for p in pages] + [e["path"] for e in api]
    missing = [path for path in listed if path not in covered]
    twice = [f"{path} ({', '.join(ids)})" for path, ids in covered.items() if len(ids) > 1]
    unknown = [path for path in covered if path not in listed]
    if missing:
        problems.append("No task builds: " + ", ".join(missing))
    if twice:
        problems.append("Built by more than one task (each page belongs to exactly one): " + ", ".join(twice))
    if unknown:
        problems.append("Tasks name pages that docs/04-build.json does not list: " + ", ".join(unknown))
    problems += lane_problems(tasks, api)
    if build_setup() != "static_external":
        board_text = json.dumps(tasks, ensure_ascii=False)
        unplanned = [n for n in owner_keys() if n not in board_text]
        if unplanned:
            problems.append("The owner added these keys in Keys & settings, but no task connects them (name each key "
                            "in the task that uses it, with an acceptance check): " + ", ".join(unplanned))
    if problems:
        block("The task board needs fixing:\n- " + "\n- ".join(problems))


def lane_problems(tasks: list, api: list) -> list[str]:
    """UI + dedicated API: two developers work at once, each in a lane, against one contract."""
    try:
        setup = json.loads((ROOT / "docs" / "04-setup.json").read_text(encoding="utf-8")).get("setup")
    except (OSError, json.JSONDecodeError):
        setup = None
    if setup != "api_service":
        return []
    problems: list[str] = []
    try:
        contract = json.loads((ROOT / "docs" / "04-api.json").read_text(encoding="utf-8"))
        endpoints = contract.get("endpoints")
        if not isinstance(endpoints, list) or not endpoints or any(
                not isinstance(e, dict) or not e.get("method") or not str(e.get("path", "")).startswith(("/api/v1/", "/v1/"))
                for e in endpoints):
            problems.append('docs/04-api.json needs "endpoints": [{ "method", "path": "/api/v1/...", "roles", "response", ... }]')
    except (OSError, json.JSONDecodeError):
        problems.append("Write docs/04-api.json, the contract both developers build against (see your instructions)")
    api_paths = {str(e.get("path")) for e in api if isinstance(e, dict)}
    for task in tasks:
        if not isinstance(task, dict):
            continue
        tid, lane = task.get("id", "?"), task.get("lane")
        if lane not in ("api", "ui"):
            problems.append(f'{tid}: give it "lane": "api" or "lane": "ui"')
            continue
        paths = [str(p) for p in task.get("pages", []) if isinstance(task.get("pages", []), list)]
        if lane == "api" and any(p not in api_paths for p in paths):
            problems.append(f"{tid} is an API task but lists pages: " + ", ".join(p for p in paths if p not in api_paths))
        if lane == "ui" and any(p in api_paths for p in paths):
            problems.append(f"{tid} is a UI task but lists API addresses: " + ", ".join(p for p in paths if p in api_paths))
    lanes = {t.get("lane") for t in tasks if isinstance(t, dict)}
    if tasks and not {"api", "ui"} <= lanes:
        problems.append("Plan tasks for BOTH lanes (api and ui) so the two developers can work at the same time")
    return problems


def check_developer() -> None:
    """The Developer finishes with code that type-checks and a report on its one task."""
    task = os.environ.get("GAGESITE_TASK", "")
    _, pages, _, _ = build_file()
    built = {r.rstrip("/") or "/" for r in site_routes()}
    absent = [p["path"] for p in pages if p.get("status") == "done" and (p["path"].rstrip("/") or "/") not in built]
    if absent:
        block("These pages are marked done but have no page.tsx under site/src/app: " + ", ".join(absent))
    config = ROOT / "site" / "next.config.ts"
    if config.exists() and "NEXT_DIST_DIR" not in config.read_text(encoding="utf-8"):
        block('site/next.config.ts must keep `distDir: process.env.NEXT_DIST_DIR || ".next"`. Put it back.')
    if (ROOT / "site" / "node_modules").is_dir():
        passed, output = npm("site:typecheck", 240)
        if not passed:
            block("The website's code has type errors. Fix them, then run `npm run site:typecheck` again:\n" + output)
    elif any(p.get("status") == "done" for p in pages):
        block("Install the packages first: run `npm run site:install`, then `npm run site:typecheck`.")
    check_keys_usage()
    report_path = ROOT / "docs" / "04-runs" / f"{task}.json"
    if not report_path.exists():
        block(f"Write your report docs/04-runs/{task}.json before finishing (see your role instructions).")
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        block(f"docs/04-runs/{task}.json is not valid JSON ({exc}).")
    if report.get("task") != task or not str(report.get("summary", "")).strip():
        block(f'docs/04-runs/{task}.json needs "task": "{task}" and a "summary".')
    expected = [b for b in os.environ.get("GAGESITE_BUGS", "").split(",") if b]
    answered = {str(b.get("id")) for b in report.get("bugs", []) if isinstance(b, dict)
                and b.get("result") in ("fixed", "cannot_reproduce")}
    unanswered = [b for b in expected if b not in answered]
    if unanswered:
        block("Your report must answer every bug from QA with fixed or cannot_reproduce. Missing: " + ", ".join(unanswered))
    check_developer_selftest(report)


def check_developer_selftest(report: dict) -> None:
    """Hand over only work the self-test has seen: run this turn, after the last code change, and clean
    (or every remaining problem explained). Otherwise QA finds what the Developer could have seen."""
    _, pages, _, _ = build_file()
    if not any(p.get("status") == "done" for p in pages):
        return  # nothing for the self-test to open yet (e.g. a setup task)
    started = float(os.environ.get("GAGESITE_RUN_STARTED") or 0)
    try:
        result = json.loads((ROOT / "docs" / "04-check.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        result = {}
    checked_at = float(result.get("checked_at") or 0)
    if checked_at < started:
        block("Run the self-test before you hand over: `npm run site:check`. Fix what it finds, then write your report.")
    src = ROOT / "site" / "src"
    newest = max((f.stat().st_mtime for f in src.rglob("*") if f.is_file()), default=0) if src.is_dir() else 0
    if newest > checked_at + 1:
        block("You changed the code after your last self-test. Run `npm run site:check` again so QA gets tested work.")
    if not result.get("ok"):
        left = report.get("check_problems_left")
        if not isinstance(left, list) or not left:
            found = [f"- {p.get('page') or 'site'}: {p.get('problem', '')}" for p in result.get("problems", [])
                     if isinstance(p, dict)][:20]
            block("The self-test still reports problems. Fix them and run `npm run site:check` again, or, for one you "
                  "truly cannot fix in this task, list it in your report's check_problems_left with why:\n"
                  + "\n".join(found))


def service_layout_problems() -> list[str]:
    """The layered layout of service/README.md: one module per resource, routers HTTP only, services
    without HTTP, no loose files. Only for services started from the layered starter (it has the README)."""
    service = ROOT / "service"
    if not (service / "README.md").exists():
        return []
    def rel(path: Path) -> str:
        return str(path.relative_to(ROOT)).replace("\\", "/")
    def text(path: Path) -> str:
        return path.read_text(encoding="utf-8", errors="replace")
    problems: list[str] = []
    if (service / "app").is_dir():  # Python
        app = service / "app"
        loose = [rel(f) for f in app.glob("*.py") if f.name not in ("__init__.py", "main.py", "models.py")]
        loose += [rel(d) for d in app.iterdir() if d.is_dir() and d.name not in ("core", "api", "modules", "__pycache__")]
        if loose:
            problems.append("Move these into a module (app/modules/<resource>/) or app/core/: " + ", ".join(loose))
        for router in app.glob("modules/*/router.py"):
            code = text(router)
            if re.search(r"\b(select|insert|update|delete)\(|\.query\(|\.execute\(|\.scalars?\(|\.add\(|\.commit\(", code):
                problems.append(f"{rel(router)} queries the database: move the queries to its repository.py and the rules to its service.py")
            if "APIRouter(" in code and not re.search(r"APIRouter\([^)]*tags\s*=", code):
                problems.append(f"{rel(router)}: give the router its resource's tag, e.g. APIRouter(prefix='/rooms', tags=['Rooms'])")
        for service_file in list(app.glob("modules/*/service.py")) + list(app.glob("modules/*/repository.py")):
            if re.search(r"^\s*(from|import)\s+(fastapi|starlette)", text(service_file), re.MULTILINE):
                problems.append(f"{rel(service_file)} imports FastAPI: services and repositories don't know HTTP "
                                "(raise core.errors instead)")
    if (service / "src").is_dir():  # TypeScript
        src = service / "src"
        loose = [rel(f) for f in src.glob("*.ts") if f.name not in ("app.ts", "server.ts")]
        loose += [rel(d) for d in src.iterdir() if d.is_dir() and d.name not in ("config", "db", "lib", "middlewares", "modules")]
        if loose:
            problems.append("Move these into a module (src/modules/<resource>/) or src/lib/: " + ", ".join(loose))
        for routes in src.glob("modules/*/*.routes.ts"):
            code = text(routes)
            if re.search(r"db/prisma|@prisma/client|\bdb\.", code):
                problems.append(f"{rel(routes)} queries the database: move the queries to its repository and the rules to its service")
            if "createRoute(" in code and code.count("createRoute(") > code.count("tags:"):
                problems.append(f"{rel(routes)}: give every createRoute its resource's tag (tags: [\"Rooms\"])")
        for layer in list(src.glob("modules/*/*.service.ts")) + list(src.glob("modules/*/*.repository.ts")):
            if re.search(r"from ['\"]hono", text(layer)):
                problems.append(f"{rel(layer)} imports Hono: services and repositories don't know HTTP (throw lib/errors instead)")
    return problems


def check_api_developer() -> None:
    """UI + dedicated API, API lane: the service type-checks, follows the layered layout, and a report
    answers the task and its bugs."""
    task = os.environ.get("GAGESITE_TASK", "")
    check_service()
    layout = service_layout_problems()
    if layout:
        block("The API must follow the layout in service/README.md (router -> service -> repository):\n- "
              + "\n- ".join(layout[:10]))
    report_path = ROOT / "docs" / "04-runs" / f"{task}.json"
    if not report_path.exists():
        block(f"Write your report docs/04-runs/{task}.json before finishing (see your role instructions).")
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        block(f"docs/04-runs/{task}.json is not valid JSON ({exc}).")
    if report.get("task") != task or not str(report.get("summary", "")).strip():
        block(f'docs/04-runs/{task}.json needs "task": "{task}" and a "summary".')
    expected = [b for b in os.environ.get("GAGESITE_BUGS", "").split(",") if b]
    answered = {str(b.get("id")) for b in report.get("bugs", []) if isinstance(b, dict)
                and b.get("result") in ("fixed", "cannot_reproduce")}
    unanswered = [b for b in expected if b not in answered]
    if unanswered:
        block("Your report must answer every bug from QA with fixed or cannot_reproduce. Missing: " + ", ".join(unanswered))


SEVERITIES = ("blocker", "major", "minor")


def check_qa() -> None:
    """QA finishes with a verdict on its one task, after running the self-test in this turn."""
    task = os.environ.get("GAGESITE_TASK", "")
    started = float(os.environ.get("GAGESITE_RUN_STARTED") or 0)
    check = ROOT / "docs" / "04-check.json"
    if not check.exists() or check.stat().st_mtime < started:
        block("Run `npm run site:check` first: your verdict must rest on this turn's self-test.")
    verdict_path = ROOT / "docs" / "04-qa" / f"{task}.json"
    if not verdict_path.exists():
        block(f"Write your verdict docs/04-qa/{task}.json before finishing (see your role instructions).")
    try:
        verdict = json.loads(verdict_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        block(f"docs/04-qa/{task}.json is not valid JSON ({exc}).")
    if verdict_path.stat().st_mtime < started:
        block(f"docs/04-qa/{task}.json is from an earlier test. Test again and write a new verdict.")
    kind = verdict.get("verdict")
    bugs = verdict.get("bugs", [])
    if kind not in ("passed", "bug_found") or not isinstance(bugs, list):
        block(f'docs/04-qa/{task}.json: "verdict" must be "passed" or "bug_found", and "bugs" a list.')
    if kind == "passed" and bugs:
        block('The verdict is "passed" but bugs are listed. Use "bug_found", or remove them.')
    if kind == "bug_found":
        if not bugs:
            block('The verdict is "bug_found" but no bugs are listed.')
        for bug in bugs:
            if not (isinstance(bug, dict) and str(bug.get("title", "")).strip() and isinstance(bug.get("steps"), list)
                    and bug["steps"] and bug.get("expected") and bug.get("actual") and bug.get("severity") in SEVERITIES):
                block("Every bug needs a title, steps (a list), expected, actual and severity (blocker, major or minor).")


NODE_TYPES = ("start", "step", "decision", "end")
NODE_ID = re.compile(r"^[A-Za-z0-9_]{1,40}$")


def check_flowchart() -> None:
    """Stage 1's flowchart: a well-formed, connected graph the app can draw."""
    path = ROOT / "docs" / "01-flowchart.json"
    started = float(os.environ.get("GAGESITE_RUN_STARTED") or 0)
    if not path.exists() or path.stat().st_mtime < started:
        block("Write docs/01-flowchart.json (see your instructions) before finishing.")
    try:
        chart = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        block(f"docs/01-flowchart.json is not valid JSON ({exc}).")
    nodes, edges = chart.get("nodes"), chart.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list) or not nodes:
        block('docs/01-flowchart.json needs "nodes" and "edges" lists.')
    problems: list[str] = []
    ids: dict[str, str] = {}
    for node in nodes:
        nid = str(node.get("id", "")) if isinstance(node, dict) else ""
        if not NODE_ID.match(nid):
            problems.append(f"Node id {nid or '(none)'}: use letters, digits and _ only")
            continue
        if nid in ids:
            problems.append(f"Node id {nid} is used twice")
        if node.get("type") not in NODE_TYPES:
            problems.append(f"{nid}: type must be one of {', '.join(NODE_TYPES)}")
        if not str(node.get("label", "")).strip():
            problems.append(f"{nid} has no label")
        if node.get("type") == "step" and not str(node.get("actor", "")).strip():
            problems.append(f"{nid}: a step needs an actor (a role, or 'The site')")
        ids[nid] = node.get("type", "")
    if len(nodes) > 26:
        problems.append(f"{len(nodes)} nodes: keep it to 24 or fewer (merge routine steps; move details to gaps)")
    decisions = sum(1 for n in nodes if isinstance(n, dict) and n.get("type") == "decision")
    if decisions > 9:
        problems.append(f"{decisions} decisions: keep it to 8 or fewer (draw only the ones that change the path)")
    starts = [n for n, t in ids.items() if t == "start"]
    if len(starts) != 1:
        problems.append(f"There must be exactly one start node (found {len(starts)})")
    if not any(t == "end" for t in ids.values()):
        problems.append("Add at least one end node")
    outgoing: dict[str, list[dict]] = {}
    for edge in edges:
        if not isinstance(edge, dict) or edge.get("from") not in ids or edge.get("to") not in ids:
            problems.append(f"Edge {edge} must join two existing node ids")
            continue
        outgoing.setdefault(edge["from"], []).append(edge)
    for nid, kind in ids.items():
        exits = outgoing.get(nid, [])
        if kind == "decision":
            if len(exits) < 2:
                problems.append(f"Decision {nid} needs at least 2 exits")
            elif any(not str(e.get("label", "")).strip() for e in exits):
                problems.append(f"Every exit of decision {nid} needs a label (Yes / No...)")
        if kind in ("start", "step") and not exits:
            problems.append(f"{nid} leads nowhere: connect it to the next step or an end")
    if len(starts) == 1:
        seen, todo = {starts[0]}, [starts[0]]
        while todo:
            for edge in outgoing.get(todo.pop(), []):
                if edge["to"] not in seen:
                    seen.add(edge["to"])
                    todo.append(edge["to"])
        unreachable = [n for n in ids if n not in seen]
        if unreachable:
            problems.append("These cannot be reached from the start: " + ", ".join(unreachable[:12]))
    gaps = chart.get("gaps", [])
    if not isinstance(gaps, list) or any(not isinstance(g, dict) or not str(g.get("question", "")).strip() for g in gaps):
        problems.append('"gaps" must be a list of { "question": "...", "why": "..." }')
    if problems:
        block("docs/01-flowchart.json needs fixing:\n- " + "\n- ".join(problems[:25]))


def check_blueprint() -> None:
    """The Design Strategist's plan: every page decided, every choice sourced; only the owner approves."""
    path = ROOT / "docs" / "03-design" / "blueprint.json"
    try:
        plan = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        block("docs/03-design/blueprint.json is missing or not valid JSON. Write the design plan there.")
    if not isinstance(plan, dict):
        block("docs/03-design/blueprint.json must be one JSON object.")
    problems = []
    if plan.get("status") == "approved" and not plan.get("approved_at"):
        problems.append('status must stay "draft": only the owner approves the plan')
    elif plan.get("status") not in ("draft", "approved"):
        problems.append('set "status": "draft"')
    for key in ("summary", "candidates", "main_screen", "navigation", "pages", "joins", "decisions"):
        if not plan.get(key):
            problems.append(f'"{key}" is missing or empty')
    candidates = plan.get("candidates") if isinstance(plan.get("candidates"), list) else []
    if any(not isinstance(c, dict) or not c.get("products") for c in candidates):
        problems.append('every entry in "candidates" needs "part" and real "products"')
    try:
        scope = json.loads((ROOT / "docs" / "01-scope.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        scope = {}
    planned = {str(p.get("path") or "").strip() for p in site_pages(scope) if p.get("path")}
    pages = plan.get("pages") if isinstance(plan.get("pages"), list) else []
    decided = {str(p.get("path") or "").strip() for p in pages if isinstance(p, dict)}
    missing = sorted(planned - decided)
    if missing:
        problems.append(f'"pages" has no decision for: {", ".join(missing[:12])}')
    for item in pages + (plan.get("decisions") if isinstance(plan.get("decisions"), list) else []):
        if isinstance(item, dict):
            source = str(item.get("source") or "")
            if source != "guide" and not source.startswith("research:"):
                problems.append(f'"{item.get("path") or item.get("topic")}": "source" must be "guide" or "research: <Product>"')
                break
    if problems:
        block("docs/03-design/blueprint.json: " + "; ".join(problems) + ".")


def check_storyboard() -> None:
    """The Motion Director's storyboard: a concept, a big idea, and sections that cover the scroll."""
    path = ROOT / "docs" / "04-storyboard.json"
    if not path.exists():
        block("docs/04-storyboard.json does not exist yet. Write the storyboard there (see your role instructions).")
    try:
        board = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        block(f"docs/04-storyboard.json is not valid JSON ({exc}).")
    problems = []
    for key in ("concept", "big_idea"):
        if not str(board.get(key, "")).strip():
            problems.append(f"'{key}' is empty")
    sections = board.get("sections")
    if not isinstance(sections, list) or not 6 <= len(sections) <= 12:
        problems.append("give 6 to 12 sections")
        sections = sections if isinstance(sections, list) else []
    last = 0
    for i, s in enumerate(sections):
        name = (s.get("name") or s.get("id") or f"section {i + 1}") if isinstance(s, dict) else f"section {i + 1}"
        if not isinstance(s, dict):
            problems.append(f"{name} must be an object")
            continue
        scroll = s.get("scroll")
        if not (isinstance(scroll, list) and len(scroll) == 2 and all(isinstance(v, (int, float)) for v in scroll)
                and 0 <= scroll[0] < scroll[1] <= 100):
            problems.append(f"{name}: 'scroll' must be [start, end] between 0 and 100")
        elif scroll[0] < last:
            problems.append(f"{name}: its scroll range overlaps the section before it")
        else:
            last = scroll[1]
        for key in ("visual", "motion", "phone"):
            if not str(s.get(key, "")).strip():
                problems.append(f"{name}: '{key}' is empty")
    if sections and last < 100:
        problems.append("the last section must end at 100 (the bottom of the page)")
    system = board.get("system")
    if not isinstance(system, dict):
        problems.append("'system' (the page's decisions: motion, layout, components, interaction, responsive) is missing")
    else:
        for key in ("motion", "layout", "components", "interaction", "responsive"):
            if not system.get(key):
                problems.append(f"system.{key} is empty")
    if board.get("status") not in ("draft", "approved"):
        problems.append("status must be 'draft'")
    if not (ROOT / "docs" / "04-storyboard.md").exists():
        problems.append("docs/04-storyboard.md (the owner's version) is missing")
    if problems:
        block("docs/04-storyboard.json: " + "; ".join(problems[:12]) + ".")


ROLE_CHECKS = {"advisor": check_advisor, "dev": check_developer, "api_dev": check_api_developer, "qa": check_qa,
               "flowchart": check_flowchart, "strategist": check_blueprint, "director": check_storyboard}


# Settings the platform gives the live website itself (Stage 5).
PLATFORM_ENV = {"DATABASE_URL", "AUTH_SECRET", "NEXTAUTH_SECRET", "AUTH_TRUST_HOST", "AUTH_URL", "NEXTAUTH_URL",
                "NODE_ENV", "VERCEL", "VERCEL_URL", "VERCEL_ENV", "NEXT_RUNTIME", "NEXT_DIST_DIR", "PORT",
                # "UI + dedicated API": set by the platform on the service and the website.
                "API_URL", "NEXT_PUBLIC_API_URL", "SERVICE_JWT_SECRET", "ALLOWED_ORIGINS"}


def check_deploy() -> None:
    plan_path = ROOT / "docs" / "05-deploy.json"
    if not plan_path.exists():
        block("docs/05-deploy.json does not exist yet. Write it (see 'docs/05-deploy.json' in your instructions).")
    try:
        plan = json.loads(plan_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        block(f"docs/05-deploy.json is not valid JSON ({exc}).")
    status = plan.get("status")
    if status not in ("preparing", "ready"):
        block("docs/05-deploy.json: status must be 'preparing' or 'ready'.")
    env = plan.get("env", [])
    if not isinstance(env, list) or any(not isinstance(e, dict) or not re.fullmatch(r"[A-Z][A-Z0-9_]*", str(e.get("name", "")))
                                        or e.get("source") not in ("owner", "generated") for e in env):
        block('docs/05-deploy.json "env" must look like [{ "name": "RESEND_API_KEY", "label": "...", "purpose": "...", '
              '"help": "...", "source": "owner" | "generated", "required": false }].')
    listed = {e["name"] for e in env}
    platform = sorted(listed & PLATFORM_ENV)
    if platform:
        block("The platform sets these itself; remove them from docs/05-deploy.json env: " + ", ".join(platform))
    unlabelled = [e["name"] for e in env if e["source"] == "owner" and not (e.get("label") and e.get("purpose"))]
    if unlabelled:
        block("Settings the owner fills in need a plain 'label' and 'purpose' (and 'help'): " + ", ".join(unlabelled))

    used: set[str] = set()
    for folder in ("src", "prisma"):
        for path in (ROOT / "site" / folder).rglob("*.ts*") if (ROOT / "site" / folder).is_dir() else []:
            used |= set(re.findall(r"process\.env\.([A-Z][A-Z0-9_]*)", path.read_text(encoding="utf-8", errors="replace")))
    unknown = sorted(name for name in used - listed - PLATFORM_ENV
                     if not name.startswith(("NEXT_PUBLIC_", "OWNER_")))
    if unknown:
        block("The website reads settings that docs/05-deploy.json doesn't list: " + ", ".join(unknown)
              + ". List each one in env (source owner or generated), or give it a safe default in the code.")

    schema = json.loads((ROOT / "docs" / "02-schema.json").read_text(encoding="utf-8")) if (ROOT / "docs" / "02-schema.json").exists() else {}
    script = ROOT / "site" / "prisma" / "production.ts"
    try:
        dedicated = json.loads((ROOT / "docs" / "04-setup.json").read_text(encoding="utf-8")).get("setup") == "api_service"
    except (OSError, json.JSONDecodeError):
        dedicated = False
    if dedicated:  # the service owns the database: its own production script, checked here
        python_service = (ROOT / "service" / "requirements.txt").exists()
        service_script = ROOT / "service" / ("scripts/production.py" if python_service else "prisma/production.ts")
        if status == "ready" and not service_script.exists():
            block(f"{service_script.relative_to(ROOT).as_posix()} is missing: write it (see 'UI + dedicated API').")
        if service_script.exists() and re.search(r"deleteMany|\.delete\(|DELETE FROM|session\.delete", service_script.read_text(encoding="utf-8")):
            block("The service's production script must never delete rows: the live database belongs to the owner.")
        if (ROOT / "service" / "node_modules").is_dir() or (ROOT / "service" / ".venv").is_dir():
            passed, output = npm("service:typecheck", 240)
            if not passed:
                block("The API service has errors. Fix them (`npm run service:typecheck`):\n" + output)
    elif status == "ready" and schema.get("mode") != "none":
        if not script.exists():
            block("site/prisma/production.ts is missing: write it (see 'site/prisma/production.ts' in your instructions).")
        text = script.read_text(encoding="utf-8")
        if (plan.get("first_account") or {}).get("needed") and not ("OWNER_EMAIL" in text and "OWNER_PASSWORD" in text):
            block("site/prisma/production.ts must create the owner's account from OWNER_EMAIL and OWNER_PASSWORD.")
        if re.search(r"""from\s+["']@/""", text):
            block("site/prisma/production.ts must use relative imports only (it runs outside Next.js).")
        if re.search(r"deleteMany|\.delete\(", text):
            block("site/prisma/production.ts must never delete rows: the live database belongs to the owner.")

    config = ROOT / "site" / "next.config.ts"
    if config.exists() and "NEXT_DIST_DIR" not in config.read_text(encoding="utf-8"):
        block('site/next.config.ts must keep `distDir: process.env.NEXT_DIST_DIR || ".next"`. Put it back.')
    if (ROOT / "site" / "node_modules").is_dir():
        passed, output = npm("site:typecheck", 240)
        if not passed:
            block("The website's code has type errors. Fix them, then run `npm run site:typecheck` again:\n" + output)
    if status == "ready":
        if not (ROOT / "docs" / "05-deploy.md").exists():
            block("Status is 'ready' but docs/05-deploy.md (the owner's go-live guide) is missing.")
        passed, output = npm("site:build", 540)
        if not passed:
            block("Status is 'ready' but the production build fails. Fix it (`npm run site:build`):\n" + output)


CHECKS = {
    "01-scope": check_scope,
    "02-database": check_database,
    "03-design": check_design,
    "04-build": check_build,
    "05-deploy": check_deploy,
}


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        payload = {}
    # Claude may be continuing because of this hook already. Give it a few rounds to fix
    # everything (fixing one problem often reveals the next), but never loop forever.
    rounds_file = ROOT / ".claude" / "hooks" / ".stop-rounds"
    # Building fixes type and build errors one batch at a time, so it gets more rounds.
    limit = 6 if os.environ.get("PIPELINE_STAGE") in ("04-build", "05-deploy") else MAX_ROUNDS
    rounds = 0
    if payload.get("stop_hook_active"):
        try:
            rounds = int(rounds_file.read_text())
        except (OSError, ValueError):
            rounds = limit
    if rounds >= limit:
        sys.exit(0)
    rounds_file.write_text(str(rounds + 1))

    role = os.environ.get("GAGESITE_ROLE", "")
    check = ROLE_CHECKS.get(role) if role else CHECKS.get(os.environ.get("PIPELINE_STAGE", ""))
    if check:
        check()
    sys.exit(0)


if __name__ == "__main__":
    main()
