"""Stage 4 as an agent team: Advisor plans tasks, Developer builds one at a time, QA tests each.

See docs/plans/stage4-agent-team.md. The agents never move tasks themselves: each writes a
report file (the board, a developer report, a QA verdict) and this module reads it and moves
the task. Everything lives in the workspace (`docs/04-tasks.json`), so a restart can resume.

States: todo -> building -> built -> testing -> passed
                          ^                     |
                          +-- fixing <-- bug_found  (blocked after MAX_ATTEMPTS)
"""

import asyncio
import json
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from sqlmodel import Session

from . import api_server, site_runner, workspace
from .db import Message, Run, engine, utcnow
from .runner import RunHandle, RunResult, runs
from .stages import BUILD_ROLES, landing_stage

BOARD = "docs/04-tasks.json"
RUNS_DIR = "docs/04-runs"
QA_DIR = "docs/04-qa"
STAGE = "04-build"
MAX_ATTEMPTS = 3  # rounds of "bug found" on one task before it waits for the owner
MAX_FINAL_ROUNDS = 3  # final checks that may each turn up new bugs
FINAL = "FINAL"
OWNED = ("status", "attempts", "bugs", "history")  # the platform's fields; agents can't set them
ROLE_LABEL = {"advisor": "Advisor", "dev": "Developer", "api_dev": "API Developer", "qa": "QA"}
# "UI + dedicated API": two developers at once, each in a lane (the task's "lane"). Tasks with no
# lane (e.g. fixes from the final check) belong to the UI lane.
LANES = ("api", "ui")


class RunFailed(Exception):
    """An agent's run ended with an error (usage limit, crash...): pause, don't count an attempt."""


# ---------- the board ----------

def load_board(project_id: str) -> dict | None:
    raw = workspace.read_text(project_id, BOARD)
    if not raw:
        return None
    try:
        board = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return board if isinstance(board, dict) and isinstance(board.get("tasks"), list) else None


def save_board(project_id: str, board: dict) -> None:
    path = workspace.workspace_path(project_id) / BOARD
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(board, indent=2, ensure_ascii=False), encoding="utf-8")


def read_json(project_id: str, relative: str) -> dict | None:
    raw = workspace.read_text(project_id, relative)
    try:
        return json.loads(raw) if raw else None
    except json.JSONDecodeError:
        return None


def set_status(task: dict, status: str, note: str = "") -> None:
    if task.get("status") == status:
        return
    task.setdefault("history", []).append(
        {"at": utcnow().isoformat(), "from": task.get("status"), "to": status, **({"note": note} if note else {})}
    )
    task["status"] = status


def done_paths(project_id: str) -> set[str]:
    build = site_runner.read_build(project_id) or {}
    return {str(p.get("path")) for p in [*build.get("pages", []), *build.get("api", [])]
            if isinstance(p, dict) and p.get("status") == "done"}


def adopt_plan(project_id: str, before: dict | None) -> dict:
    """After an Advisor run: keep the platform's fields of known tasks, start new tasks fresh.

    A new task whose pages are all already done (work from before the team) goes straight to QA."""
    after = load_board(project_id) or {"version": 1, "tasks": []}
    known = {t["id"]: t for t in (before or {}).get("tasks", []) if isinstance(t, dict) and t.get("id")}
    finished = done_paths(project_id)
    tasks = []
    for task in after["tasks"]:
        if not isinstance(task, dict) or not task.get("id"):
            continue
        if task["id"] in known:
            old = known.pop(task["id"])
            for key in OWNED:
                if key in old:
                    task[key] = old[key]
                else:
                    task.pop(key, None)
        else:
            for key in OWNED:
                task.pop(key, None)
            task.update(status="todo", attempts=0, bugs=[], history=[])
            pages = task.get("pages") or []
            if pages and task.get("kind") not in ("change", "bug") and all(p in finished for p in pages):
                set_status(task, "built", "already built before the team started")
        tasks.append(task)
    tasks.extend(known.values())  # an Advisor can't delete tasks
    board = {**(before or {}), **{k: v for k, v in after.items() if k not in ("tasks", "job")}, "tasks": tasks}
    board.setdefault("version", 1)
    save_board(project_id, board)
    return board


