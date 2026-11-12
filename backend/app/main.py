import asyncio
import hashlib
import json
import mimetypes
import re
from dataclasses import asdict
import shutil
import subprocess
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field as PydanticField
from sqlmodel import Session, select
from sse_starlette.sse import EventSourceResponse

from . import api_server, build_team, chat_files, claude_accounts, flow_video, stitch, data_browser, patterns, project_keys, data_import, db_connect, deploy_runner, design_kit, github, link_reader, profiler, samples, schema_sql, secrets_store, simple_site, site_runner, source_db, sources, vercel, workspace
from .config import settings
from .db import ApiServer, ClaudeAccount, DatabaseConnection, Deployment, GitHubConnection, Message, Project, Run, SourceDatabase, StageState, VercelConnection, engine, get_session, init_db, utcnow
from .runner import RunHandle, RunResult, claude_binary, runs, stage_prompt_file
from .schema_model import validate_schema
from .scope import Details, validate_scope
from .stages import (DESIGN_STRATEGIST, MOTION_DIRECTOR, PATTERN_RESEARCH, PROJECT_RESEARCH, STAGES, STAGES_BY_KEY,
                     landing_stage)

SCOPE_JSON = "docs/01-scope.json"
SCOPE_MD = "docs/01-scope.md"
SCHEMA_JSON = "docs/02-schema.json"
SCHEMA_PRISMA = "docs/02-schema.prisma"
DATABASE_MD = "docs/02-database.md"
PROFILE_MD = "docs/02-data-profile.md"
PROFILE_JSON = "docs/02-data-profile.json"
DATA_STAGE = "02-database"
DESIGN_STAGE = "03-design"
BUILD_STAGE = "04-build"
DEPLOY_STAGE = "05-deploy"
DESIGN_JSON = "docs/03-design/design.json"
DIRECTIONS_JSON = "docs/03-design/directions.json"
TOKENS_JSON = "docs/03-design/tokens.json"
COMPONENTS_JSON = "docs/03-design/components.json"
DESIGN_MD = "docs/03-design.md"
# Written when the owner skips UI Design to build a landing page (Stage 4 designs it itself).
DESIGN_SKIP_JSON = "docs/03-design-skipped.json"
# Folders the browser may load through the preview route (mockups and the owner's images).
PREVIEW_ROOTS = ("docs/03-design/", "docs/04-screens/", "brand/", ".design-refs/")
mimetypes.add_type("model/gltf-binary", ".glb")  # the owner's 3D model, loaded by mockups


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    settings.workspaces_dir.mkdir(parents=True, exist_ok=True)
    threading.Thread(target=workspace.purge_removed, daemon=True).start()  # leftovers of removed projects
    # Runs live in memory; anything still "running" was cut off by a restart.
    with Session(engine) as session:
        for run in session.exec(select(Run).where(Run.status == "running")):
            run.status, run.error, run.finished_at = "failed", "Server restarted during the run", utcnow()
            session.add(run)
            if run.stage_key in STAGES_BY_KEY:  # say so in that stage's chat, instead of a silent missing reply
                session.add(Message(project_id=run.project_id, stage_key=run.stage_key, role="error", run_id=run.id,
                                    content="Gagesite restarted before it could answer your last message, so nothing "
                                            "was changed. Please send it again."))
        for row in session.exec(select(Deployment).where(Deployment.status == "running")):
            steps = json.loads(row.steps or "[]")
            for step in steps:
                if step.get("status") == "running":
                    step["status"], step["detail"] = "failed", "Interrupted"
            row.steps = json.dumps(steps)
            row.status, row.finished_at = "failed", utcnow()
            row.error = "Gagesite restarted while your website was going online. Nothing is lost: try again."
            session.add(row)
        session.commit()
    # APIs on owners' servers: follow their tunnel's address when it changes (server restarts).
    api_server.watch_tunnels()
    yield
    site_runner.previews.stop_all()  # no website previews left running after the platform stops