def next_bug_id(board: dict) -> str:
    board["next_bug"] = int(board.get("next_bug", 0)) + 1
    return f"B{board['next_bug']:02d}"


def next_task_id(board: dict) -> str:
    numbers = [int(t["id"][1:]) for t in board["tasks"] if str(t.get("id", "")).startswith("T") and t["id"][1:].isdigit()]
    return f"T{(max(numbers) + 1) if numbers else 1:02d}"


def open_bugs(task: dict) -> list[dict]:
    return [b for b in task.get("bugs", []) if b.get("status") in ("open", "fixed", "cannot_reproduce")]


def lane_of(task: dict) -> str:
    return "api" if task.get("lane") == "api" else "ui"


def pick_next(board: dict, lane: str | None = None) -> dict | None:
    passed = {t["id"] for t in board["tasks"] if t.get("status") == "passed"}
    for task in board["tasks"]:
        if task.get("status") in ("passed", "blocked"):
            continue
        if lane and lane_of(task) != lane:
            continue
        if all(dep in passed for dep in task.get("depends_on", [])):
            return task
    return None


# ---------- the job (one per project, in memory; its state is mirrored in the board) ----------

@dataclass
class Job:
    project_id: str
    after_dev: Callable[[str, str], Awaitable[None]]
    state: str = "running"  # running | paused | blocked | done | failed
    message: str = ""
    current: dict = field(default_factory=dict)  # {"role": "dev", "task": "T03", "run_id": ...}
    lanes: dict = field(default_factory=dict)  # lane -> the agent working in it right now (two-lane builds)
    pause_requested: bool = False
    task: asyncio.Task | None = None


jobs: dict[str, Job] = {}


def is_running(project_id: str) -> bool:
    job = jobs.get(project_id)
    return bool(job and job.state == "running")


def info(project_id: str) -> dict | None:
    """What the panel shows: the tasks, where the job is, and why it stopped."""
    board = load_board(project_id)
    job = jobs.get(project_id)
    if board is None:
        if job and job.state == "running":  # the Advisor is still writing the first plan
            return {"state": "running", "message": "", "current": job.current, "tasks": [], "inbox": 0,
                    "max_attempts": MAX_ATTEMPTS}
        return None
    saved = board.get("job", {})
    state = job.state if job else saved.get("state", "paused")
    if state == "running" and not job:
        state = "paused"  # the platform restarted mid-build
    message = job.message if job else saved.get("message", "")
    if not job and saved.get("state") == "running":
        message = "Gagesite was restarted during the build. Press Resume to carry on where it stopped."
    tasks = [{
        "id": t.get("id"), "title": t.get("title", ""), "kind": t.get("kind", "page"), "pages": t.get("pages", []),
        "status": t.get("status", "todo"), "attempts": t.get("attempts", 0), "acceptance": t.get("acceptance", []),
        "lane": t.get("lane"),
        "bugs": [{k: b.get(k) for k in ("id", "title", "severity", "page", "steps", "expected", "actual", "status")}
                 for b in t.get("bugs", [])],
    } for t in board["tasks"] if isinstance(t, dict)]
    return {
        "state": state,
        "message": message,
        "current": (job.current if job and state == "running" else {}),
        # Two-lane builds: everyone at work right now (an API and a UI developer, or QA in a lane).
        "lanes": ([{"lane": lane, **agent} for lane, agent in job.lanes.items()] if job and state == "running" else []),
        "tasks": tasks,
        "inbox": len(board.get("inbox", [])),
        "max_attempts": MAX_ATTEMPTS,
    }


def remember(job: Job, board: dict, state: str | None = None, message: str | None = None) -> None:
    if state is not None:
        job.state = state
    if message is not None:
        job.message = message
    board["job"] = {"state": job.state, "message": job.message}
    save_board(job.project_id, board)


def start(project_id: str, after_dev: Callable[[str, str], Awaitable[None]], retry_blocked: bool = False) -> Job:
    if is_running(project_id):
        return jobs[project_id]
    board = load_board(project_id)
    if board and retry_blocked:
        for task in board["tasks"]:
            if task.get("status") == "blocked":
                task["attempts"] = 0
                set_status(task, "bug_found" if open_bugs(task) else "todo", "the owner asked to try again")
        save_board(project_id, board)
    job = Job(project_id=project_id, after_dev=after_dev)
    site_runner.previews.set_working(project_id, True)  # the preview shows each change while the team works
    job.task = asyncio.create_task(run_job(job))  # needs the running loop: call from async code
    jobs[project_id] = job
    return job


def pause(project_id: str) -> None:
    job = jobs.get(project_id)
    if job and job.state == "running":
        job.pause_requested = True
        job.message = "Pausing after the current step..."


def tell_owner_message(project_id: str, content: str) -> None:
    """The owner wrote while the team builds: the Advisor reads it before the next task."""
    board = load_board(project_id)
    if board is None:
        return
    board.setdefault("inbox", []).append(content)
    board["final_rounds"] = 0  # new work earns new final checks
    save_board(project_id, board)
    build = site_runner.read_build(project_id)
    if build and build.get("status") == "ready":  # not finished any more until the change passes
        build["status"] = "building"
        (workspace.workspace_path(project_id) / site_runner.BUILD_JSON).write_text(
            json.dumps(build, indent=2, ensure_ascii=False), encoding="utf-8")


# ---------- one agent run ----------

def label(role: str, task: dict | None, lane: str = "") -> str:
    name = "UI Developer" if role == "dev" and lane == "ui" else ROLE_LABEL[role]
    if not task:
        return f"**{name}**"
    return f"**{name} · {task.get('title') or task.get('id')}**"


async def run_role(job: Job, role: str, prompt: str, task: dict | None = None, task_id: str = "",
                   bug_ids: list[str] | None = None, resume_session: str | None = None, lane: str = "") -> RunResult:
    stage = BUILD_ROLES[role]
    if site_runner.read_setup(job.project_id).get("setup") == "landing":
        stage = landing_stage(stage)
    session_id = resume_session or str(uuid.uuid4())
    started = time.time()
    with Session(engine) as session:
        run = Run(project_id=job.project_id, stage_key=STAGE, session_id=session_id)
        session.add(run)
        session.commit()
        run_id = run.id
    workspace.refresh_platform_files(job.project_id)
    job.current = {"role": role, "task": task_id, "title": (task or {}).get("title", ""), "run_id": run_id}
    if lane:
        job.lanes[lane] = dict(job.current)
    done: asyncio.Future = asyncio.get_running_loop().create_future()

    async def on_finish(handle: RunHandle, result: RunResult) -> None:
        with Session(engine) as s:
            finished = s.get(Run, run_id)
            finished.status = "failed" if result.is_error else "succeeded"
            finished.error, finished.cost_usd, finished.finished_at = result.error, result.cost_usd, utcnow()
            s.add(finished)
            if result.assistant_text:
                s.add(Message(project_id=job.project_id, stage_key=STAGE, role="assistant",
                              content=f"{label(role, task, lane)}\n\n{result.assistant_text}", run_id=run_id,
                              # The label step names the task, so the chat can gather each task's runs together.
                              steps=json.dumps([{"t": "label", "text": label(role, task, lane), "task": task_id,
                                                 "role": role, "lane": lane}, *result.steps])
                              if result.steps else None))
            s.commit()
        if not done.done():
            done.set_result(result)

    runs.start(
        run_id=run_id,
        stage=stage,
        workspace=workspace.workspace_path(job.project_id),
        prompt=prompt,
        session_id=session_id,
        resume=resume_session is not None,
        on_finish=on_finish,
        extra_env={"GAGESITE_TASK": task_id, "GAGESITE_BUGS": ",".join(bug_ids or []),
                   "GAGESITE_RUN_STARTED": str(started)},
    )
    result: RunResult = await done
    if lane:
        job.lanes.pop(lane, None)
    if job.current.get("run_id") == run_id:  # the chat follows whoever is still at work
        job.current = next(iter(job.lanes.values()), {})
    if resume_session and result.session_id and result.session_id != resume_session:
        # The Advisor's conversation couldn't be picked up (e.g. another Claude account now) and went on
        # in a fresh one: remember that one. Its plan and the task board are on disk either way.
        saved = load_board(job.project_id)
        if saved is not None:
            saved["advisor_session"] = result.session_id
            save_board(job.project_id, saved)
    if result.is_error:
        raise RunFailed(result.error or "The run failed")
    return result