app = FastAPI(title="Gagesite API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- helpers ----------

def get_project(session: Session, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


def get_stage_state(session: Session, project_id: str, stage_key: str) -> StageState:
    state = session.exec(
        select(StageState).where(StageState.project_id == project_id, StageState.stage_key == stage_key)
    ).first()
    if not state:
        raise HTTPException(404, "Stage not found")
    return state


def active_run(session: Session, project_id: str) -> Run | None:
    return session.exec(select(Run).where(Run.project_id == project_id, Run.status == "running")).first()


def sync_pipeline_file(session: Session, project_id: str) -> None:
    states = session.exec(select(StageState).where(StageState.project_id == project_id)).all()
    connection = session.get(DatabaseConnection, project_id)
    workspace.write_pipeline_state(
        project_id,
        {
            s.stage_key: {
                "status": s.status,
                "approved_at": s.approved_at.isoformat() if s.approved_at else None,
                "artifact_hash": s.artifact_hash,
            }
            for s in states
        },
        # Later stages learn *that* a database is connected and its kind, never how to reach it.
        {"connected": True, "provider": connection.provider, "engine": "postgresql"} if connection else {"connected": False},
    )


def read_json_artifact(project_id: str, relative: str, validator) -> tuple[str | None, dict | None, list[str]]:
    raw = workspace.read_text(project_id, relative)
    if raw is None:
        return None, None, []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        return raw, None, [f"Not valid JSON: {exc}"]
    _, errors = validator(data)
    return raw, data, errors


def scope_business_name(data: dict) -> str:
    """The business name: from the plan, or what the owner typed in their details."""
    business = data.get("business") if isinstance(data.get("business"), dict) else {}
    details = data.get("details") if isinstance(data.get("details"), dict) else {}
    return (business.get("name") or details.get("legal_name") or "").strip()


def scope_artifact(project_id: str) -> dict:
    raw, data, errors = read_json_artifact(project_id, SCOPE_JSON, validate_scope)
    data = data or {}
    # Nothing the owner has to provide blocks approval: only that Claude has drafted pages and
    # features. Open questions, content to send, details (even the business name) can follow later.
    required = [
        {"key": "pages", "label": "at least one page", "done": bool(data.get("pages"))},
        {"key": "features", "label": "at least one feature", "done": bool(data.get("features"))},
    ]
    return {
        "exists": raw is not None,
        "data": data if raw is not None and data else None,
        "markdown": workspace.read_text(project_id, SCOPE_MD),
        "errors": errors,
        # Claude considers the plan complete.
        "ready": bool(data) and not errors and data.get("status") == "ready",
        "required": required,
        "approvable": bool(data) and not errors and all(r["done"] for r in required),
    }


def database_artifact(project_id: str) -> dict:
    raw, data, errors = read_json_artifact(project_id, SCHEMA_JSON, validate_schema)
    profile_raw = workspace.read_text(project_id, PROFILE_JSON)
    return {
        "exists": raw is not None,
        "data": data,
        "markdown": workspace.read_text(project_id, DATABASE_MD),
        "prisma": workspace.read_text(project_id, SCHEMA_PRISMA),
        "profile": json.loads(profile_raw) if profile_raw else [],
        "errors": errors,
        "ready": data is not None and not errors and data.get("status") == "ready",
        # The owner may approve a complete, valid design without waiting for Gagesite to mark it ready.
        "approvable": data is not None and not errors and (
            data.get("mode") == "none"
            or (bool(data.get("tables")) and workspace.read_text(project_id, SCHEMA_PRISMA) is not None)),
    }


def read_json(project_id: str, relative: str):
    raw = workspace.read_text(project_id, relative)
    if raw is None:
        return None, None
    try:
        return json.loads(raw), None
    except json.JSONDecodeError as exc:
        return None, f"{relative} is not valid JSON: {exc}"


def page_slug(path: str) -> str:
    return path.strip("/").replace("/", "-") or "home"


def bare_slug(slug: str) -> str:
    """'papers-[id]' and 'papers-id' name the same page: designs have used both."""
    return slug.replace("[", "").replace("]", "")


# For library entries without a group: (words in the id, group), first match wins.
GROUP_HINTS = [
    (("color", "colour", "typography", "font", "spacing", "radius", "token"), "Foundations"),
    (("header", "footer", "nav", "menu-bar", "tab", "breadcrumb", "lang"), "Navigation"),
    (("button", "btn", "link", "cta"), "Buttons"),
    (("form", "input", "field", "select", "date", "time", "checkbox", "radio", "toggle", "switch", "stepper", "editor", "login"), "Forms"),
    (("badge", "toast", "alert", "empty", "success", "error", "status", "notice"), "Feedback"),
    (("card", "photo", "image", "tile", "item"), "Cards"),
]


def guess_group(component_id: str) -> str:
    text = component_id.lower()
    for words, group in GROUP_HINTS:
        if any(word in text for word in words):
            return group
    return "Sections"


ADMIN_PAGE = re.compile(r"admin|login|log-in|sign-in|dashboard|account|관리|로그인", re.IGNORECASE)


def design_version(root: Path) -> int:
    """Newest change to any preview the app shows (styles, key pages, library, photos)."""
    newest = 0.0
    for pattern in ("directions/*.html", "pages/*.html", "components.html", "imagery/*"):
        for file in root.glob(pattern):
            newest = max(newest, file.stat().st_mtime)
    return int(newest * 1000)


def design_artifact(project_id: str) -> dict:
    design, design_error = read_json(project_id, DESIGN_JSON)
    directions, directions_error = read_json(project_id, DIRECTIONS_JSON)
    tokens, tokens_error = read_json(project_id, TOKENS_JSON)
    errors = [e for e in (design_error, directions_error, tokens_error) if e]
    root = workspace.workspace_path(project_id) / "docs" / "03-design"
    scope, _ = read_json(project_id, SCOPE_JSON)
    schema, _ = read_json(project_id, SCHEMA_JSON)
    no_database = isinstance(schema, dict) and schema.get("mode") == "none"
    # The page list comes from the scope, so missing mockups are visible even before Claude lists them.
    # Without a database there are no admin or login pages to design.
    pages = []
    for page in (scope or {}).get("pages", []):
        if no_database and ADMIN_PAGE.search(f"{page.get('path', '')} {page.get('name', '')}"):
            continue
        slug = page_slug(page.get("path", ""))
        # Use whichever spelling the design actually saved ("papers-[id]" or "papers-id").
        if not (root / "pages" / f"{slug}.html").exists() and (root / "pages" / f"{bare_slug(slug)}.html").exists():
            slug = bare_slug(slug)
        pages.append({
            "slug": slug,
            "name": page.get("name", slug),
            "path": page.get("path", ""),
            "file": f"pages/{slug}.html",
            "exists": (root / "pages" / f"{slug}.html").exists(),
        })
    # Only the key pages are drawn here; Stage 4 builds the rest from the component library.
    key_pages = (design or {}).get("key_pages")
    all_pages = pages
    if isinstance(key_pages, list) and key_pages:
        wanted = {bare_slug(str(k)) for k in key_pages}
        pages = [p for p in pages if bare_slug(p["slug"]) in wanted]
    components, components_error = read_json(project_id, COMPONENTS_JSON)
    if components_error:
        errors.append(components_error)
    # Tolerate entries Claude left incomplete, so the library always renders.
    components = [
        {"description": "", "used_on": [], **c, "name": c.get("name") or c["id"], "group": c.get("group") or guess_group(c["id"])}
        for c in (components if isinstance(components, list) else [])
        if isinstance(c, dict) and c.get("id")
    ]
    library_ready = bool(components) and (root / "components.html").exists()
    status = (design or {}).get("status")
    ready = status == "ready" and not errors and tokens is not None and library_ready and all(p["exists"] for p in pages)
    return {
        "exists": design is not None,
        "status": status,
        # The design plan (written before any style): once there is one, the design has started.
        "has_plan": (workspace.workspace_path(project_id) / BLUEPRINT_JSON).exists(),
        "chosen_direction": (design or {}).get("chosen_direction"),
        "open_questions": (design or {}).get("open_questions", []),
        "directions": [
            {**d, "file": f"directions/{d.get('id')}.html",
             "exists": (root / "directions" / f"{d.get('id')}.html").exists()}
            for d in (directions or [])
        ],
        "tokens": tokens,
        "components": components,
        "components_file": "components.html" if library_ready else None,
        "pages": pages,
        # Pages built straight in Stage 4 (not drawn here).
        "later_pages": [{"name": p["name"], "path": p["path"]} for p in all_pages if p not in pages],
        "markdown": workspace.read_text(project_id, DESIGN_MD),
        "errors": errors,
        "ready": ready,
        # The owner skipped UI Design to build a landing page; Stage 4 designs it itself.
        "skipped": (workspace.workspace_path(project_id) / DESIGN_SKIP_JSON).exists(),
        # Changes only when a preview file changes, so the app reloads previews only then.
        "version": design_version(root),
    }


def build_artifact(project_id: str) -> dict:
    """Stage 4: the build checklist, the owner's summary, screenshots and the live preview."""
    raw = workspace.read_text(project_id, site_runner.BUILD_JSON)
    build, errors = None, []
    if raw:
        try:
            build = json.loads(raw)
        except json.JSONDecodeError as exc:
            errors.append(f"{site_runner.BUILD_JSON} is not valid JSON: {exc}")
    screens = workspace.workspace_path(project_id) / site_runner.SCREENS_DIR
    pages = []
    for page in (build or {}).get("pages", []):
        if not isinstance(page, dict) or not page.get("path"):
            continue
        shot = screens / f"{site_runner.page_slug(page['path'])}.jpg"
        pages.append({
            "path": page["path"],
            "name": page.get("name") or page["path"],
            "status": page.get("status", "todo"),
            "preview": page.get("preview") or page["path"],
            "screenshot": f"{site_runner.SCREENS_DIR}/{shot.name}" if shot.exists() else None,
            "screenshot_at": int(shot.stat().st_mtime) if shot.exists() else None,
        })
    status = (build or {}).get("status")
    check = site_runner.read_check(project_id)
    return {
        "exists": build is not None,
        "check": {"ok": check.get("ok", False), "checked_at": check.get("checked_at"), "final": bool(check.get("final")),
                  "api": check.get("api", 0), "problems": check.get("problems", [])}
        if check else None,
        "status": status,
        "pages": pages,
        "test_accounts": (build or {}).get("test_accounts", []),
        "open_questions": (build or {}).get("open_questions", []),
        "markdown": workspace.read_text(project_id, site_runner.BUILD_MD),
        "site_exists": (site_runner.site_path(project_id) / "package.json").exists(),
        "installed": (site_runner.site_path(project_id) / "node_modules").is_dir(),
        "preview": site_runner.previews.info(project_id),
        "errors": errors,
        "ready": status == "ready" and not errors and bool(pages) and all(p["status"] == "done" for p in pages),
    }


async def after_build(project_id: str, message: str) -> None:
    """After each successful build turn: start the preview for the owner, run the self-test
    unless the end-of-turn check just did (it also refreshes the page screenshots), then save
    the code to GitHub if connected."""
    try:
        if (site_runner.site_path(project_id) / "node_modules").is_dir():
            site_runner.previews.start(project_id)
            for _ in range(80):
                if site_runner.previews.info(project_id)["status"] in ("running", "failed", "stopped"):
                    break
                await asyncio.sleep(1.5)
            check = site_runner.read_check(project_id)
            if not check or time.time() - float(check.get("checked_at") or 0) > 300:
                await asyncio.to_thread(site_runner.run_check, project_id)
    except Exception:  # the self-test is a help here, never a reason to fail the turn
        pass
    try:
        await save_to_github(project_id, message)
    except github.GitHubError:
        pass  # recorded on the connection; the owner sees it in the panel


async def save_to_github(project_id: str, message: str) -> dict | None:
    with Session(engine) as session:
        connection = session.get(GitHubConnection, project_id)
        if not connection:
            return None
        repo, token = connection.repo, secrets_store.decrypt(connection.encrypted_token)
    try:
        pushed = await asyncio.to_thread(github.push, site_runner.site_path(project_id), repo, token, message)
        error = None
    except github.GitHubError as exc:
        pushed, error = None, str(exc)
    with Session(engine) as session:
        connection = session.get(GitHubConnection, project_id)
        if connection:
            if pushed:
                connection.last_push_at, connection.last_commit = utcnow(), pushed["commit"]
            connection.last_error = error
            session.add(connection)
            session.commit()
    if error:
        raise github.GitHubError(error)
    return pushed


def deploy_artifact(project_id: str) -> dict:
    """Stage 5: what going online needs (from docs/05-deploy.json), the connections, and the last attempt."""
    raw = workspace.read_text(project_id, deploy_runner.DEPLOY_JSON)
    plan, errors = None, []
    if raw:
        try:
            plan = json.loads(raw)
        except json.JSONDecodeError as exc:
            errors.append(f"{deploy_runner.DEPLOY_JSON} is not valid JSON: {exc}")
    project_keys.fill_from_connections(project_id)  # e.g. SUPABASE_URL from the connected database
    with Session(engine) as session:
        row = session.get(Deployment, project_id)
        saved = json.loads(secrets_store.decrypt(row.encrypted_settings)) if row and row.encrypted_settings else {}
        deployment = {
            "status": row.status if row else "idle",
            "steps": json.loads(row.steps) if row else [],
            "url": row.url if row else None,
            "error": row.error if row else None,
            "has_log": bool(row and row.build_log),
            "started_at": row.started_at if row else None,
            "live_at": row.live_at if row else None,
            "first_account_email": row.first_account_email if row else None,
            "vercel_project": row.vercel_project_name if row else None,
            "offline_at": row.offline_at if row else None,
            # Live, and nothing new since: "Put my changes online" has nothing to do.
            "changes_waiting": deploy_runner.changes_waiting(project_id) if row and row.status == "live" else True,
        }
    settings_list = []
    for item in (plan or {}).get("env", []):
        if isinstance(item, dict) and item.get("name") and item.get("source") == "owner":
            # Settings are saved by name, so one the API and the website both read (listed once per
            # part) is one value: show it once, required if either part needs it.
            same = next((s for s in settings_list if s["name"] == item["name"]), None)
            if same:
                same["required"] = same["required"] or bool(item.get("required"))
                continue
            settings_list.append({
                "name": item["name"],
                "label": item.get("label") or item["name"],
                "purpose": item.get("purpose", ""),
                "help": item.get("help", ""),
                "required": bool(item.get("required")),
                "filled": bool(saved.get(item["name"])),
                "problem": None,
            })
    if any(s["filled"] for s in settings_list):
        # A saved value is tested against its service: "saved" should mean "works".
        problems = project_keys.service_problems(project_id)
        for s in settings_list:
            if s["filled"]:
                s["problem"] = problems.get(s["name"])
    status = (plan or {}).get("status")
    first_plan = (plan or {}).get("first_account") or {}
    made = project_keys.first_login(project_id)
    return {
        "exists": plan is not None,
        "status": status,
        "settings": settings_list,
        "first_account": bool(((plan or {}).get("first_account") or {}).get("needed")) and deploy_runner.uses_logins(project_id),
        # Gagesite makes the live site's first login itself and keeps it (encrypted) to show the owner.
        "first_login": {
            "email": made["email"] if made else project_keys.planned_login_email(project_id, first_plan.get("role")),
            "created": bool(made and deployment["first_account_email"]),
            "kept": bool(made),
        },
        "has_database": deploy_runner.has_database(project_id),
        "markdown": workspace.read_text(project_id, deploy_runner.DEPLOY_MD),
        "deployment": deployment,
        "errors": errors,
        "ready": deployment["status"] == "live" and not errors,
    }


# Per implemented stage: how to read its output, and which file's hash approval records.
ARTIFACTS = {
    "01-scope": (scope_artifact, SCOPE_JSON),
    DATA_STAGE: (database_artifact, SCHEMA_JSON),
    DESIGN_STAGE: (design_artifact, TOKENS_JSON),
    BUILD_STAGE: (build_artifact, site_runner.BUILD_JSON),
    DEPLOY_STAGE: (deploy_artifact, deploy_runner.DEPLOY_JSON),
}


def require_earlier_approved(session: Session, project_id: str, stage_key: str) -> None:
    """A later stage waits while an earlier one is reopened: it builds on that stage's outputs."""
    order = STAGES_BY_KEY[stage_key].order
    # A static UI has no database of its own: Database Design can stay open while it is built.
    # A landing page needs no database either.
    skip = ({"02-database"} if order >= STAGES_BY_KEY[BUILD_STAGE].order
            and read_setup(project_id)["setup"] in ("static_external", "landing") else set())
    for earlier in STAGES:
        if earlier.key in skip:
            continue
        if earlier.order < order and get_stage_state(session, project_id, earlier.key).status != "approved":
            raise HTTPException(409, f"{earlier.title} was reopened. Finish and approve it first: this step builds on it.")


def require_setup_database(session: Session, project_id: str) -> None:
    info = setup_info(session, project_id)
    if info["needs_database"] and not info["database_ready"]:
        raise HTTPException(409, "This setup needs a database. Finish Database Design with a database first.")
    if info["needs_service"]:
        raise HTTPException(409, "Add the address of the API your pages should call first.")


def implemented_stage(stage_key: str):
    stage = STAGES_BY_KEY.get(stage_key)
    if not stage or not stage.implemented or stage_key not in ARTIFACTS:
        raise HTTPException(400, "This stage is not available yet")
    return stage


# ---------- routes ----------

@app.get("/api/health")
def health():
    try:
        binary = claude_binary()
        version = subprocess.run([binary, "--version"], capture_output=True, text=True, timeout=20).stdout.strip()
        return {"ok": True, "claude": binary, "version": version}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ---------- Google Stitch: an optional second designer for UI Design ----------

class StitchKey(BaseModel):
    key: str = PydanticField(min_length=1, max_length=500)


@app.get("/api/stitch")
def get_stitch():
    return stitch.status()


@app.put("/api/stitch")
async def connect_stitch(body: StitchKey):
    """Checks the key with Stitch itself before keeping it (encrypted, never shown again)."""
    try:
        return await asyncio.to_thread(stitch.connect, body.key)
    except stitch.StitchError as exc:
        raise HTTPException(400, str(exc)) from None


@app.delete("/api/stitch")
def disconnect_stitch():
    return stitch.disconnect()


# ---------- which Claude account the AI runs use ----------

def pasted_token(text: str) -> str:
    """The token from what was pasted: from "sk-ant-" on, joined with the following lines while they
    only continue it (the terminal wraps it); a blank line or ordinary words end it."""
    start = text.find("sk-ant-")
    if start < 0:
        return ""
    lines = text[start:].splitlines()
    token = lines[0].strip().split()[0] if lines[0].strip() else ""
    for line in lines[1:]:
        piece = line.strip()
        if not piece or not re.fullmatch(r"[A-Za-z0-9_\-]+", piece):
            break
        token += piece
    return token


class AddClaudeAccount(BaseModel):
    name: str = PydanticField(min_length=1, max_length=120)
    # Generous: a paste from the terminal can carry line breaks or the text around the token.
    token: str = PydanticField(min_length=1, max_length=5000)


class ChooseClaudeAccount(BaseModel):
    id: str | None = None  # None: this computer's own Claude Code login


@app.get("/api/claude/accounts")
def get_claude_accounts(session: Session = Depends(get_session)):
    return claude_accounts.overview(session)


@app.post("/api/claude/accounts")
async def add_claude_account(body: AddClaudeAccount, session: Session = Depends(get_session)):
    name = body.name.strip()
    # The terminal wraps the long token over several lines: join them, then take the token itself
    # (whatever else was copied with it).
    found = re.search(r"sk-ant-[A-Za-z0-9_\-]{20,}", pasted_token(body.token))
    if not name:
        raise HTTPException(400, "Give the account a name, e.g. your email.")
    if not found:
        raise HTTPException(400, "That doesn't look like a Claude token. Run `claude setup-token` and paste the token it prints (it starts with sk-ant-).")
    token = found.group(0)
    if any(a.name.lower() == name.lower() for a in session.exec(select(ClaudeAccount)).all()):
        raise HTTPException(409, f"There is already an account called {name}.")
    problem = await asyncio.to_thread(claude_accounts.check_token, token)
    if problem:
        raise HTTPException(400, problem)
    session.add(ClaudeAccount(name=name, encrypted_token=secrets_store.encrypt(token), hint=token[-4:]))
    session.commit()
    return claude_accounts.overview(session)


@app.put("/api/claude/accounts/active")
def choose_claude_account(body: ChooseClaudeAccount, session: Session = Depends(get_session)):
    accounts = session.exec(select(ClaudeAccount)).all()
    if body.id and not any(a.id == body.id for a in accounts):
        raise HTTPException(404, "That account no longer exists")
    for account in accounts:
        account.active = account.id == body.id
        session.add(account)
    session.commit()
    return claude_accounts.overview(session)


@app.delete("/api/claude/accounts/{account_id}")
def remove_claude_account(account_id: str, session: Session = Depends(get_session)):
    account = session.get(ClaudeAccount, account_id)
    if not account:
        raise HTTPException(404, "That account no longer exists")
    session.delete(account)  # if it was the active one, runs go back to this computer's login
    session.commit()
    return claude_accounts.overview(session)


@app.get("/api/stages")
def list_stages():
    return [
        {"key": s.key, "order": s.order, "title": s.title, "description": s.description, "implemented": s.implemented}
        for s in STAGES
    ]


class CreateProject(BaseModel):
    name: str


@app.get("/api/projects")
def list_projects(session: Session = Depends(get_session)):
    projects = session.exec(select(Project).order_by(Project.created_at.desc())).all()
    live = {
        d.project_id: d.url
        for d in session.exec(select(Deployment).where(Deployment.url != None)).all()  # noqa: E711
        if d.status == "live" and not d.offline_at
    }
    return [{**p.model_dump(), "live_url": live.get(p.id)} for p in projects]


# Rows that belong to a project, removed with it (children before the project itself).
PROJECT_TABLES = (Message, Run, StageState, SourceDatabase, GitHubConnection, VercelConnection, Deployment, DatabaseConnection)


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str, session: Session = Depends(get_session)):
    """Remove a project from Gagesite: its chats, files and saved connections.

    Nothing outside Gagesite is touched: a live website, its database and a GitHub copy stay as they are.
    """
    get_project(session, project_id)
    if active_run(session, project_id):
        raise HTTPException(409, "Gagesite is still working on this project. Stop it first, then remove the project.")
    require_not_deploying(session, project_id)
    job = data_import.jobs.get(project_id)
    if job and job.status == "running":
        raise HTTPException(409, "Rows are still being added to the database. Wait until that finishes.")

    site_runner.previews.stop(project_id)
    # Move the folder aside first: if Windows still has a file open, nothing has changed yet.
    folder = workspace.workspace_path(project_id)
    trash = workspace.removed_path(project_id)
    if folder.exists():
        for attempt in range(5):
            try:
                folder.rename(trash)
                break
            except OSError:
                if attempt == 4:
                    raise HTTPException(409, "A file of this project is still open. Close the website preview and try again.")
                time.sleep(0.5)

    for table in PROJECT_TABLES:
        for row in session.exec(select(table).where(table.project_id == project_id)).all():
            session.delete(row)
    session.delete(session.get(Project, project_id))
    session.commit()
    # node_modules can hold tens of thousands of files: delete in the background.
    threading.Thread(target=workspace.purge_removed, daemon=True).start()
    return {"ok": True}


@app.post("/api/projects")
def create_project(body: CreateProject, session: Session = Depends(get_session)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Project name is required")
    project = Project(name=name)
    session.add(project)
    for stage in STAGES:
        session.add(StageState(
            project_id=project.id,
            stage_key=stage.key,
            status="active" if stage.order == 1 else "locked",
        ))
    session.commit()
    workspace.create_workspace(project.id)
    sync_pipeline_file(session, project.id)
    return project


@app.get("/api/projects/{project_id}")
def project_detail(project_id: str, session: Session = Depends(get_session)):
    project = get_project(session, project_id)
    states = {
        s.stage_key: s
        for s in session.exec(select(StageState).where(StageState.project_id == project_id)).all()
    }
    run = active_run(session, project_id)
    return {
        "project": project,
        "stages": [
            {
                "key": s.key,
                "order": s.order,
                "title": s.title,
                "description": s.description,
                "implemented": s.implemented,
                "status": states[s.key].status,
                "approved_at": states[s.key].approved_at,
            }
            for s in STAGES
        ],
        "active_run": {"id": run.id, "stage_key": run.stage_key} if run else None,
    }


@app.get("/api/projects/{project_id}/stages/{stage_key}/messages")
def stage_messages(project_id: str, stage_key: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    return session.exec(
        select(Message)
        .where(Message.project_id == project_id, Message.stage_key == stage_key)
        .order_by(Message.id)
    ).all()


class SendMessage(BaseModel):
    content: str = ""
    # Stored names of files uploaded first with POST /chat-files (screenshots, PDFs, text...).
    attachments: list[str] = []


def friendly_run_error(error: str | None, stage_key: str) -> str:
    """What the owner reads when a turn ends badly: plain words, never the tool's own name or output."""
    text = (error or "").lower()
    if "stopped by the owner" in text:
        return "Stopped. Send a message when you want Gagesite to carry on."
    if "max_turns" in text or "maximum number of turns" in text:
        return (
            "Gagesite paused after a long round of work. Say \"Keep building\" to continue where it stopped."
            if stage_key == BUILD_STAGE
            else "Gagesite paused after a long round of work. Send a message to continue."
        )
    if "usage limit" in text or "rate limit" in text or "overloaded" in text:
        return "Gagesite is busy right now. Please try again in a few minutes."
    if "server restarted" in text:
        return "Gagesite was interrupted by a restart. Send a message to continue."
    return (
        "Gagesite stopped before finishing this reply. Send a message to continue"
        + (", or use Start over to build again from the beginning." if stage_key == BUILD_STAGE else ".")
    )


@app.post("/api/projects/{project_id}/stages/{stage_key}/messages")
async def send_message(project_id: str, stage_key: str, body: SendMessage, session: Session = Depends(get_session)):
    get_project(session, project_id)
    # Before anything else: a message that looks like it holds a secret never reaches the AI or the history.
    if project_keys.looks_secret(body.content):
        raise HTTPException(
            400,
            "This message looks like it contains a secret key, so it wasn't sent or saved. Add keys under "
            "Keys & settings instead: Gagesite keeps them encrypted and the AI never sees them.",
        )
    stage = implemented_stage(stage_key)
    state = get_stage_state(session, project_id, stage_key)
    if state.status == "locked":
        raise HTTPException(409, "Approve the previous stage first")
    if state.status == "approved":
        raise HTTPException(409, "This stage is approved. Reopen it to make changes.")
    require_earlier_approved(session, project_id, stage_key)
    if stage_key == BUILD_STAGE:
        require_setup_database(session, project_id)
    team_build = stage_key == BUILD_STAGE and build_team.load_board(project_id) is not None
    # During a team build a message is queued for the Advisor even while an agent is mid-task;
    # anything else waits for the run in progress.
    if active_run(session, project_id) and not (team_build and build_team.is_running(project_id)):
        raise HTTPException(409, "Gagesite is still working on this project")
    require_not_deploying(session, project_id)  # the code mustn't change while it's being uploaded
    extra_env: dict[str, str] = {}
    if stage_key == DESIGN_STAGE and design_kit.load(project_id).design_engine == "stitch":
        # Google Stitch draws the style options too: its tools, and its key from Gagesite's settings.
        stitch_key = stitch.key()
        if not stitch_key:
            raise HTTPException(409, "This project uses Google Stitch, but Stitch isn't connected. Connect it under "
                                     "'Who designs' in the design kit, or switch back to Gagesite's designer.")
        stage, extra_env = stitch.design_stage(stage), {stitch.ENV: stitch_key}
    # A landing page is storyboarded first: until the owner approves the storyboard, messages go to
    # the Motion Director (its own conversation each time, carried by the recap), not the builder.
    director_phase = stage_key == BUILD_STAGE and read_setup(project_id)["setup"] == "landing" \
        and storyboard_status(project_id) != "approved" \
        and not (workspace.workspace_path(project_id) / site_runner.BUILD_JSON).exists()
    if director_phase:
        stage = MOTION_DIRECTOR
    elif stage_key == BUILD_STAGE and read_setup(project_id)["setup"] == "landing":
        stage = landing_stage(stage)
    attached =chat_files.describe(project_id, body.attachments)
    if len(attached) != len(body.attachments[:chat_files.MAX_PER_MESSAGE]):
        raise HTTPException(400, "An attached file is missing. Attach it again.")
    content = body.content.strip()
    if not content and not attached:
        raise HTTPException(400, "Message is empty")
    if not content:
        content = "Please look at the attached " + ("file." if len(attached) == 1 else "files.")
    files_note = chat_files.prompt_block(project_id, attached)  # where the files are, for the AI
    files_json = chat_files.dumps(attached)
    if team_build:
        # A team build: the Advisor turns the message into tasks before the next task starts.
        session.add(Message(project_id=project_id, stage_key=stage_key, role="user", content=content,
                            attachments=files_json))
        session.commit()
        build_team.tell_owner_message(project_id, content + files_note)
        if not build_team.is_running(project_id):
            info = build_team.info(project_id) or {}
            patterns.sync(project_id)
            project_keys.write_manifest(project_id)
            build_team.start(project_id, team_after_dev, retry_blocked=info.get("state") == "blocked")
        return {"run_id": None, "queued": True}
    # The plan's AI can't browse: links the owner pastes are opened here first.
    prompt = content + (await read_links_for(project_id, content) if stage_key == "01-scope" else "") + files_note

    # A new design: research products like this one and write the design plan first, then the
    # designer draws the styles on it, all in this one run (no separate approval of the plan).
    plan_phase = stage_key == DESIGN_STAGE and design_plan_missing(project_id)
    if director_phase:
        # The Director's own short conversation; the builder's conversation starts after approval.
        resume, run_session = False, str(uuid.uuid4())
    else:
        # The first message starts a new Claude session; later ones resume it.
        resume = state.session_id is not None
        if not resume:
            state.session_id = str(uuid.uuid4())
            session.add(state)
        # A resumed session keeps the instructions it started with (--append-system-prompt-file is
        # ignored on resume). When they have changed since, pass the current ones along once.
        instructions = stage_prompt_file(stage).read_text(encoding="utf-8")
        current_hash = hashlib.sha256(instructions.encode("utf-8")).hexdigest()
        if resume and state.prompt_hash != current_hash:
            prompt = (
                "<updated-instructions>\nGagesite's instructions for this step were updated since this conversation "
                "started. These replace your earlier instructions wherever they differ; follow them from now on. "
                "Do not mention this update to the owner.\n\n" + instructions + "\n</updated-instructions>\n\n" + prompt
            )
        state.prompt_hash = current_hash
        session.add(state)
        run_session = state.session_id

    run = Run(project_id=project_id, stage_key=stage_key, session_id=run_session)
    session.add(run)
    session.add(Message(project_id=project_id, stage_key=stage_key, role="user", content=content, run_id=run.id,
                        attachments=files_json))
    session.commit()
    workspace.refresh_platform_files(project_id)
    project_keys.write_manifest(project_id)  # names only: the AI never sees a value
    pre = []
    if stage_key in (DESIGN_STAGE, BUILD_STAGE):
        index = patterns.sync(project_id)  # the page and site guides this plan needs
        research = patterns.to_research(index) if stage_key == DESIGN_STAGE else []
        if research:
            # Guides nobody has written yet: first study the leading real products of that kind
            # (the only run with web access), add the guides to the library, then design with them.
            folder, research_prompt = patterns.prepare_research(project_id, research)

            def after_research(_result, folder=folder, items=research) -> None:
                patterns.adopt_research(folder, items)
                patterns.sync(project_id)

            pre.append((PATTERN_RESEARCH, folder, research_prompt, after_research))
        if plan_phase and patterns.needs_project_research(project_id):
            # Every project: research products like THIS one (other layouts, how parts combine).
            project_folder, project_prompt = patterns.prepare_project_research(project_id)

            def after_project_research(_result, folder=project_folder) -> None:
                patterns.adopt_project_research(folder, project_id)

            pre.append((PROJECT_RESEARCH, project_folder, project_prompt, after_project_research))
        if plan_phase:
            # The Design Strategist writes docs/03-design/blueprint.json; the styles are drawn on it next.
            strategist_prompt = (
                content + files_note + "\n\n<gagesite-note>Write the design plan now. The three styles are drawn "
                "on it right after you, in the same turn, so do not ask the owner to approve it: finish with one "
                "short sentence on what the plan follows.</gagesite-note>"
            )

            def after_plan(_result) -> None:
                if read_blueprint(project_id):
                    _set_plan_status(project_id, "approved")

            pre.append((DESIGN_STRATEGIST, workspace.workspace_path(project_id), strategist_prompt, after_plan))
    if stage_key == BUILD_STAGE and not director_phase:
        site_runner.ensure_site(project_id)  # the starter template, on the first build
        # While Gagesite changes the site, the preview runs in development mode (changes show at once).
        site_runner.previews.set_working(project_id, True)

    read_artifact, _ = ARTIFACTS[stage_key]
    run_id, started_session, state_id = run.id, run_session, state.id

    def recap() -> str:
        """The conversation so far in plain text, for when it has to continue in a fresh Claude
        conversation (e.g. after switching Claude accounts)."""
        with Session(engine) as s:
            rows = s.exec(
                select(Message)
                .where(Message.project_id == project_id, Message.stage_key == stage_key,
                       Message.role.in_(("user", "assistant")), Message.run_id != run_id)
                .order_by(Message.created_at.desc())
                .limit(40)
            ).all()
        lines, size = [], 0
        for m in rows:  # newest first, so the most recent part survives the size limit
            line = f"{'Owner' if m.role == 'user' else 'Gagesite'}: {m.content.strip()}"
            if size + len(line) > 24000:
                break
            lines.append(line)
            size += len(line)
        return "\n\n".join(reversed(lines))

    async def on_finish(handle: RunHandle, result: RunResult) -> None:
        with Session(engine) as s:
            finished = s.get(Run, run_id)
            finished.status = "failed" if result.is_error else "succeeded"
            finished.error, finished.cost_usd, finished.finished_at = result.error, result.cost_usd, utcnow()
            if result.session_id and result.session_id != started_session and not plan_phase and not director_phase:
                # Carried on in a fresh Claude conversation: the next message continues that one.
                finished.session_id = result.session_id
                stage_state = s.get(StageState, state_id)
                if stage_state:
                    stage_state.session_id = result.session_id
                    s.add(stage_state)
            s.add(finished)
            if result.assistant_text:
                s.add(Message(project_id=project_id, stage_key=stage_key, role="assistant",
                              content=result.assistant_text, run_id=run.id,
                              steps=json.dumps(result.steps) if result.steps else None))
            if result.is_error:
                # The run keeps the technical detail; the owner gets plain words.
                s.add(Message(project_id=project_id, stage_key=stage_key, role="error",
                              content=friendly_run_error(result.error, stage_key), run_id=run.id))
            s.commit()
        artifact = read_artifact(project_id)
        handle.publish({"type": "artifact", "ready": artifact["ready"], "errors": artifact["errors"]})
        if director_phase:
            handle.publish({"type": "storyboard"})
            return
        if stage_key == BUILD_STAGE:
            # Done: a finished website is previewed as its production build (what goes online).
            site_runner.previews.set_working(project_id, False)
        if stage_key == BUILD_STAGE and not result.is_error:
            asyncio.create_task(after_build(project_id, f"Gagesite: {content[:60]}"))
            # An API running on the owner's server gets the change (when set to update by itself).
            api_server.after_change(project_id)

    if plan_phase or director_phase:
        earlier = recap()
        prompt = (f"<earlier-conversation>\n{earlier}\n</earlier-conversation>\n\n" if earlier else "") \
            + "The owner's message:\n" + prompt

    runs.start(
        run_id=run.id,
        stage=stage,
        workspace=workspace.workspace_path(project_id),
        prompt=prompt,
        session_id=run_session,
        resume=resume,
        on_finish=on_finish,
        recap_for=recap,
        extra_env=extra_env,
        pre=pre,
    )
    return {"run_id": run.id}


# ---------- Stage 3: the design plan (Design Strategist), approved before styles are drawn ----------

BLUEPRINT_JSON = "docs/03-design/blueprint.json"


def read_blueprint(project_id: str) -> dict | None:
    raw = workspace.read_text(project_id, BLUEPRINT_JSON)
    try:
        data = json.loads(raw) if raw else None
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def design_plan_needed(project_id: str) -> bool:
    """The owner no longer approves the plan on its own: it is written right before the styles are
    drawn, in the same run, and shown beside them. Kept for the API ("needed" is always False)."""
    return False


def design_plan_missing(project_id: str) -> bool:
    """A new design without a plan yet: the Design Strategist writes one before the styles are drawn.
    Designs whose styles were drawn before plans existed carry on as they were."""
    root = workspace.workspace_path(project_id) / "docs" / "03-design"
    return not (root / "directions.json").exists() and read_blueprint(project_id) is None


@app.get("/api/projects/{project_id}/design/plan")
def get_design_plan(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    index_raw = workspace.read_text(project_id, "docs/03-patterns/index.json")
    try:
        index = json.loads(index_raw) if index_raw else {}
    except json.JSONDecodeError:
        index = {}
    return {
        "plan": read_blueprint(project_id),
        "needed": design_plan_needed(project_id),
        "candidates": patterns.project_candidates(project_id),
        "guides": index.get("studied") or {},
    }


def _set_plan_status(project_id: str, status: str) -> dict:
    plan = read_blueprint(project_id)
    if not plan:
        raise HTTPException(409, "There is no design plan yet")
    plan["status"] = status
    if status == "approved":
        plan["approved_at"] = utcnow().isoformat()
    else:
        plan.pop("approved_at", None)
    path = workspace.workspace_path(project_id) / BLUEPRINT_JSON
    path.write_text(json.dumps(plan, indent=2, ensure_ascii=False), encoding="utf-8")
    return plan


@app.post("/api/projects/{project_id}/design/plan/approve")
def approve_design_plan(project_id: str, session: Session = Depends(get_session)):
    """The owner approves the design plan; the next message draws the three styles on it."""
    get_project(session, project_id)
    if get_stage_state(session, project_id, DESIGN_STAGE).status != "active":
        raise HTTPException(409, "Open UI Design to change its plan")
    if active_run(session, project_id):
        raise HTTPException(409, "Gagesite is still working on this project")
    return {"plan": _set_plan_status(project_id, "approved")}


@app.post("/api/projects/{project_id}/design/plan/reopen")
def reopen_design_plan(project_id: str, session: Session = Depends(get_session)):
    """Back to the plan (only before any style is drawn)."""
    get_project(session, project_id)
    if (workspace.workspace_path(project_id) / "docs" / "03-design" / "directions.json").exists():
        raise HTTPException(409, "The styles are already drawn on this plan. Ask for changes in the chat instead.")
    if active_run(session, project_id):
        raise HTTPException(409, "Gagesite is still working on this project")
    return {"plan": _set_plan_status(project_id, "draft")}


# ---------- Stage 4 as an agent team (docs/plans/stage4-agent-team.md) ----------

async def team_after_dev(project_id: str, message: str) -> None:
    """After each Developer task: show the owner the preview and save to GitHub. QA runs the self-test."""
    try:
        if (site_runner.site_path(project_id) / "node_modules").is_dir():
            site_runner.previews.start(project_id)
    except Exception:
        pass
    try:
        await save_to_github(project_id, message)
    except github.GitHubError:
        pass


# ---------- Stage 4: how the website is built ----------

SETUP_JSON = "docs/04-setup.json"
# 1. UI + API together (Next.js + Prisma), 2. UI + a dedicated API service,
# 3. static UI that calls another service's existing API (no backend or database of our own).
# 4. a landing page: one commercial, modern page, designed by Stage 4 itself (UI Design can be skipped).
SETUPS = ("all_in_one", "api_service", "static_external", "landing")
SETUP_LANGUAGES = ("typescript", "python")
AVAILABLE_SETUPS = ("all_in_one", "api_service", "static_external", "landing")
URL = re.compile(r"^https?://[^\s/$.?#][^\s]*$", re.IGNORECASE)
# The landing page's hero video (made by the owner, e.g. in Google Flow), served by the site itself.
LANDING_VIDEO_TYPES = {"video/mp4": ".mp4", "video/webm": ".webm"}
LANDING_VIDEO_MAX = 60 * 1024 * 1024


class BuildSetup(BaseModel):
    setup: Literal["all_in_one", "api_service", "static_external", "landing"] = "all_in_one"
    api_language: Literal["typescript", "python"] = "typescript"
    # Option 4: the landing page's showpiece. "modern" = motion and layered visuals, "3d" = a
    # three.js scene, "video" = a full-screen video hero (the owner makes it in Google Flow).
    landing_style: Literal["modern", "3d", "video"] = "modern"
    # Option 3: the other service's API the static pages call.
    api_base_url: str = ""
    api_docs_url: str = ""
    api_auth: Literal["none", "public_key"] = "none"
    api_notes: str = ""


def read_setup(project_id: str) -> dict:
    raw = workspace.read_text(project_id, SETUP_JSON)
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        data = {}
    try:
        setup = BuildSetup.model_validate({k: v for k, v in data.items() if k in BuildSetup.model_fields})
    except Exception:
        setup = BuildSetup()
    return setup.model_dump()


def setup_info(session: Session, project_id: str) -> dict:
    setup = read_setup(project_id)
    schema, _ = read_json(project_id, SCHEMA_JSON)
    db_state = get_stage_state(session, project_id, DATA_STAGE).status
    return {
        **setup,
        "available": list(AVAILABLE_SETUPS),
        # Only a dedicated API service insists on a database of its own.
        "needs_database": setup["setup"] == "api_service",
        "database_ready": db_state == "approved" and isinstance(schema, dict) and schema.get("mode") != "none",
        # Option 3 may be built before the service is known (it can be given later): never blocks.
        "needs_service": False,
        "locked": (workspace.workspace_path(project_id) / site_runner.BUILD_JSON).exists(),
        "design_skipped": (workspace.workspace_path(project_id) / DESIGN_SKIP_JSON).exists(),
        "landing_video": landing_video(project_id),
        "landing_video_portrait": landing_video(project_id, "hero-portrait"),
        "video_prompts": landing_prompts(project_id),
        # The owner's secret keys: they need a server to be used, which a static UI doesn't have.
        "server_keys": [k["name"] for k in project_keys.overview(project_id)
                        if k.get("source") == "owner" and k.get("secret")],
    }


@app.get("/api/projects/{project_id}/build/setup")
def get_build_setup(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    return setup_info(session, project_id)


@app.put("/api/projects/{project_id}/build/setup")
def put_build_setup(project_id: str, body: BuildSetup, session: Session = Depends(get_session)):
    """Choose how the website is built, before the build starts."""
    get_project(session, project_id)
    if get_stage_state(session, project_id, BUILD_STAGE).status == "approved":
        raise HTTPException(409, "This stage is approved. Reopen it to make changes.")
    if (workspace.workspace_path(project_id) / site_runner.BUILD_JSON).exists():
        raise HTTPException(409, "The build has started with its setup. Use Start over to choose another.")
    if body.setup not in AVAILABLE_SETUPS:
        raise HTTPException(400, "This setup is not available yet")
    for label, value in (("API address", body.api_base_url), ("Docs link", body.api_docs_url)):
        if value.strip() and not URL.match(value.strip()):
            raise HTTPException(400, f"{label} must start with https:// (or http://)")
    data = body.model_dump()
    data.update(api_base_url=body.api_base_url.strip(), api_docs_url=body.api_docs_url.strip(),
                api_notes=body.api_notes.strip()[:500])
    if (workspace.workspace_path(project_id) / DESIGN_SKIP_JSON).exists() and body.setup != "landing":
        raise HTTPException(409, "UI Design was skipped, so only a landing page can be built. "
                                 "Reopen UI Design to design a full website.")
    write_setup(project_id, data)
    return setup_info(session, project_id)


def write_setup(project_id: str, data: dict) -> None:
    path = workspace.workspace_path(project_id) / SETUP_JSON
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def landing_video_dir(project_id: str) -> Path:
    return site_runner.site_path(project_id) / "public" / "media"


def landing_video(project_id: str, name: str = "hero") -> dict | None:
    folder = landing_video_dir(project_id)
    for ext in LANDING_VIDEO_TYPES.values():
        path = folder / f"{name}{ext}"
        if path.exists():
            return {"file": f"/media/{name}{ext}", "size": path.stat().st_size}
    return None


@app.post("/api/projects/{project_id}/build/landing-video")
async def upload_landing_video(project_id: str, file: UploadFile, session: Session = Depends(get_session)):
    """The landing page's hero video (e.g. made in Google Flow). Saved where the site serves it."""
    get_project(session, project_id)
    if get_stage_state(session, project_id, BUILD_STAGE).status == "approved":
        raise HTTPException(409, "This stage is approved. Reopen it to make changes.")
    require_not_deploying(session, project_id)
    ext = LANDING_VIDEO_TYPES.get((file.content_type or "").lower())
    if not ext:
        raise HTTPException(400, "Upload an MP4 or WebM video.")
    data = await file.read(LANDING_VIDEO_MAX + 1)
    if len(data) > LANDING_VIDEO_MAX:
        raise HTTPException(400, "The video is over 60 MB. Export it shorter or smaller (1080p, 8-15 seconds is plenty).")
    site_runner.ensure_site(project_id)
    folder = landing_video_dir(project_id)
    folder.mkdir(parents=True, exist_ok=True)
    for other in LANDING_VIDEO_TYPES.values():
        (folder / f"hero{other}").unlink(missing_ok=True)
    (folder / f"hero{ext}").write_bytes(data)
    # Also as a frame sequence, so the page can play it with the scroll.
    await asyncio.to_thread(flow_video.make_scroll_frames, folder / f"hero{ext}")
    return setup_info(session, project_id)


STORYBOARD_JSON = "docs/04-storyboard.json"
STORYBOARD_MD = "docs/04-storyboard.md"


def read_storyboard(project_id: str) -> dict | None:
    data, _ = read_json(project_id, STORYBOARD_JSON)
    return data if isinstance(data, dict) else None


def storyboard_status(project_id: str) -> str | None:
    board = read_storyboard(project_id)
    return board.get("status") if board else None


@app.get("/api/projects/{project_id}/build/storyboard")
def get_storyboard(project_id: str, session: Session = Depends(get_session)):
    """The landing page's scroll storyboard (the Motion Director's), for the owner to review."""
    get_project(session, project_id)
    board = read_storyboard(project_id)
    return {
        "storyboard": board,
        "markdown": workspace.read_text(project_id, STORYBOARD_MD),
        "approved": bool(board) and board.get("status") == "approved",
        "build_started": (workspace.workspace_path(project_id) / site_runner.BUILD_JSON).exists(),
    }


@app.post("/api/projects/{project_id}/build/storyboard/approve")
def approve_storyboard(project_id: str, session: Session = Depends(get_session)):
    """The owner is happy with the storyboard: the builder builds from it next."""
    get_project(session, project_id)
    if active_run(session, project_id):
        raise HTTPException(409, "Wait for Gagesite to finish the storyboard first")
    board = read_storyboard(project_id)
    if not board or not board.get("sections"):
        raise HTTPException(409, "There is no storyboard yet")
    board["status"] = "approved"
    board["approved_at"] = utcnow().isoformat()
    (workspace.workspace_path(project_id) / STORYBOARD_JSON).write_text(
        json.dumps(board, indent=2, ensure_ascii=False), encoding="utf-8")
    return get_storyboard(project_id, session)


LANDING_PROMPTS_JSON = "docs/04-landing-video.json"


def landing_prompts(project_id: str) -> list[dict]:
    """The Google Flow prompts the builder wrote for this landing page's hero video."""
    data, _ = read_json(project_id, LANDING_PROMPTS_JSON)
    prompts = (data or {}).get("prompts") if isinstance(data, dict) else None
    return [
        {"title": str(p.get("title") or f"Version {i + 1}")[:80], "prompt": str(p["prompt"])[:2000],
         "aspect": p.get("aspect") if p.get("aspect") in flow_video.ASPECTS else "16:9",
         # Hero loops are 6 to 10 seconds (longer costs more credits and loads slower).
         "seconds": min(10, max(6, int(p.get("seconds") or 8))) if str(p.get("seconds") or "8").isdigit() else 8}
        for i, p in enumerate(prompts or []) if isinstance(p, dict) and str(p.get("prompt") or "").strip()
    ][:6]


@app.get("/api/flow")
def flow_status():
    """Gagesite's own Google Flow sign-in, used to make landing page videos in the background."""
    return flow_video.worker.status()


@app.post("/api/flow/sign-in")
def flow_sign_in():
    """Opens a normal Chrome window on Gagesite's Flow profile; the owner signs in there by hand."""
    try:
        flow_video.worker.open_sign_in()
    except flow_video.FlowError as exc:
        raise HTTPException(409, str(exc)) from None
    return flow_video.worker.status()


@app.post("/api/flow/check")
async def flow_check():
    try:
        return await asyncio.to_thread(flow_video.worker.check)
    except flow_video.FlowError as exc:
        raise HTTPException(409, str(exc)) from None


class FlowVideoRequest(BaseModel):
    prompt: str = PydanticField(min_length=1, max_length=2000)
    aspect: Literal["16:9", "9:16"] = "16:9"
    seconds: int = PydanticField(default=8, ge=6, le=10)


@app.post("/api/projects/{project_id}/build/landing-video/generate")
def generate_landing_video(project_id: str, body: FlowVideoRequest, session: Session = Depends(get_session)):
    """Make the hero video with Google Flow in the background (one generation, the owner's credits)."""
    get_project(session, project_id)
    if get_stage_state(session, project_id, BUILD_STAGE).status == "approved":
        raise HTTPException(409, "This stage is approved. Reopen it to make changes.")
    require_not_deploying(session, project_id)
    site_runner.ensure_site(project_id)
    name = "hero" if body.aspect == "16:9" else "hero-portrait"
    try:
        job = flow_video.worker.submit(project_id, body.prompt, body.aspect,
                                       landing_video_dir(project_id) / f"{name}.mp4", body.seconds)
    except flow_video.FlowError as exc:
        raise HTTPException(409, str(exc)) from None
    return flow_video._job_view(job)


@app.get("/api/projects/{project_id}/build/landing-video/jobs")
def landing_video_jobs(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    return flow_video.worker.project_jobs(project_id)


@app.delete("/api/projects/{project_id}/build/landing-video")
def delete_landing_video(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    if get_stage_state(session, project_id, BUILD_STAGE).status == "approved":
        raise HTTPException(409, "This stage is approved. Reopen it to make changes.")
    require_not_deploying(session, project_id)
    for name in ("hero", "hero-portrait"):
        for ext in LANDING_VIDEO_TYPES.values():
            (landing_video_dir(project_id) / f"{name}{ext}").unlink(missing_ok=True)
        shutil.rmtree(landing_video_dir(project_id) / f"{name}-frames", ignore_errors=True)
    return setup_info(session, project_id)


@app.post("/api/projects/{project_id}/design/skip")
def skip_design(project_id: str, session: Session = Depends(get_session)):
    """Skip UI Design to build a landing page: Stage 4's landing designer does the look itself."""
    get_project(session, project_id)
    state = get_stage_state(session, project_id, DESIGN_STAGE)
    if state.status == "approved":
        return {"ok": True, "already": True}
    if state.status != "active":
        raise HTTPException(409, "Finish the earlier stages first")
    if active_run(session, project_id):
        raise HTTPException(409, "Wait for Gagesite to finish first")
    require_earlier_approved(session, project_id, DESIGN_STAGE)
    root = workspace.workspace_path(project_id)
    if not (root / site_runner.BUILD_JSON).exists():
        setup = read_setup(project_id)
        setup["setup"] = "landing"
        write_setup(project_id, setup)
    elif read_setup(project_id)["setup"] != "landing":
        raise HTTPException(409, "The build has already started as a full website. Use Start over in "
                                 "Implementation first.")
    skip_file = root / DESIGN_SKIP_JSON
    skip_file.parent.mkdir(parents=True, exist_ok=True)
    skip_file.write_text(json.dumps({"skipped": True, "for": "landing", "at": utcnow().isoformat()}, indent=2),
                         encoding="utf-8")
    state.status, state.approved_at, state.artifact_hash = "approved", utcnow(), None
    session.add(state)
    nxt = get_stage_state(session, project_id, BUILD_STAGE)
    if nxt.status == "locked":
        nxt.status = "active"
        session.add(nxt)
    session.commit()
    sync_pipeline_file(session, project_id)
    return {"ok": True}


@app.get("/api/projects/{project_id}/build/team")
def team_info(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    return build_team.info(project_id)


class TeamStart(BaseModel):
    retry_blocked: bool = False


@app.post("/api/projects/{project_id}/build/team/start")
async def team_start(project_id: str, body: TeamStart | None = None, session: Session = Depends(get_session)):
    """Start (or resume) the team build: Advisor plans, Developer builds, QA tests each task."""
    get_project(session, project_id)
    state = get_stage_state(session, project_id, BUILD_STAGE)
    if state.status != "active":
        raise HTTPException(409, "Approve the design first" if state.status == "locked" else "This stage is approved. Reopen it to make changes.")
    require_earlier_approved(session, project_id, BUILD_STAGE)
    require_setup_database(session, project_id)
    if read_setup(project_id)["setup"] == "landing" and build_team.load_board(project_id) is None:
        raise HTTPException(409, "A landing page is built by one builder, not a team. Use 'Build my landing page'.")
    if active_run(session, project_id):
        raise HTTPException(409, "Gagesite is still working on this project")
    require_not_deploying(session, project_id)
    site_runner.ensure_site(project_id)
    patterns.sync(project_id)
    project_keys.write_manifest(project_id)
    build_team.start(project_id, team_after_dev, retry_blocked=bool(body and body.retry_blocked))
    return build_team.info(project_id) or {"state": "running", "message": "", "current": {}, "tasks": [], "inbox": 0,
                                           "max_attempts": build_team.MAX_ATTEMPTS}


@app.post("/api/projects/{project_id}/build/team/pause")
def team_pause(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    build_team.pause(project_id)
    return build_team.info(project_id)


@app.post("/api/runs/{run_id}/stop")
def stop_run(run_id: str):
    """The owner pressed Stop: end this run now. What was already written is kept."""
    if not runs.stop(run_id):
        raise HTTPException(404, "Nothing is running")
    return {"ok": True}


@app.get("/api/runs/{run_id}/events")
async def run_events(run_id: str):
    handle = runs.get(run_id)
    if not handle:
        raise HTTPException(404, "Run not found (it may have finished before a server restart)")

    async def stream():
        async for event in handle.subscribe():
            yield {"event": "message", "data": json.dumps(event)}

    return EventSourceResponse(stream())


@app.get("/api/projects/{project_id}/stages/{stage_key}/artifact")
def get_artifact(project_id: str, stage_key: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    implemented_stage(stage_key)
    read_artifact, _ = ARTIFACTS[stage_key]
    return read_artifact(project_id)


def editable_scope(session: Session, project_id: str) -> dict:
    """The plan file, for a change the owner makes directly (not through Claude)."""
    get_project(session, project_id)
    if active_run(session, project_id):
        raise HTTPException(409, "Wait for Gagesite to finish first")
    if get_stage_state(session, project_id, "01-scope").status == "approved":
        raise HTTPException(409, "The plan is approved. Reopen it to make changes.")
    raw = workspace.read_text(project_id, SCOPE_JSON)
    if raw is None:
        raise HTTPException(409, "There is no plan yet")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(409, "The plan file is being rewritten; try again in a moment")


def write_scope(project_id: str, data: dict) -> dict:
    (workspace.workspace_path(project_id) / SCOPE_JSON).write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return scope_artifact(project_id)


# ---------- Stage 1: the workflow flowchart, generated on request once the requirements are in ----------

FLOWCHART_JSON = "docs/01-flowchart.json"
FLOWCHART_RUN = "01-flowchart"  # its runs' stage key: kept out of the plan's chat


def flowchart_info(session: Session, project_id: str) -> dict:
    root = workspace.workspace_path(project_id)
    chart_path, scope_path = root / FLOWCHART_JSON, root / SCOPE_JSON
    chart, error = None, None
    if chart_path.exists():
        try:
            chart = json.loads(chart_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            error = "The flowchart file is damaged. Generate it again."
    run = session.exec(
        select(Run).where(Run.project_id == project_id, Run.stage_key == FLOWCHART_RUN).order_by(Run.started_at.desc())
    ).first()
    state = get_stage_state(session, project_id, "01-scope")
    artifact = scope_artifact(project_id)
    open_questions = len((artifact.get("data") or {}).get("open_questions") or [])
    # Generate only once the requirements are gathered: the plan is marked ready, or approved.
    ready = artifact["ready"] or state.status == "approved"
    busy = active_run(session, project_id)
    if busy and busy.stage_key != FLOWCHART_RUN:
        reason = "Gagesite is working on this project. Try again when it finishes."
    elif not ready:
        reason = (f"Gagesite is still gathering your requirements ({open_questions} open "
                  f"{'question' if open_questions == 1 else 'questions'}). The flowchart can be made once the plan is ready."
                  if open_questions else "Gagesite is still gathering your requirements. The flowchart can be made once the plan is ready.")
    else:
        reason = ""
    return {
        "chart": chart,
        "error": error,
        "generated_at": chart_path.stat().st_mtime if chart else None,
        # The plan changed after the flowchart was made: offer to make it again.
        "stale": bool(chart) and scope_path.exists() and scope_path.stat().st_mtime > chart_path.stat().st_mtime + 1,
        "running": bool(run and run.status == "running"),
        "failed": bool(run and run.status == "failed"),
        "can_generate": ready and not busy,
        "reason": reason,
    }


@app.get("/api/projects/{project_id}/scope/flowchart")
def get_flowchart(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    return flowchart_info(session, project_id)


@app.post("/api/projects/{project_id}/scope/flowchart")
async def generate_flowchart(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    info = flowchart_info(session, project_id)
    if not info["can_generate"]:
        raise HTTPException(409, info["reason"] or "The flowchart can't be made right now.")
    from .stages import SCOPE_FLOWCHART

    run = Run(project_id=project_id, stage_key=FLOWCHART_RUN, session_id=str(uuid.uuid4()))
    session.add(run)
    session.commit()
    run_id = run.id
    workspace.refresh_platform_files(project_id)

    async def on_finish(handle: RunHandle, result: RunResult) -> None:
        with Session(engine) as s:
            finished = s.get(Run, run_id)
            finished.status = "failed" if result.is_error else "succeeded"
            finished.error, finished.cost_usd, finished.finished_at = result.error, result.cost_usd, utcnow()
            s.add(finished)
            s.commit()

    runs.start(
        run_id=run_id,
        stage=SCOPE_FLOWCHART,
        workspace=workspace.workspace_path(project_id),
        prompt="Analyse the gathered requirements and write the website's workflow flowchart (docs/01-flowchart.json).",
        session_id=run.session_id,
        resume=False,
        on_finish=on_finish,
        extra_env={"GAGESITE_RUN_STARTED": str(time.time())},
    )
    return flowchart_info(session, project_id)


def content_item(data: dict, index: int, name: str) -> dict:
    """One item of the plan's content checklist; `name` guards against the list having changed."""
    items = data.get("content_checklist") or []
    if not 0 <= index < len(items) or not isinstance(items[index], dict) or items[index].get("item") != name:
        raise HTTPException(409, "The plan changed; reload and try again")
    return items[index]


# ---------- Files attached to a chat message (any stage) ----------

@app.post("/api/projects/{project_id}/chat-files")
async def upload_chat_file(project_id: str, file: UploadFile = File(...), session: Session = Depends(get_session)):
    """A screenshot, PDF, text or Office file for the next message. Sent with the message by its stored name."""
    get_project(session, project_id)
    if not chat_files.allowed(file.filename or ""):
        raise HTTPException(400, "Attach an image or screenshot, a PDF, a text file (.txt, .md, .csv, .json, .log), "
                                 "or a Word or PowerPoint file")
    content = await file.read()
    if not content:
        raise HTTPException(400, "This file is empty")
    if len(content) > chat_files.MAX_BYTES:
        raise HTTPException(413, "Files must be 20 MB or smaller")
    if Path(file.filename or "").suffix.lower() in chat_files.TEXT_KINDS and             project_keys.looks_secret(content.decode("utf-8", errors="replace")):
        raise HTTPException(400, "This file looks like it contains a secret key, so it wasn't attached. Add keys under "
                                 "Keys & settings instead: Gagesite keeps them encrypted and the AI never sees them.")
    return chat_files.add(project_id, file.filename or "file", content)


@app.get("/api/projects/{project_id}/chat-files/{file}")
def get_chat_file(project_id: str, file: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    path = chat_files.find(project_id, file)
    if not path:
        raise HTTPException(404, "File not found")
    return FileResponse(path, headers={"Cache-Control": "private, max-age=86400"})


# ---------- Stage 1: the owner's own documents (menu, price list, brochure...) ----------

@app.get("/api/projects/{project_id}/sources")
def list_sources(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    return sources.list_sources(project_id)


@app.post("/api/projects/{project_id}/sources")
async def upload_source(project_id: str, file: UploadFile = File(...), session: Session = Depends(get_session)):
    """A document Claude reads to fill in the plan. Only while the plan is open."""
    get_project(session, project_id)
    if get_stage_state(session, project_id, "01-scope").status == "approved":
        raise HTTPException(409, "The plan is approved. Reopen it to add documents.")
    if active_run(session, project_id):
        raise HTTPException(409, "Wait for Gagesite to finish first")
    if Path(file.filename or "").suffix.lower() not in sources.KINDS:
        raise HTTPException(400, "Add a PDF, Word (.docx), PowerPoint (.pptx), image or text file")
    content = await file.read()
    if len(content) > sources.MAX_BYTES:
        raise HTTPException(413, "Documents must be 20 MB or smaller")
    return sources.add(project_id, file.filename or "document", content)


class LinkBody(BaseModel):
    url: str


@app.post("/api/projects/{project_id}/sources/link")
async def add_source_link(project_id: str, body: LinkBody, session: Session = Depends(get_session)):
    """Opens a website the owner linked (theirs or one they like) and saves its text and a screenshot."""
    get_project(session, project_id)
    if get_stage_state(session, project_id, "01-scope").status == "approved":
        raise HTTPException(409, "The plan is approved. Reopen it to add a website.")
    try:
        return await asyncio.to_thread(sources.add_link, project_id, body.url)
    except link_reader.LinkError as exc:
        raise HTTPException(400, str(exc)) from None


async def read_links_for(project_id: str, content: str) -> str:
    """Links in a Stage 1 message: read any not read yet, and tell the AI where each one is saved
    (it has no web access). Returns the note to add to the prompt."""
    known = sources.linked_urls(project_id)
    notes = []
    for url in link_reader.find_urls(content):
        name = known.get(url)
        if not name:
            try:
                name = (await asyncio.to_thread(sources.add_link, project_id, url))["name"]
            except link_reader.LinkError as exc:
                notes.append(f"Gagesite could not open {url}: {exc} Ask the owner for a screenshot or a short description instead.")
                continue
        notes.append(
            f"Gagesite opened {url} for you and saved it as `{sources.SOURCES_DIR}/{name}.md` (text of the page and a few "
            f"pages from its menu) and `{sources.SOURCES_DIR}/{name}.jpg` (screenshot). Read both before answering."
        )
    return ("\n\n[" + " ".join(notes) + "]") if notes else ""


@app.delete("/api/projects/{project_id}/sources/{filename}")
def delete_source(project_id: str, filename: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    if active_run(session, project_id):
        raise HTTPException(409, "Wait for Gagesite to finish first")
    sources.remove(project_id, filename)
    return sources.list_sources(project_id)


@app.put("/api/projects/{project_id}/stages/01-scope/details")
def save_scope_details(project_id: str, details: Details, session: Session = Depends(get_session)):
    """The owner types their business details (phone, email, hours...) straight into the plan.
    Only the `details` part of docs/01-scope.json changes; Claude keeps it on its next turn."""
    data = editable_scope(session, project_id)
    data["details"] = details.model_dump()
    return write_scope(project_id, data)


# Words in a checklist item that say which photo slot an upload fills (design kit photo tags).
PHOTO_TAG_HINTS = {"menu": ("menu", "drink", "food", "dish", "product", "메뉴"), "about": ("interior", "exterior", "team", "story", "about", "매장"),
                   "hero": ("hero", "main", "cover", "대표"), "gallery": ("gallery", "갤러리")}


@app.post("/api/projects/{project_id}/stages/01-scope/content/{index}/files")
async def upload_content_files(
    project_id: str,
    index: int,
    item: str = Form(...),
    files: list[UploadFile] = File(...),
    session: Session = Depends(get_session),
):
    """The owner uploads their own images for an image item of the checklist (logo, photos).
    They go into brand/ through the design kit, so the design stage uses the same files."""
    data = editable_scope(session, project_id)
    entry = content_item(data, index, item)
    text = f"{entry.get('item', '')} {entry.get('detail', '')}".lower()
    is_logo = "logo" in text or "로고" in text
    tag = next((t for t, words in PHOTO_TAG_HINTS.items() if any(w in text for w in words)), "other")
    names = list(entry.get("files") or [])
    for upload in files[:1] if is_logo else files[:20]:
        if Path(upload.filename or "").suffix.lower() not in design_kit.IMAGE_EXTENSIONS:
            raise HTTPException(400, "Upload images: PNG, JPG, WEBP, SVG or GIF")
        content = await upload.read()
        if len(content) > design_kit.MAX_IMAGE_BYTES:
            raise HTTPException(413, "Images must be 10 MB or smaller")
        kit = design_kit.add_file(project_id, "logo" if is_logo else "photo", upload.filename or "image", content, tag)
        name = kit.logo if is_logo else kit.photos[-1].file
        names = [name] if is_logo else [n for n in names if n != name] + [name]
    entry.update(files=names, status="provided", kind="image")
    return write_scope(project_id, data)


class ContentChoice(BaseModel):
    item: str
    status: Literal["needed", "placeholder"]


@app.put("/api/projects/{project_id}/stages/01-scope/content/{index}")
def choose_content(project_id: str, index: int, choice: ContentChoice, session: Session = Depends(get_session)):
    """The owner picks sample images for an item for now ("placeholder"), or undoes it ("needed")."""
    data = editable_scope(session, project_id)
    entry = content_item(data, index, choice.item)
    entry["status"] = "provided" if entry.get("files") and choice.status == "needed" else choice.status
    text = f"{entry.get('item', '')} {entry.get('detail', '')}".lower()
    if choice.status == "placeholder" and "logo" not in text and "로고" not in text:
        # Photos: find sample photos now and keep their links, so the design shows exactly these.
        entry["kind"] = "image"
        entry["samples"] = samples.find_samples(entry.get("sample_keywords") or f"{data.get('business', {}).get('industry', '')} {entry.get('item', '')}")
    else:
        entry["samples"] = []
    return write_scope(project_id, data)


@app.post("/api/projects/{project_id}/stages/{stage_key}/approve")
def approve_stage(project_id: str, stage_key: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    implemented_stage(stage_key)
    # Approving twice (a second tab, or a page that hadn't refreshed yet) just confirms it.
    if get_stage_state(session, project_id, stage_key).status == "approved":
        return {"ok": True, "already": True}
    if active_run(session, project_id) or build_team.is_running(project_id):
        raise HTTPException(409, "Wait for Gagesite to finish first")
    require_earlier_approved(session, project_id, stage_key)
    read_artifact, artifact_file = ARTIFACTS[stage_key]
    artifact = read_artifact(project_id)
    # The plan only needs its essentials; other stages still wait for Claude to mark them ready.
    if not artifact.get("approvable", artifact["ready"]):
        missing = [r["label"] for r in artifact.get("required", []) if not r["done"]]
        reason = "; ".join(artifact["errors"]) or (f"add {', '.join(missing)}" if missing else "still a draft")
        raise HTTPException(409, "Not ready yet: " + reason)
    if stage_key == "01-scope":
        # A plan approved before Claude finished: record that, so the next stages fill gaps with defaults.
        data = json.loads(workspace.read_text(project_id, SCOPE_JSON) or "{}")
        business = data.setdefault("business", {})
        if not business.get("name"):
            business["name"] = scope_business_name(data)
        if not business["name"]:
            # No name yet: a plain stand-in the owner replaces later, so nothing invents one.
            business["name"] = "Your business"
            data.setdefault("assumptions", []).append(
                'The business name is not given yet; "Your business" stands in until the owner adds it.'
            )
        if data.get("status") != "ready":
            data["status"] = "ready"
            data.setdefault("assumptions", []).append(
                "Approved by the owner before every question was answered; later steps use sensible defaults for open questions."
            )
        (workspace.workspace_path(project_id) / SCOPE_JSON).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    state = get_stage_state(session, project_id, stage_key)
    state.status, state.approved_at = "approved", utcnow()
    state.artifact_hash = workspace.file_hash(project_id, artifact_file)
    session.add(state)
    next_stage = next((s for s in STAGES if s.order == STAGES_BY_KEY[stage_key].order + 1), None)
    if next_stage:
        nxt = get_stage_state(session, project_id, next_stage.key)
        if nxt.status == "locked":
            nxt.status = "active"
            session.add(nxt)
    session.commit()
    sync_pipeline_file(session, project_id)
    return {"ok": True}


@app.post("/api/projects/{project_id}/stages/{stage_key}/reopen")
def reopen_stage(project_id: str, stage_key: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    state = get_stage_state(session, project_id, stage_key)
    if state.status != "approved":
        raise HTTPException(409, "Stage is not approved")
    state.status, state.approved_at = "active", None
    session.add(state)
    session.commit()
    if stage_key == DESIGN_STAGE:
        # Reopening a skipped UI Design means "design it here after all".
        (workspace.workspace_path(project_id) / DESIGN_SKIP_JSON).unlink(missing_ok=True)
    sync_pipeline_file(session, project_id)
    return {"ok": True}


# What "start over" clears for each stage (only stages that offer it).
RESET_FILES = {
    # The plan, its summary and its flowchart; the owner's uploads (docs/01-sources/) stay.
    "01-scope": (SCOPE_JSON, SCOPE_MD, FLOWCHART_JSON),
    DATA_STAGE: (SCHEMA_JSON, SCHEMA_PRISMA, DATABASE_MD),
    # The styles, components and key pages; the owner's design kit and brand files stay.
    DESIGN_STAGE: (DESIGN_MD,),
    BUILD_STAGE: (site_runner.BUILD_JSON, site_runner.BUILD_MD, build_team.BOARD, "docs/04-setup.json",
                  "docs/04-storyboard.json", "docs/04-storyboard.md"),
}
# Folders a reset empties. site/ keeps its .git history, so saving to GitHub after a fresh
# build is just the next version instead of a clash with what's already there.
RESET_DIRS = {
    DESIGN_STAGE: ("docs/03-design",),
    BUILD_STAGE: ("site", site_runner.SCREENS_DIR, build_team.RUNS_DIR, build_team.QA_DIR, "docs/04-motion"),
}


def empty_folder(folder: Path, keep: tuple[str, ...] = (".git",)) -> None:
    if not folder.is_dir():
        return
    for child in folder.iterdir():
        if child.name in keep:
            continue
        if child.is_dir():
            shutil.rmtree(child, ignore_errors=True)
        else:
            child.unlink(missing_ok=True)


@app.post("/api/projects/{project_id}/stages/{stage_key}/reset")
def reset_stage(project_id: str, stage_key: str, session: Session = Depends(get_session)):
    """Start a stage over (e.g. after picking the wrong starting point): its outputs and its
    conversation are cleared and the next message starts a fresh one. Uploaded files are kept."""
    get_project(session, project_id)
    if stage_key not in RESET_FILES:
        raise HTTPException(400, "This step can't be started over")
    if active_run(session, project_id) or build_team.is_running(project_id):
        raise HTTPException(409, "Wait for Gagesite to finish first")
    state = get_stage_state(session, project_id, stage_key)
    if state.status == "locked":
        raise HTTPException(409, "This step isn't open yet.")
    if state.status == "approved":  # starting an approved step over reopens it first
        state.status, state.approved_at = "active", None
    root = workspace.workspace_path(project_id)
    if stage_key == BUILD_STAGE:
        site_runner.previews.stop(project_id)  # the dev server holds files open
    for relative in RESET_FILES[stage_key]:
        (root / relative).unlink(missing_ok=True)
    for relative in RESET_DIRS.get(stage_key, ()):
        empty_folder(root / relative)
    for message in session.exec(select(Message).where(Message.project_id == project_id, Message.stage_key == stage_key)):
        session.delete(message)
    state.session_id = None  # a new conversation, with no memory of the old one
    session.add(state)
    session.commit()
    sync_pipeline_file(session, project_id)  # later stages see this one is open again
    return {"ok": True}


@app.post("/api/projects/{project_id}/stages/02-database/simple")
def choose_simple_site(project_id: str, session: Session = Depends(get_session)):
    """No database: nothing to design, so the simple-site design is written from the plan and the
    step is approved at once. Reopening it and starting over brings the choices back."""
    get_project(session, project_id)
    if active_run(session, project_id):
        raise HTTPException(409, "Wait for Gagesite to finish first")
    state = get_stage_state(session, project_id, DATA_STAGE)
    if state.status != "active":
        raise HTTPException(409, "This step isn't open right now")
    scope, _ = read_json(project_id, SCOPE_JSON)
    schema, markdown = simple_site.build(scope if isinstance(scope, dict) else {})
    root = workspace.workspace_path(project_id)
    (root / SCHEMA_PRISMA).unlink(missing_ok=True)
    (root / SCHEMA_JSON).write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
    (root / DATABASE_MD).write_text(markdown, encoding="utf-8")
    # Any earlier conversation was about a database design that no longer applies.
    for message in session.exec(select(Message).where(Message.project_id == project_id, Message.stage_key == DATA_STAGE)):
        session.delete(message)
    state.session_id = None
    session.add(state)
    session.commit()
    return approve_stage(project_id, DATA_STAGE, session)


# ---------- Stage 2 uploads ----------

# The connected source database's profile (structure, counts, masked samples), kept with the
# private uploads so it is never shipped. Only its summary reaches docs/02-data-profile.*.
SOURCE_PROFILE = ".source-database.json"


def rebuild_profile(project_id: str) -> list[dict]:
    """Re-profile every upload (plus a connected source database) and rewrite
    docs/02-data-profile.* (removed when there is nothing)."""
    folder = workspace.uploads_path(project_id)
    files = sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in profiler.ALLOWED_EXTENSIONS)
    root = workspace.workspace_path(project_id)
    profiles = [profiler.profile_file(path) for path in files]
    if (folder / SOURCE_PROFILE).exists():
        profiles.append(profiler.profile_from_dict(json.loads((folder / SOURCE_PROFILE).read_text(encoding="utf-8"))))
    if not profiles:
        for relative in (PROFILE_MD, PROFILE_JSON):
            (root / relative).unlink(missing_ok=True)
        return []
    (root / PROFILE_MD).write_text(profiler.profile_to_markdown(profiles), encoding="utf-8")
    (root / PROFILE_JSON).write_text(profiler.profiles_to_json(profiles), encoding="utf-8")
    return json.loads(profiler.profiles_to_json(profiles))


@app.get("/api/projects/{project_id}/uploads")
def list_uploads(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    raw = workspace.read_text(project_id, PROFILE_JSON)
    return json.loads(raw) if raw else []


@app.post("/api/projects/{project_id}/uploads")
async def upload_file(project_id: str, file: UploadFile = File(...), session: Session = Depends(get_session)):
    get_project(session, project_id)
    if get_stage_state(session, project_id, DATA_STAGE).status != "active":
        raise HTTPException(409, "Uploads are only possible while database design is in progress")
    name = Path(file.filename or "").name
    if Path(name).suffix.lower() not in profiler.ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Upload an Excel (.xlsx, .xls), CSV or SQL file")
    content = await file.read()
    if len(content) > profiler.MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Files must be 20 MB or smaller")
    (workspace.uploads_path(project_id) / name).write_bytes(content)
    return rebuild_profile(project_id)


@app.delete("/api/projects/{project_id}/uploads/{filename}")
def delete_upload(project_id: str, filename: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    if get_stage_state(session, project_id, DATA_STAGE).status != "active":
        raise HTTPException(409, "Uploads can only change while database design is in progress")
    (workspace.uploads_path(project_id) / Path(filename).name).unlink(missing_ok=True)
    return rebuild_profile(project_id)


@app.post("/api/projects/{project_id}/uploads/purge")
def purge_uploads(project_id: str, session: Session = Depends(get_session)):
    """Deletes the raw uploaded files. The Stage 5 import calls this once rows are in the owner's database.
    The masked profile stays, so the design screens still show what was uploaded."""
    get_project(session, project_id)
    return {"deleted": workspace.purge_uploads(project_id)}


# ---------- Where the website's data lives (owner's own database) ----------

class ConnectionBody(BaseModel):
    provider: str
    url: str


# ---------- Stage 2: an existing database to design around (read only) ----------

def source_info(source: SourceDatabase | None) -> dict | None:
    if not source:
        return None
    return {
        "provider": source.provider,
        "label": source_db.label(source.provider),
        "host": source.host,
        "database": source.database,
        "table_count": source.table_count,
        "connected_at": source.connected_at,
    }


@app.get("/api/projects/{project_id}/source-database")
def get_source_database(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    return source_info(session.get(SourceDatabase, project_id))


@app.put("/api/projects/{project_id}/source-database")
def connect_source_database(project_id: str, body: ConnectionBody, session: Session = Depends(get_session)):
    """Connects the owner's existing database read-only and profiles it like an upload:
    structure, row counts and masked samples only. The connection string is stored encrypted."""
    get_project(session, project_id)
    check_provider(body.provider)
    if get_stage_state(session, project_id, DATA_STAGE).status != "active":
        raise HTTPException(409, "You can connect a database only while database design is in progress")
    result = db_connect.test(body.url)
    if not result.ok:
        raise HTTPException(400, " ".join(part for part in (result.error, result.hint) if part))
    try:
        found = source_db.profile(body.url, body.provider)
    except Exception as exc:
        raise HTTPException(400, db_connect._friendly(exc, db_connect.parse(body.url))[0])
    if found.error:
        raise HTTPException(400, found.error)
    source = session.get(SourceDatabase, project_id) or SourceDatabase(project_id=project_id, provider=body.provider, encrypted_url="", host="", database="", table_count=0)
    source.provider, source.encrypted_url = body.provider, secrets_store.encrypt(db_connect.normalize(body.url))
    source.host, source.database = result.host or "", result.database or ""
    source.table_count, source.connected_at = len(found.sheets), utcnow()
    session.add(source)
    session.commit()
    (workspace.uploads_path(project_id) / SOURCE_PROFILE).write_text(json.dumps(asdict(found), ensure_ascii=False), encoding="utf-8")
    return {"source": source_info(source), "uploads": rebuild_profile(project_id)}


@app.delete("/api/projects/{project_id}/source-database")
def disconnect_source_database(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    if get_stage_state(session, project_id, DATA_STAGE).status == "approved":
        raise HTTPException(409, "The design is approved. Reopen it first.")
    source = session.get(SourceDatabase, project_id)
    if source:
        session.delete(source)
        session.commit()
    (workspace.uploads_path(project_id) / SOURCE_PROFILE).unlink(missing_ok=True)
    return {"source": None, "uploads": rebuild_profile(project_id)}


def connection_view(connection: DatabaseConnection | None) -> dict | None:
    # Everything except the connection string itself.
    if not connection:
        return None
    return {
        "provider": connection.provider,
        "host": connection.host,
        "database": connection.database,
        "username": connection.username,
        "server_version": connection.server_version,
        "table_count": connection.table_count,
        "tested_at": connection.tested_at,
    }


def require_design_approved(session: Session, project_id: str) -> None:
    if get_stage_state(session, project_id, DATA_STAGE).status != "approved":
        raise HTTPException(409, "Approve the database design first")


def check_provider(provider: str) -> None:
    if provider not in db_connect.PROVIDERS:
        raise HTTPException(400, "Unknown database provider")


@app.get("/api/projects/{project_id}/database-connection")
def get_connection(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    return connection_view(session.get(DatabaseConnection, project_id))


@app.post("/api/projects/{project_id}/database-connection/test")
def test_connection(project_id: str, body: ConnectionBody, session: Session = Depends(get_session)):
    """Tries the pasted string without saving it."""
    get_project(session, project_id)
    check_provider(body.provider)
    return db_connect.test(body.url).to_dict()


@app.post("/api/projects/{project_id}/database-connection/retest")
def retest_connection(project_id: str, session: Session = Depends(get_session)):
    """Tries the saved string again (the browser never has it)."""
    get_project(session, project_id)
    connection = session.get(DatabaseConnection, project_id)
    if not connection:
        raise HTTPException(404, "No database connected")
    result = db_connect.test(secrets_store.decrypt(connection.encrypted_url))
    if result.ok:
        connection.server_version, connection.table_count = result.server_version, result.table_count
        connection.tested_at = utcnow()
        session.add(connection)
        session.commit()
    return result.to_dict()


def require_not_deploying(session: Session, project_id: str) -> None:
    row = session.get(Deployment, project_id)
    if row and row.status == "running":
        raise HTTPException(409, "Wait until your website has finished going online")


def forget_first_account(session: Session, project_id: str) -> None:
    """A different live database has none of the owner's accounts: ask for the first one again."""
    row = session.get(Deployment, project_id)
    if row and row.first_account_email:
        row.first_account_email = None
        session.add(row)


@app.put("/api/projects/{project_id}/database-connection")
def save_connection(project_id: str, body: ConnectionBody, session: Session = Depends(get_session)):
    get_project(session, project_id)
    require_not_deploying(session, project_id)
    require_design_approved(session, project_id)
    check_provider(body.provider)
    result = db_connect.test(body.url)
    if not result.ok:
        raise HTTPException(400, result.error or "Connection failed")
    if not result.can_create:
        raise HTTPException(400, "This user can't create tables in the database. Use the main database user.")
    connection = session.get(DatabaseConnection, project_id) or DatabaseConnection(project_id=project_id, provider=body.provider,
                                                                                   encrypted_url="", host="", database="",
                                                                                   username="", server_version="", table_count=0)
    if (connection.host, connection.database) != (result.host, result.database):
        forget_first_account(session, project_id)
    connection.provider = body.provider
    # Store the encoded form, so symbols in the password work when Stage 5 connects.
    connection.encrypted_url = secrets_store.encrypt(db_connect.normalize(body.url))
    connection.host, connection.database, connection.username = result.host, result.database, result.username
    connection.server_version, connection.table_count = result.server_version, result.table_count
    connection.tested_at = utcnow()
    session.add(connection)
    session.commit()
    sync_pipeline_file(session, project_id)
    return connection_view(connection)


def saved_connection(session: Session, project_id: str) -> DatabaseConnection:
    connection = session.get(DatabaseConnection, project_id)
    if not connection:
        raise HTTPException(404, "No database connected")
    return connection


def approved_prisma(session: Session, project_id: str) -> str:
    require_design_approved(session, project_id)
    text = workspace.read_text(project_id, SCHEMA_PRISMA)
    if not text:
        raise HTTPException(409, "The approved design has no Prisma schema")
    return text


def supabase_ref(connection: DatabaseConnection) -> str | None:
    """Project ref for linking to the Supabase dashboard (pooler user 'postgres.<ref>' or host 'db.<ref>.supabase.co')."""
    if connection.username.startswith("postgres."):
        return connection.username.split(".", 1)[1]
    if connection.host.startswith("db.") and connection.host.endswith(".supabase.co"):
        return connection.host.split(".")[1]
    return None


# ---------- Stage 2 Data tab: the owner's rows, from their database or their uploaded files ----------

def data_design(project_id: str) -> tuple[dict, dict[str, str]]:
    """The design's tables (as Claude described them) and model name -> real table name."""
    raw = workspace.read_text(project_id, SCHEMA_JSON)
    try:
        schema = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        schema = {}
    return schema, data_browser.model_tables(workspace.read_text(project_id, SCHEMA_PRISMA) or "")


def upload_file_path(project_id: str, file: str) -> Path | None:
    path = workspace.uploads_path(project_id) / Path(file).name
    return path if path.is_file() else None


@app.get("/api/projects/{project_id}/data")
def data_overview(project_id: str, session: Session = Depends(get_session)):
    """Per design table: how many rows the owner's database has, and which uploaded sheets feed it."""
    get_project(session, project_id)
    schema, real_names = data_design(project_id)
    tables = [t for t in schema.get("tables", []) if isinstance(t, dict) and t.get("name")]
    profile = json.loads(workspace.read_text(project_id, PROFILE_JSON) or "[]")
    sheet_rows = {(f["file"], s["name"]): s.get("rows") for f in profile for s in f.get("sheets", [])}

    connection = session.get(DatabaseConnection, project_id)
    database: dict = {"connected": connection is not None, "provider": connection.provider if connection else None}
    counts: dict[str, int | None] = {}
    if connection:
        try:
            counts = data_browser.db_counts(
                secrets_store.decrypt(connection.encrypted_url), [real_names.get(t["name"], t["name"]) for t in tables]
            )
        except Exception as exc:  # unreachable database: still show the files
            database["error"] = db_connect._friendly(exc, db_connect.parse(secrets_store.decrypt(connection.encrypted_url)))[0]

    # Rows can also come from the owner's existing database (connected read-only as a source).
    source = session.get(SourceDatabase, project_id)
    source_label = source_db.label(source.provider) if source else None

    def sources_for(name: str | None) -> list[dict]:
        return [
            {
                "file": s["file"],
                "sheet": s.get("sheet", ""),
                "rows": sheet_rows.get((s["file"], s.get("sheet", "")), s.get("rows")),
                "available": upload_file_path(project_id, s["file"]) is not None or s["file"] == source_label,
                "notes": s.get("notes", ""),
            }
            for s in schema.get("data_sources", [])
            if isinstance(s, dict) and s.get("maps_to") == name
        ]

    return {
        "database": database,
        "tables": [
            {
                "name": t["name"],
                "label": t.get("label") or t["name"],
                "description": t.get("description", ""),
                "db_rows": counts.get(real_names.get(t["name"], t["name"])),
                "sources": sources_for(t["name"]),
            }
            for t in tables
        ],
        "not_imported": sources_for(None),
        "issues": [i for i in schema.get("data_issues", []) if isinstance(i, dict)],
    }


@app.get("/api/projects/{project_id}/data/rows")
def data_rows(
    project_id: str,
    table: str,
    source: Literal["db", "file"] = "db",
    file: str = "",
    sheet: str = "",
    offset: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session),
):
    """One page of rows (at most 200). Read-only; the database connection never writes."""
    get_project(session, project_id)
    schema, real_names = data_design(project_id)
    if table not in {t.get("name") for t in schema.get("tables", []) if isinstance(t, dict)}:
        raise HTTPException(404, "Unknown table")
    offset, limit = max(0, offset), min(max(1, limit), data_browser.PAGE_MAX)
    if source == "db":
        connection = saved_connection(session, project_id)
        url = secrets_store.decrypt(connection.encrypted_url)
        try:
            return data_browser.db_page(url, real_names.get(table, table), offset, limit)
        except Exception as exc:
            raise HTTPException(502, db_connect._friendly(exc, db_connect.parse(url))[0])
    feeds = [s for s in schema.get("data_sources", []) if isinstance(s, dict) and s.get("maps_to") == table]
    if not any(s.get("file") == file and s.get("sheet", "") == sheet for s in feeds):
        raise HTTPException(404, "That sheet does not feed this table")
    source = session.get(SourceDatabase, project_id)
    if source and file == source_db.label(source.provider):
        # A table of the owner's existing database: read-only, one page at a time.
        url = secrets_store.decrypt(source.encrypted_url)
        try:
            return data_browser.db_page(url, sheet, offset, limit)
        except Exception as exc:
            raise HTTPException(502, db_connect._friendly(exc, db_connect.parse(url))[0])
    path = upload_file_path(project_id, file)
    if not path:
        raise HTTPException(410, "The uploaded file has been deleted")
    try:
        return data_browser.sheet_page(path, sheet, offset, limit)
    except Exception as exc:
        raise HTTPException(422, f"Could not read the file: {str(exc)[:200]}")


# ---------------------------------------------------------------- importing rows (Data tab)

class ImportSourceBody(BaseModel):
    kind: Literal["file", "upload", "db"]  # file: uploaded for import; upload: a design upload; db: existing database
    file: str = ""
    sheet: str = ""


class ImportPlanBody(BaseModel):
    table: str
    source: ImportSourceBody


class ImportMapping(BaseModel):
    model_config = {"populate_by_name": True}
    column: str
    from_: str | None = PydanticField(default=None, alias="from")
    value: str | None = None
    match: str | None = None


class ImportCheckBody(ImportPlanBody):
    mapping: list[ImportMapping]


def import_frame(session: Session, project_id: str, source: ImportSourceBody):
    """The rows of the chosen source, as a table (read-only)."""
    if source.kind == "db":
        existing = session.get(SourceDatabase, project_id)
        if not existing:
            raise HTTPException(404, "Your existing database isn't connected")
        url = secrets_store.decrypt(existing.encrypted_url)
        try:
            return data_import.read_source_table(url, source.sheet)
        except Exception as exc:
            raise HTTPException(502, db_connect._friendly(exc, db_connect.parse(url))[0])
    if source.kind == "file":
        path = data_import.import_dir(workspace.uploads_path(project_id)) / Path(source.file).name
    else:
        path = upload_file_path(project_id, source.file)
    if not path or not path.is_file():
        raise HTTPException(410, "That file isn't here any more. Upload it again.")
    try:
        return data_import.read_file(path, source.sheet)
    except Exception as exc:
        raise HTTPException(422, f"Couldn't read the file: {str(exc)[:200]}")


def import_target(session: Session, project_id: str, table: str):
    """(design table, real table name, database url, enums, column hints) for a table of the design."""
    schema, real_names = data_design(project_id)
    design_table = next((t for t in schema.get("tables", []) if isinstance(t, dict) and t.get("name") == table), None)
    if not design_table:
        raise HTTPException(404, "Unknown table")
    connection = saved_connection(session, project_id)
    enums = {e.get("name"): [str(v) for v in e.get("values", [])] for e in schema.get("enums", []) if isinstance(e, dict)}
    hints = {}
    for column in design_table.get("columns", []):
        if isinstance(column, dict) and column.get("source"):
            hints[column["name"]] = str(column["source"]).split(">")[-1].strip()
    enums = data_import.prisma_choices(workspace.read_text(project_id, SCHEMA_PRISMA) or "", table, enums) or {}, enums
    return design_table, real_names.get(table, table), secrets_store.decrypt(connection.encrypted_url), enums, hints


@app.get("/api/projects/{project_id}/data/import/sources")
def import_sources(project_id: str, session: Session = Depends(get_session)):
    """Where rows can come from: a new spreadsheet, files uploaded for the design, the owner's existing database."""
    get_project(session, project_id)
    schema, _ = data_design(project_id)
    uploads = []
    for name in sorted({s.get("file") for s in schema.get("data_sources", []) if isinstance(s, dict) and s.get("file")}):
        path = upload_file_path(project_id, name)
        if path and path.suffix.lower() in data_import.FILE_TYPES:
            try:
                uploads.append({"id": name, "name": name, "sheets": data_import.file_sheets(path)})
            except Exception:
                continue
    existing = session.get(SourceDatabase, project_id)
    tables = None
    if existing:
        try:
            tables = data_import.source_tables(secrets_store.decrypt(existing.encrypted_url))
        except Exception:
            tables = None
    return {
        "uploads": uploads,
        "existing": {"label": source_db.label(existing.provider), "tables": tables} if existing else None,
        "job": data_import.job_info(project_id),
    }


@app.post("/api/projects/{project_id}/data/import/file")
async def import_upload(project_id: str, file: UploadFile = File(...), session: Session = Depends(get_session)):
    """Keeps a spreadsheet privately for importing (never shown to Gagesite); removed when the owner closes the import."""
    get_project(session, project_id)
    content = await file.read()
    folder = data_import.import_dir(workspace.uploads_path(project_id))
    for old in folder.iterdir():  # forgotten imports are never kept longer than a day
        if old.is_file() and time.time() - old.stat().st_mtime > 86400:
            old.unlink(missing_ok=True)
    try:
        return await asyncio.to_thread(data_import.save_upload, workspace.uploads_path(project_id),
                                       file.filename or "data.csv", content)
    except data_import.ImportError_ as exc:
        raise HTTPException(400, str(exc)) from None


@app.delete("/api/projects/{project_id}/data/import/file/{file_id}")
def import_forget(project_id: str, file_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    (data_import.import_dir(workspace.uploads_path(project_id)) / Path(file_id).name).unlink(missing_ok=True)
    return None


@app.post("/api/projects/{project_id}/data/import/plan")
async def import_plan(project_id: str, body: ImportPlanBody, session: Session = Depends(get_session)):
    """The table's fields, the source's columns with a few values, and a first guess at the matching."""
    get_project(session, project_id)
    design_table, real, url, enums, hints = import_target(session, project_id, body.table)
    frame = await asyncio.to_thread(import_frame, session, project_id, body.source)

    def work():
        with data_import.connect_write(url) as conn:
            columns = data_import.target_columns(conn, real, design_table, enums[1], enums[0])
            info = []
            for column in columns:
                item = data_import.column_info(column)
                if column.references:
                    item["references"]["match_options"] = data_import.link_columns(conn, column.references[0])
                info.append(item)
            return columns, info

    try:
        columns, info = await asyncio.to_thread(work)
    except data_import.ImportError_ as exc:
        raise HTTPException(409, str(exc)) from None
    except Exception as exc:
        raise HTTPException(502, db_connect._friendly(exc, db_connect.parse(url))[0])
    samples = {}
    for name in frame.columns:
        values = [data_browser._cell(v) for v in frame[name].tolist()[:200] if not data_import._empty(v)]
        samples[str(name)] = list(dict.fromkeys(values))[:3]
    return {
        "table": {"name": body.table, "label": design_table.get("label") or body.table},
        "columns": info,
        "source_columns": [str(c) for c in frame.columns],
        "samples": samples,
        "rows": len(frame),
        "mapping": data_import.suggest(columns, [str(c) for c in frame.columns], hints),
    }


async def checked_import(session: Session, project_id: str, body: ImportCheckBody):
    design_table, real, url, enums, _ = import_target(session, project_id, body.table)
    frame = await asyncio.to_thread(import_frame, session, project_id, body.source)
    mapping = [{"column": m.column, "from": m.from_, "value": m.value, "match": m.match} for m in body.mapping]

    def work():
        with data_import.connect_write(url) as conn:
            columns = data_import.target_columns(conn, real, design_table, enums[1], enums[0])
            return data_import.check(conn, real, columns, frame, mapping, first_row=1 if body.source.kind == "db" else 2)

    try:
        return await asyncio.to_thread(work), url, design_table
    except data_import.ImportError_ as exc:
        raise HTTPException(409, str(exc)) from None
    except Exception as exc:
        raise HTTPException(502, db_connect._friendly(exc, db_connect.parse(url))[0])


@app.post("/api/projects/{project_id}/data/import/check")
async def import_check(project_id: str, body: ImportCheckBody, session: Session = Depends(get_session)):
    """Checks every row and says what would happen. Nothing is written."""
    get_project(session, project_id)
    checked, _, _ = await checked_import(session, project_id, body)
    return data_import.checked_summary(checked)


@app.post("/api/projects/{project_id}/data/import/run")
async def import_run(project_id: str, body: ImportCheckBody, session: Session = Depends(get_session)):
    """Adds the rows that passed the check, all in one go: if anything fails, nothing is added."""
    get_project(session, project_id)
    require_not_deploying(session, project_id)
    if data_import.running(project_id):
        raise HTTPException(409, "An import is already running")
    checked, url, design_table = await checked_import(session, project_id, body)
    if not checked.rows:
        raise HTTPException(409, "There are no new rows to add")
    try:
        data_import.start(project_id, url, checked, design_table.get("label") or body.table)
    except data_import.ImportError_ as exc:
        raise HTTPException(409, str(exc)) from None
    return data_import.job_info(project_id)


@app.get("/api/projects/{project_id}/data/import/status")
def import_status(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    return data_import.job_info(project_id)


@app.get("/api/projects/{project_id}/database-connection/tables")
def connection_tables(project_id: str, session: Session = Depends(get_session)):
    """Which of the approved design's tables already exist in the owner's database."""
    get_project(session, project_id)
    connection = saved_connection(session, project_id)
    design = schema_sql.design_tables(approved_prisma(session, project_id))
    try:
        present = schema_sql.existing_tables(secrets_store.decrypt(connection.encrypted_url))
    except Exception:
        raise HTTPException(502, "Couldn't reach your database to check its tables") from None
    return {
        "design": design,
        "existing": [t for t in design if t in present],
        "other_tables": len(present - set(design)),
        "supabase_ref": supabase_ref(connection) if connection.provider == "supabase" else None,
    }


@app.get("/api/projects/{project_id}/database-connection/sql-preview")
def sql_preview(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    try:
        return {"sql": schema_sql.postgres_sql(approved_prisma(session, project_id))}
    except schema_sql.SchemaSqlError as exc:
        raise HTTPException(500, f"Couldn't generate the SQL: {exc}") from None


@app.post("/api/projects/{project_id}/database-connection/create-tables")
def create_tables(project_id: str, session: Session = Depends(get_session)):
    """Creates the approved design's tables in the owner's database. All-or-nothing, never drops anything."""
    get_project(session, project_id)
    connection = saved_connection(session, project_id)
    if active_run(session, project_id):
        raise HTTPException(409, "Wait for Gagesite to finish first")
    prisma_text = approved_prisma(session, project_id)
    tables = schema_sql.design_tables(prisma_text)
    try:
        sql = schema_sql.postgres_sql(prisma_text)
        schema_sql.create_tables(secrets_store.decrypt(connection.encrypted_url), sql, tables)
    except schema_sql.TablesExist as exc:
        raise HTTPException(409, "These tables already exist, so nothing was changed: " + ", ".join(exc.tables)) from None
    except schema_sql.SchemaSqlError as exc:
        raise HTTPException(500, f"Couldn't generate the SQL: {exc}") from None
    except Exception as exc:  # the transaction rolled back; report the database's reason
        raise HTTPException(502, f"Your database refused the change, so nothing was created: {str(exc).splitlines()[0][:300]}") from None
    connection.table_count += len(tables)
    session.add(connection)
    session.commit()
    return {"created": tables}


@app.delete("/api/projects/{project_id}/database-connection")
def delete_connection(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    require_not_deploying(session, project_id)
    connection = session.get(DatabaseConnection, project_id)
    if connection:
        forget_first_account(session, project_id)
        session.delete(connection)
        session.commit()
        sync_pipeline_file(session, project_id)
    return {"ok": True}


# ---------- Stage 3: design kit and previews ----------

def require_design_active(session: Session, project_id: str) -> None:
    if get_stage_state(session, project_id, DESIGN_STAGE).status != "active":
        raise HTTPException(409, "The design kit can only change while UI design is in progress")


@app.get("/api/projects/{project_id}/design-kit")
def get_design_kit(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    return design_kit.load(project_id)


@app.put("/api/projects/{project_id}/design-kit")
def put_design_kit(project_id: str, body: design_kit.KitSettings, session: Session = Depends(get_session)):
    get_project(session, project_id)
    require_design_active(session, project_id)
    return design_kit.update_settings(project_id, body)


@app.post("/api/projects/{project_id}/design-kit/files")
async def upload_design_file(
    project_id: str,
    kind: str = Form(...),
    tag: str = Form("other"),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    get_project(session, project_id)
    require_design_active(session, project_id)
    if kind not in ("logo", "photo", "reference", "model"):
        raise HTTPException(400, "Unknown file kind")
    suffix = Path(file.filename or "").suffix.lower()
    if kind == "model":
        if suffix not in design_kit.MODEL_EXTENSIONS:
            raise HTTPException(400, "Upload the 3D model as one .glb file (export it as GLB from Blender, Spline and similar apps)")
        content = await file.read()
        if len(content) > design_kit.MAX_MODEL_BYTES:
            raise HTTPException(413, "3D models must be 25 MB or smaller. Export with compressed textures to make it smaller.")
        if not design_kit.is_glb(content):
            raise HTTPException(400, "This file isn't a valid GLB 3D model. Export it again as GLB (glTF binary).")
        return design_kit.add_file(project_id, kind, file.filename or "model.glb", content)
    if suffix not in design_kit.IMAGE_EXTENSIONS:
        raise HTTPException(400, "Upload an image: PNG, JPG, WEBP, SVG or GIF")
    content = await file.read()
    if len(content) > design_kit.MAX_IMAGE_BYTES:
        raise HTTPException(413, "Images must be 10 MB or smaller")
    return design_kit.add_file(project_id, kind, file.filename or "image", content, tag)


class PhotoTag(BaseModel):
    tag: str


@app.patch("/api/projects/{project_id}/design-kit/photos/{filename}")
def tag_design_photo(project_id: str, filename: str, body: PhotoTag, session: Session = Depends(get_session)):
    get_project(session, project_id)
    require_design_active(session, project_id)
    return design_kit.tag_photo(project_id, filename, body.tag)


@app.delete("/api/projects/{project_id}/design-kit/files/{kind}/{filename}")
def delete_design_file(project_id: str, kind: str, filename: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    require_design_active(session, project_id)
    return design_kit.remove_file(project_id, kind, filename)


PICKER_JS = (Path(__file__).parent / "picker.js").read_text(encoding="utf-8")

# Lays the whole component library out as a gallery of cards (one card per component section).
# The app sends the order, groups and wide/narrow layout; clicking a card tells the app which one.
GALLERY_JS = (Path(__file__).parent / "gallery.js").read_text(encoding="utf-8")


# Shows one section of a page (one component of the library) at a time, alone on a stage.
# The page loads once; the app switches sections by postMessage, so switching is instant.
ISOLATE_JS = """(function () {
  window.__gsFinePick = true; // the picker (if loaded) picks parts of the component, not the block
  var style = document.createElement("style");
  style.textContent = "body.gs-iso > *:not(.gs-stage){display:none!important}";
  document.head.appendChild(style);
  var stage = document.createElement("div");
  stage.className = "gs-stage";
  stage.style.cssText = "box-sizing:border-box;padding:28px;display:flex;justify-content:center";
  var inner = document.createElement("div");
  inner.className = "gs-inner";
  inner.style.cssText = "width:100%;max-width:1120px";
  stage.appendChild(inner);
  document.body.appendChild(stage);
  document.body.classList.add("gs-iso");
  document.documentElement.style.minHeight = document.body.style.minHeight = "0";
  // Report the content height so the app can size the preview to fit the component.
  function report() {
    parent.postMessage({ type: "gs-size", height: Math.ceil(stage.getBoundingClientRect().height) }, "*");
  }
  new ResizeObserver(report).observe(stage);
  var current = null, marker = null;
  function show(id) {
    var el = id && document.getElementById(id);
    if (!el || el === current) return;
    if (current && marker) { marker.parentNode.insertBefore(current, marker); marker.remove(); }
    marker = document.createComment("gs-section");
    el.parentNode.insertBefore(marker, el);
    inner.appendChild(el);
    current = el;
    window.scrollTo(0, 0);
    report();
    window.dispatchEvent(new Event("resize")); // the picker redraws comment pins at the new spot
  }
  show(decodeURIComponent(location.hash.slice(1)));
  // A component is a specimen: buttons and toggles still respond, but links and forms never
  // leave the preview (the page's own click handlers still run; only navigation is stopped).
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("a[href]");
    if (link) e.preventDefault();
  }, true);
  document.addEventListener("submit", function (e) { e.preventDefault(); }, true);
  window.addEventListener("message", function (e) {
    if (e.source !== parent || !e.data) return;
    if (e.data.type === "gs-show") show(e.data.id);
    if (e.data.type === "gs-bg") document.documentElement.style.background = document.body.style.background = e.data.value || "";
  });
  parent.postMessage({ type: "gs-ready" }, "*");
})();"""


@app.get("/api/projects/{project_id}/preview/{path:path}")
def preview_file(
    project_id: str,
    path: str,
    pick: bool = False,
    isolate: bool = False,
    gallery: bool = False,
    session: Session = Depends(get_session),
):
    """Serves mockups and the owner's images. The UI shows mockups in a sandboxed iframe.
    With ?pick=1 a mockup gets the point-and-comment picker; with ?isolate=1 it shows one section
    at a time (a component of the library). The file on disk is never changed."""
    get_project(session, project_id)
    if not path.startswith(PREVIEW_ROOTS):
        raise HTTPException(404, "Not found")
    root = workspace.workspace_path(project_id).resolve()
    target = (root / path).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        raise HTTPException(404, "Not found")
    if (pick or isolate or gallery) and target.suffix == ".html":
        html = target.read_text(encoding="utf-8", errors="replace")
        scripts = ""
        if gallery:
            scripts += f"<script>{GALLERY_JS}</script>"
        elif isolate:
            scripts += f"<script>{ISOLATE_JS}</script>"
        if pick:
            scripts += f"<script>{PICKER_JS}</script>"
        html = html.replace("</body>", scripts + "</body>", 1) if "</body>" in html else html + scripts
        return HTMLResponse(html, headers={"Cache-Control": "no-store"})
    return FileResponse(target, headers={"Cache-Control": "no-store"})


# ---------- Stage 4: the live preview and GitHub ----------

def build_open(session: Session, project_id: str) -> None:
    get_project(session, project_id)
    if get_stage_state(session, project_id, BUILD_STAGE).status == "locked":
        raise HTTPException(409, "Approve the design first")


@app.get("/api/projects/{project_id}/build/preview")
def preview_info(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    return site_runner.previews.info(project_id)


@app.post("/api/projects/{project_id}/build/preview/start")
def preview_start(project_id: str, session: Session = Depends(get_session)):
    build_open(session, project_id)
    if not (site_runner.site_path(project_id) / "package.json").exists():
        raise HTTPException(409, "There is no website to preview yet. Ask Gagesite to start building.")
    return site_runner.previews.start(project_id)


@app.post("/api/projects/{project_id}/build/preview/stop")
def preview_stop(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    site_runner.previews.stop(project_id)
    return site_runner.previews.info(project_id)


@app.post("/api/projects/{project_id}/build/screens")
async def build_screens(project_id: str, session: Session = Depends(get_session)):
    build_open(session, project_id)
    if not (site_runner.site_path(project_id) / "node_modules").is_dir():
        raise HTTPException(409, "The website isn't set up yet")
    return {"check": await asyncio.to_thread(site_runner.run_check, project_id)}


def github_info(connection: GitHubConnection | None) -> dict | None:
    if not connection:
        return None
    return {
        "repo": connection.repo,
        "url": connection.url,
        "connected_at": connection.connected_at,
        "last_push_at": connection.last_push_at,
        "last_commit": connection.last_commit,
        "last_error": connection.last_error,
    }


class GitHubBody(BaseModel):
    repo: str
    token: str


@app.get("/api/projects/{project_id}/github")
def get_github(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    return github_info(session.get(GitHubConnection, project_id))


@app.put("/api/projects/{project_id}/github")
async def connect_github(project_id: str, body: GitHubBody, session: Session = Depends(get_session)):
    """Checks the token can write to the repository (creating it, private, when it's missing) and keeps it encrypted."""
    get_project(session, project_id)
    require_not_deploying(session, project_id)
    if not body.token.strip():
        raise HTTPException(400, "Paste a GitHub token")
    try:
        found = await asyncio.to_thread(github.connect, body.repo, body.token.strip())
    except github.GitHubError as exc:
        raise HTTPException(400, str(exc)) from None
    connection = session.get(GitHubConnection, project_id) or GitHubConnection(
        project_id=project_id, repo="", url="", encrypted_token=""
    )
    connection.repo, connection.url = found["repo"], found["url"]
    connection.encrypted_token = secrets_store.encrypt(body.token.strip())
    connection.connected_at, connection.last_error = utcnow(), None
    session.add(connection)
    session.commit()
    session.refresh(connection)
    return github_info(connection)


@app.delete("/api/projects/{project_id}/github")
def disconnect_github(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    require_not_deploying(session, project_id)
    connection = session.get(GitHubConnection, project_id)
    if connection:
        session.delete(connection)
        session.commit()
    return None


@app.post("/api/projects/{project_id}/github/push")
async def push_github(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    if not session.get(GitHubConnection, project_id):
        raise HTTPException(409, "Connect GitHub first")
    if active_run(session, project_id):
        raise HTTPException(409, "Wait for Gagesite to finish first")
    try:
        await save_to_github(project_id, "Gagesite: save the website")
    except github.GitHubError as exc:
        raise HTTPException(400, str(exc)) from None
    session.expire_all()
    return github_info(session.get(GitHubConnection, project_id))


# ---------- Stage 5: the owner's Vercel account and going online ----------

class VercelBody(BaseModel):
    token: str


def vercel_info(connection: VercelConnection | None) -> dict | None:
    return {"username": connection.username, "connected_at": connection.connected_at} if connection else None


@app.get("/api/projects/{project_id}/vercel")
def get_vercel(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    return vercel_info(session.get(VercelConnection, project_id))


@app.put("/api/projects/{project_id}/vercel")
async def connect_vercel(project_id: str, body: VercelBody, session: Session = Depends(get_session)):
    """Checks the owner's Vercel token and keeps it encrypted."""
    get_project(session, project_id)
    require_not_deploying(session, project_id)
    token = body.token.strip()
    if not token:
        raise HTTPException(400, "Paste a Vercel token")
    try:
        found = await asyncio.to_thread(vercel.connect, token)
    except vercel.VercelError as exc:
        raise HTTPException(400, str(exc)) from None
    connection = session.get(VercelConnection, project_id) or VercelConnection(project_id=project_id, username="",
                                                                               encrypted_token="")
    connection.username, connection.encrypted_token = found["username"], secrets_store.encrypt(token)
    connection.connected_at = utcnow()
    session.add(connection)
    session.commit()
    session.refresh(connection)
    return vercel_info(connection)


@app.delete("/api/projects/{project_id}/vercel")
def disconnect_vercel(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    require_not_deploying(session, project_id)
    connection = session.get(VercelConnection, project_id)
    if connection:
        session.delete(connection)
        session.commit()
    return None


class DeploySettingsBody(BaseModel):
    values: dict[str, str]


@app.put("/api/projects/{project_id}/deploy/settings")
def save_deploy_settings(project_id: str, body: DeploySettingsBody, session: Session = Depends(get_session)):
    """The settings the owner fills in for the live website (e.g. an email service key), kept encrypted."""
    get_project(session, project_id)
    allowed = {s["name"] for s in deploy_artifact(project_id)["settings"]}
    row = session.get(Deployment, project_id) or Deployment(project_id=project_id)
    saved = json.loads(secrets_store.decrypt(row.encrypted_settings)) if row.encrypted_settings else {}
    for name, value in body.values.items():
        if name not in allowed:
            raise HTTPException(400, f"{name} isn't one of this website's settings")
        if problem := project_keys.value_problem(name, value):
            raise HTTPException(400, f"{name}: {problem}")
        if value.strip():
            saved[name] = value.strip()
        else:
            saved.pop(name, None)
    row.encrypted_settings = secrets_store.encrypt(json.dumps(saved))
    session.add(row)
    session.commit()
    project_keys.write_manifest(project_id)
    return deploy_artifact(project_id)


# ---------- Keys & settings: the website's API keys and settings (values never reach the AI) ----------

class KeyValues(BaseModel):
    # NAME -> value; an empty value clears it.
    values: dict[str, str]


class NewKey(BaseModel):
    name: str = PydanticField(min_length=2, max_length=64)
    purpose: str = PydanticField(default="", max_length=200)
    secret: bool = True
    value: str = PydanticField(default="", max_length=8000)


class EditKey(BaseModel):
    name: str = PydanticField(min_length=2, max_length=64)
    purpose: str = PydanticField(default="", max_length=200)
    secret: bool = True


def keys_info(project_id: str) -> dict:
    return {"keys": project_keys.overview(project_id), "suggestions": project_keys.suggestions(project_id)}


def valid_key_name(raw: str, secret: bool) -> str:
    name = raw.strip().upper()
    if not project_keys.NAME.match(name):
        raise HTTPException(400, "Use capital letters, digits and _ only, starting with a letter (e.g. MODEL_API_KEY).")
    if name in project_keys.RESERVED:
        raise HTTPException(400, f"{name} is set by Gagesite itself.")
    if name.startswith("NEXT_PUBLIC_") and secret:
        raise HTTPException(400, "Names starting with NEXT_PUBLIC_ are shown to every visitor, so they can't hold a secret.")
    return name


@app.patch("/api/projects/{project_id}/keys/{name}")
def edit_key(project_id: str, name: str, body: EditKey, session: Session = Depends(get_session)):
    """Rename or describe one of the owner's keys (its value moves with it)."""
    get_project(session, project_id)
    if not any(k["name"] == name for k in project_keys.owner_keys(project_id)):
        raise HTTPException(400, "Only keys you added can be renamed; the others are named by the website's code.")
    new_name = valid_key_name(body.name, body.secret)
    if new_name != name and any(k["name"] == new_name for k in project_keys.declared(project_id)):
        raise HTTPException(409, f"There is already a key called {new_name}.")
    project_keys.edit_owner_key(project_id, name, new_name, body.purpose.strip(), body.secret)
    project_keys.write_manifest(project_id)
    site_runner.previews.restart_if_running(project_id)
    return keys_info(project_id)


@app.get("/api/projects/{project_id}/keys")
def get_keys(project_id: str, session: Session = Depends(get_session)):
    get_project(session, project_id)
    return keys_info(project_id)


@app.put("/api/projects/{project_id}/keys")
def set_keys(project_id: str, body: KeyValues, session: Session = Depends(get_session)):
    get_project(session, project_id)
    declared = {k["name"] for k in project_keys.declared(project_id)}
    for name in body.values:
        if name not in declared:
            raise HTTPException(400, f"{name} isn't one of this website's keys. Add it first.")
    for name, value in body.values.items():
        if problem := project_keys.value_problem(name, value or ""):
            raise HTTPException(400, f"{name}: {problem}")
    project_keys.save_values(project_id, dict(body.values))
    project_keys.write_manifest(project_id)
    site_runner.previews.restart_if_running(project_id)  # the preview picks the new values up
    return keys_info(project_id)


@app.post("/api/projects/{project_id}/keys")
def add_key(project_id: str, body: NewKey, session: Session = Depends(get_session)):
    get_project(session, project_id)
    name = valid_key_name(body.name, body.secret)
    if any(k["name"] == name for k in project_keys.declared(project_id)):
        raise HTTPException(409, f"There is already a key called {name}.")
    project_keys.add_owner_key(project_id, name, body.purpose.strip(), body.secret)
    if body.value.strip():
        if problem := project_keys.value_problem(name, body.value):
            raise HTTPException(400, f"{name}: {problem}")
        project_keys.save_values(project_id, {name: body.value})
    project_keys.write_manifest(project_id)
    if body.value.strip():
        site_runner.previews.restart_if_running(project_id)
    return keys_info(project_id)


@app.delete("/api/projects/{project_id}/keys/{name}")
def remove_key(project_id: str, name: str, session: Session = Depends(get_session)):
    """Clears a key's value; a key the owner added is removed altogether (plan keys stay listed)."""
    get_project(session, project_id)
    project_keys.save_values(project_id, {name: None})
    project_keys.remove_owner_key(project_id, name)
    project_keys.write_manifest(project_id)
    site_runner.previews.restart_if_running(project_id)
    return keys_info(project_id)


class OwnerAccount(BaseModel):
    email: str
    name: str = ""
    password: str


class GoOnlineBody(BaseModel):
    owner: OwnerAccount | None = None


@app.get("/api/projects/{project_id}/deploy/first-login")
def first_login(project_id: str, session: Session = Depends(get_session)):
    """The live site's first login, for the owner's eyes (the Deployment panel shows it on request)."""
    get_project(session, project_id)
    login = project_keys.first_login(project_id)
    if not login:
        raise HTTPException(404, "Gagesite didn't make a login for this website")
    return {"email": login["email"], "password": login["password"]}


@app.post("/api/projects/{project_id}/deploy")
def go_online(project_id: str, body: GoOnlineBody, session: Session = Depends(get_session)):
    """Starts putting the website online; the owner's screen follows the steps in the artifact."""
    get_project(session, project_id)
    if get_stage_state(session, project_id, DEPLOY_STAGE).status == "locked":
        raise HTTPException(409, "Approve the website first")
    if active_run(session, project_id):
        raise HTTPException(409, "Wait for Gagesite to finish first")
    artifact = deploy_artifact(project_id)
    if artifact["deployment"]["status"] == "running":
        raise HTTPException(409, "Your website is already going online")
    if artifact["status"] != "ready":
        raise HTTPException(409, "Gagesite hasn't finished getting your website ready yet")
    if not session.get(GitHubConnection, project_id):
        raise HTTPException(409, "Save your code to GitHub first")
    if not session.get(VercelConnection, project_id):
        raise HTTPException(409, "Connect your Vercel account first")
    if artifact["has_database"] and not session.get(DatabaseConnection, project_id):
        raise HTTPException(409, "Connect the database your website will use first")
    missing = [s["label"] for s in artifact["settings"] if s["required"] and not s["filled"]]
    if missing:
        raise HTTPException(409, "Fill in: " + ", ".join(missing))
    broken = [f'{s["label"]}: {s["problem"]}' for s in artifact["settings"] if s.get("problem")]
    if broken:
        raise HTTPException(409, "Fix this setting first. " + " ".join(broken))
    owner = body.owner.model_dump() if body.owner else None
    if owner and owner.get("email", "").strip():
        owner["email"] = owner["email"].strip()
        if "@" not in owner["email"]:
            raise HTTPException(400, "Give a valid email for your login")
        if owner.get("password") and len(owner["password"]) < 8:
            raise HTTPException(400, "The password needs at least 8 characters")
    else:
        owner = None
    if artifact["first_account"] and not artifact["deployment"]["first_account_email"]:
        # Gagesite makes the first login (a strong password unless the owner chose one) and keeps it,
        # so it can show it in Deployment afterwards.
        owner = owner or {"email": artifact["first_login"]["email"], "name": "Owner", "password": ""}
        owner["password"] = owner.get("password") or project_keys.new_password()
        owner["name"] = owner.get("name") or "Owner"
        project_keys.save_first_login(project_id, owner)
    if not deploy_runner.start(project_id, owner):
        raise HTTPException(409, "Your website is already going online")
    return {"ok": True}


def paused_site(session: Session, project_id: str) -> tuple[Deployment, str]:
    """The live website's record and the owner's Vercel token, for taking it offline or back online."""
    get_project(session, project_id)
    require_not_deploying(session, project_id)
    row = session.get(Deployment, project_id)
    if not row or not row.vercel_project_id or row.status != "live":
        raise HTTPException(409, "Your website isn't online yet")
    connection = session.get(VercelConnection, project_id)
    if not connection:
        raise HTTPException(409, "Connect your Vercel account first: Gagesite needs it to do this")
    return row, secrets_store.decrypt(connection.encrypted_token)


@app.post("/api/projects/{project_id}/deploy/offline")
async def take_offline(project_id: str, session: Session = Depends(get_session)):
    """Pauses the website on Vercel: visitors see a "paused" page; code, data and address are kept."""
    row, token = paused_site(session, project_id)
    if not row.offline_at:
        try:
            await asyncio.to_thread(vercel.pause, token, row.vercel_project_id)
        except vercel.VercelError as exc:
            raise HTTPException(400, str(exc)) from None
        row.offline_at = utcnow()
        session.add(row)
        session.commit()
    return deploy_artifact(project_id)


@app.post("/api/projects/{project_id}/deploy/back-online")
async def back_online(project_id: str, session: Session = Depends(get_session)):
    """Puts a website taken offline back online, exactly as it was."""
    row, token = paused_site(session, project_id)
    if row.offline_at:
        try:
            await asyncio.to_thread(vercel.unpause, token, row.vercel_project_id)
        except vercel.VercelError as exc:
            raise HTTPException(400, str(exc)) from None
        row.offline_at = None
        session.add(row)
        session.commit()
    return deploy_artifact(project_id)


class ApiServerBody(BaseModel):
    target: str | None = None
    ssh_host: str | None = None
    ssh_port: int | None = None
    ssh_user: str | None = None
    port: int | None = None
    auto_update: bool | None = None


def require_api_service(session: Session, project_id: str) -> None:
    get_project(session, project_id)
    if get_stage_state(session, project_id, DEPLOY_STAGE).status == "locked":
        raise HTTPException(409, "Approve the website first")
    if not deploy_runner.service_setup(project_id):
        raise HTTPException(409, "This website has no API of its own")


@app.get("/api/projects/{project_id}/api-server")
def get_api_server(project_id: str, session: Session = Depends(get_session)):
    """The API on the owner's own server (Docker): where, how the last attempt went, whether it's up to date."""
    get_project(session, project_id)
    return api_server.view(project_id)


@app.put("/api/projects/{project_id}/api-server")
def save_api_server(project_id: str, body: ApiServerBody, session: Session = Depends(get_session)):
    require_api_service(session, project_id)
    if api_server.is_running(project_id):
        raise HTTPException(409, "Wait until your API has finished going online")
    row = session.get(ApiServer, project_id) or ApiServer(project_id=project_id)
    if body.target is not None:
        if body.target not in api_server.TARGETS:
            raise HTTPException(400, "Unknown place for your API")
        if body.target != row.target:
            if row.status == "live":
                raise HTTPException(409, "Stop your API where it runs now first, then move it")
            row.target, row.url, row.files_hash = body.target, None, None
            if body.port is None:
                row.port = api_server.DEFAULT_PORT[body.target]
    if body.port is not None:
        if not 1024 <= body.port <= 65535:
            raise HTTPException(400, "Pick a port between 1024 and 65535")
        if body.port != row.port and row.status == "live":
            raise HTTPException(409, "Stop your API first, then change its port")
        row.port = body.port
    if body.auto_update is not None:
        row.auto_update = body.auto_update
    if body.ssh_host is not None:
        if not re.fullmatch(r"[A-Za-z0-9.-]{1,253}", body.ssh_host.strip()):
            raise HTTPException(400, "Give the server's address, e.g. 203.0.113.10 or server.example.com")
        row.ssh_host = body.ssh_host.strip()
    if body.ssh_port is not None:
        if not 1 <= body.ssh_port <= 65535:
            raise HTTPException(400, "Give the server's SSH port, e.g. 22")
        row.ssh_port = body.ssh_port
    if body.ssh_user is not None:
        if not re.fullmatch(r"[a-z_][a-z0-9_-]{0,31}", body.ssh_user.strip()):
            raise HTTPException(400, "Give the server's user name, e.g. ubuntu")
        row.ssh_user = body.ssh_user.strip()
    session.add(row)
    session.commit()
    return api_server.view(project_id)


@app.post("/api/projects/{project_id}/api-server/ssh-key")
def api_server_ssh_key(project_id: str, session: Session = Depends(get_session)):
    """Gagesite's SSH key for the owner's server (made once): only the public half, to add on the server."""
    require_api_service(session, project_id)
    return {"public_key": api_server.ensure_ssh_key(project_id)}


@app.post("/api/projects/{project_id}/api-server/deploy")
def deploy_api_server(project_id: str, session: Session = Depends(get_session)):
    """Puts the API, as it is now, on the owner's server (only the API: the website is untouched)."""
    require_api_service(session, project_id)
    if active_run(session, project_id):
        raise HTTPException(409, "Wait for Gagesite to finish first")
    if not session.get(DatabaseConnection, project_id):
        raise HTTPException(409, "Connect your database in Stage 2 first: your API keeps its data there")
    if not session.get(ApiServer, project_id):
        session.add(ApiServer(project_id=project_id))
        session.commit()
    if not api_server.start(project_id, "owner"):
        raise HTTPException(409, "Your API is already going online")
    return api_server.view(project_id)


@app.post("/api/projects/{project_id}/api-server/stop")
async def stop_api_server(project_id: str, session: Session = Depends(get_session)):
    """Stops the API on the server. Its data stays in the database; Put online starts it again."""
    require_api_service(session, project_id)
    if api_server.is_running(project_id):
        raise HTTPException(409, "Wait until your API has finished going online")
    row = session.get(ApiServer, project_id)
    if not row:
        raise HTTPException(409, "Your API isn't on a server yet")
    await asyncio.to_thread(api_server.stop, project_id)
    row.status, row.error = "stopped", None
    session.add(row)
    session.commit()
    return api_server.view(project_id)


@app.get("/api/projects/{project_id}/download")
def download(project_id: str, session: Session = Depends(get_session)):
    project = get_project(session, project_id)
    if not workspace.has_code(project_id):
        raise HTTPException(409, "There is no website code to download yet")
    filename = "".join(c if c.isalnum() or c in "-_" else "-" for c in project.name) or project.id
    return Response(
        workspace.zip_code(project_id),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}.zip"'},
    )