# ---------- prompts ----------

def task_brief(task: dict) -> str:
    keep = {k: task.get(k) for k in ("id", "title", "kind", "lane", "pages", "depends_on", "acceptance", "notes")
            if task.get(k)}
    return json.dumps(keep, indent=2, ensure_ascii=False)


def bug_lines(bugs: list[dict]) -> str:
    lines = []
    for bug in bugs:
        steps = " > ".join(bug.get("steps", []))
        lines.append(f"- {bug['id']} [{bug.get('severity', 'major')}] {bug.get('title', '')} (page {bug.get('page', '?')})\n"
                     f"  Steps: {steps}\n  Expected: {bug.get('expected', '')}\n  Actual: {bug.get('actual', '')}"
                     + (f"\n  Developer's note: {bug['dev_note']}" if bug.get("dev_note") else ""))
    return "\n".join(lines)


def dev_prompt(task: dict) -> str:
    bugs = [b for b in task.get("bugs", []) if b.get("status") == "open"]
    text = f"Your task is {task['id']}: {task.get('title', '')}\n\n{task_brief(task)}\n"
    if bugs:
        text += f"\nQA found these bugs in your task. Fix every one first:\n{bug_lines(bugs)}\n"
    text += f"\nWhen it is done, write your report docs/04-runs/{task['id']}.json."
    return text


def qa_prompt(task: dict) -> str:
    recheck = [b for b in task.get("bugs", []) if b.get("status") in ("fixed", "cannot_reproduce")]
    text = (f"Test task {task['id']}: {task.get('title', '')}\n\n{task_brief(task)}\n\n"
            f"The Developer's report is docs/04-runs/{task['id']}.json.\n")
    if recheck:
        text += f"\nThe Developer says these earlier bugs are fixed (or can't be reproduced). Re-check each:\n{bug_lines(recheck)}\n"
    text += f"\nWrite your verdict to docs/04-qa/{task['id']}.json."
    return text


FINAL_PROMPT = ("This is the FINAL check: every task has passed. Test the whole website: run the self-test (it builds "
                "and tests the finished production version) and check every page against the plan and the design. "
                "Write your verdict to docs/04-qa/FINAL.json.")


# ---------- the loop ----------

async def run_job(job: Job) -> None:
    pid = job.project_id
    board = load_board(pid)
    try:
        if board is None or not board.get("tasks"):
            result = await run_role(job, "advisor", "Plan the build: write docs/04-build.json and docs/04-tasks.json.")
            board = adopt_plan(pid, board)
            board["advisor_session"] = result.session_id
            if not board["tasks"]:
                remember(job, board, "failed", "The plan for the build could not be made. Try Start over.")
                return
        remember(job, board, "running", "")

        while True:
            if job.pause_requested:
                remember(job, board, "paused", "Paused. Press Resume to carry on.")
                return
            if board.get("inbox"):
                inbox, board["inbox"] = board["inbox"], []
                save_board(pid, board)
                prompt = "\n\n".join(f"The owner says: {text}" for text in inbox)
                result = await run_role(job, "advisor", prompt, resume_session=board.get("advisor_session"))
                board["advisor_session"] = result.session_id or board.get("advisor_session")
                board = adopt_plan(pid, board)
                continue

            task = pick_next(board)
            if task is None:
                if all(t.get("status") == "passed" for t in board["tasks"]):
                    if await final_check(job, board):
                        # All done: an API running on the owner's server gets the new version.
                        api_server.after_change(pid)
                        return
                    board = load_board(pid) or board
                    continue
                blocked = [t for t in board["tasks"] if t.get("status") == "blocked"]
                names = ", ".join(t.get("title", t["id"]) for t in blocked) or "some tasks"
                remember(job, board, "blocked",
                         f"Stuck on {names}: fixing failed {MAX_ATTEMPTS} times. Read the problems on the task, "
                         "then press Try again, or tell Gagesite what to change.")
                return
            if two_lanes(pid, board):
                await run_lanes(job, board)
            else:
                await work_on(job, board, task)
            save_board(pid, board)
    except RunFailed as exc:
        board = load_board(pid) or board or {"tasks": []}
        remember(job, board, "paused", friendly(str(exc)))
    except Exception as exc:  # a bug in the loop itself: stop safely, keep the board
        board = load_board(pid) or board or {"tasks": []}
        remember(job, board, "failed", f"The team build stopped unexpectedly ({exc.__class__.__name__}). Press Resume to try again.")
    finally:
        job.current = {}
        job.lanes = {}
        # Finished (or paused): a website marked ready is previewed as its production build.
        site_runner.previews.set_working(pid, False)


def two_lanes(project_id: str, board: dict) -> bool:
    """UI + dedicated API with a board planned in lanes: an API and a UI developer work at once."""
    return site_runner.read_setup(project_id).get("setup") == "api_service" and any(
        isinstance(t, dict) and t.get("lane") == "api" for t in board["tasks"])


async def run_lanes(job: Job, board: dict) -> None:
    """Both lanes at once, each doing its next ready task until none is left that it can start.
    Returns when both are idle, the owner pauses, or the owner wrote (the Advisor replans first).
    A lane waiting for the other lane's task (a UI page that needs its API) waits for it."""
    busy = {lane: False for lane in LANES}

    async def worker(lane: str) -> None:
        try:
            while not job.pause_requested and not board.get("inbox"):
                task = pick_next(board, lane)
                if task is None:
                    left = [t for t in board["tasks"] if lane_of(t) == lane and t.get("status") not in ("passed", "blocked")]
                    if left and any(busy[other] for other in LANES if other != lane):
                        await asyncio.sleep(2)  # its next task waits on the other lane's work
                        continue
                    return
                busy[lane] = True
                try:
                    await work_on(job, board, task, lane)
                finally:
                    busy[lane] = False
                save_board(job.project_id, board)
        except Exception:
            job.pause_requested = True  # the other lane stops after its current step
            raise

    results = await asyncio.gather(*(worker(lane) for lane in LANES), return_exceptions=True)
    for result in results:
        if isinstance(result, BaseException):
            raise result


def friendly(error: str) -> str:
    text = error.lower()
    if "stopped by the owner" in text:
        return "Stopped. Press Resume to carry on with the task it was on."
    if "max_turns" in text or "maximum number of turns" in text:
        return "A step took longer than allowed. Press Resume to carry on."
    if "usage limit" in text or "rate limit" in text or "overloaded" in text:
        return "Gagesite is busy right now. Press Resume in a few minutes."
    return "A step stopped before finishing. Press Resume to carry on."


async def work_on(job: Job, board: dict, task: dict, lane: str = "") -> None:
    """One round on a task: build or fix it, then test it. In a two-lane build, `lane` says whose."""
    pid = job.project_id
    developer = "api_dev" if lane == "api" else "dev"
    if task.get("status") in ("todo", "bug_found", "building", "fixing"):
        set_status(task, "fixing" if task.get("status") in ("bug_found", "fixing") else "building")
        save_board(pid, board)
        bug_ids = [b["id"] for b in task.get("bugs", []) if b.get("status") == "open"]
        await run_role(job, developer, dev_prompt(task), task, task["id"], bug_ids, lane=lane)
        report = read_json(pid, f"{RUNS_DIR}/{task['id']}.json") or {}
        answers = {str(b.get("id")): b for b in report.get("bugs", []) if isinstance(b, dict)}
        for bug in task.get("bugs", []):
            answer = answers.get(bug["id"])
            if bug.get("status") == "open" and answer and answer.get("result") in ("fixed", "cannot_reproduce"):
                bug["status"] = answer["result"]
                bug["dev_note"] = str(answer.get("note", ""))[:500]
        set_status(task, "built")
        save_board(pid, board)
        asyncio.create_task(job.after_dev(pid, f"Gagesite: {task.get('title', task['id'])}"))
        if job.pause_requested:
            return

    set_status(task, "testing")
    save_board(pid, board)
    await run_role(job, "qa", qa_prompt(task), task, task["id"], lane=lane)
    verdict = read_json(pid, f"{QA_DIR}/{task['id']}.json") or {}
    if verdict.get("verdict") == "passed":
        for bug in task.get("bugs", []):
            if bug.get("status") in ("fixed", "cannot_reproduce"):
                bug["status"] = "verified"
        set_status(task, "passed")
        return
    # Anything but a clean "passed" (including a missing verdict) sends the task back.
    for bug in task.get("bugs", []):
        if bug.get("status") in ("fixed", "cannot_reproduce"):
            bug["status"] = "verified"  # QA re-checked; anything still wrong is reported again below
    new = verdict.get("bugs") or [{"title": "QA could not finish its check", "severity": "major", "page": "",
                                   "steps": ["See the QA notes"], "expected": "A clear verdict",
                                   "actual": "No verdict was written"}]
    for bug in new:
        task.setdefault("bugs", []).append({
            "id": next_bug_id(board), "found_by": "qa", "status": "open",
            **{k: bug.get(k) for k in ("title", "severity", "page", "steps", "expected", "actual")},
        })
    task["attempts"] = int(task.get("attempts", 0)) + 1
    if task["attempts"] >= MAX_ATTEMPTS:
        set_status(task, "blocked", f"{MAX_ATTEMPTS} rounds of bugs")
    else:
        set_status(task, "bug_found")


async def final_check(job: Job, board: dict) -> bool:
    """Every task passed: test the whole site. True when the build is finished."""
    pid = job.project_id
    rounds = int(board.get("final_rounds", 0)) + 1
    board["final_rounds"] = rounds
    save_board(pid, board)
    await run_role(job, "qa", FINAL_PROMPT, None, FINAL)
    verdict = read_json(pid, f"{QA_DIR}/{FINAL}.json") or {}
    if verdict.get("verdict") == "passed":
        # "UI + dedicated API": the owner can also try the API on its own, so the summary says where.
        port_file = workspace.workspace_path(pid) / site_runner.SERVICE_PORT_FILE
        api_note = ""
        if port_file.exists():
            api = f"http://localhost:{port_file.read_text().strip()}"
            api_note = (f" The website has its own API, running at {api} while the preview runs: add a short "
                        f"\"Try the API\" part with that address, its interactive docs at {api}/docs (sign in "
                        "there with a test account, then try the main addresses), and the main addresses by "
                        "area. Say it in your reply too.")
        summary = await run_role(job, "advisor",
                                 "Every task passed and the final test is clean. Write docs/04-build.md: the plain-"
                                 "language summary for the owner (what was built, how to try it, the test accounts)."
                                 f"{api_note} Change nothing else.",
                                 resume_session=board.get("advisor_session"))
        board["advisor_session"] = summary.session_id or board.get("advisor_session")
        build = site_runner.read_build(pid) or {}
        build["status"] = "ready"
        (workspace.workspace_path(pid) / site_runner.BUILD_JSON).write_text(
            json.dumps(build, indent=2, ensure_ascii=False), encoding="utf-8")
        remember(job, board, "done", "Every task passed the tests, and the final check of the whole website is clean.")
        return True
    if rounds >= MAX_FINAL_ROUNDS:
        remember(job, board, "blocked", "The final check keeps finding problems. Read them on the board, then press Try again.")
        return True
    listed = {str(p.get("path")) for p in (site_runner.read_build(pid) or {}).get("pages", []) if isinstance(p, dict)}
    for bug in verdict.get("bugs") or []:
        page = str(bug.get("page") or "")
        board["tasks"].append({
            "id": next_task_id(board), "title": f"Fix: {bug.get('title', 'problem found in the final check')}",
            "kind": "bug", "pages": [page] if page in listed else [], "depends_on": [],
            "acceptance": [str(bug.get("expected") or "The problem no longer happens")],
            "status": "bug_found", "attempts": 0, "history": [],
            "bugs": [{"id": next_bug_id(board), "found_by": "final", "status": "open",
                      **{k: bug.get(k) for k in ("title", "severity", "page", "steps", "expected", "actual")}}],
        })
    save_board(pid, board)
    return False
