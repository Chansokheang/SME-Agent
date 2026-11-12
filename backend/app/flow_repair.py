"""Gagesite's Flow repair agent: when a Flow step fails after the clip was made (Flow changed
its page), an agent looks at the project, rescues the clip with a path of clicks, and the path
it found is kept (data/flow-learned.json) and reused by the worker from then on.

The agent is a `claude -p` run in its own folder (data/flow-rescue/<job>/) with three tools:
Read, Write, and two fixed commands (flow_tool.py's `look` and `try`). The tool refuses
anything that spends credits or changes the account, so the agent can only fetch what exists.
"""

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import claude_accounts, flow_steps
from .config import settings
from .runner import NESTED_SESSION_VARS, claude_binary

RESCUE_DIR = settings.data_dir / "flow-rescue"
LEARNED = settings.data_dir / "flow-learned.json"
RULES = settings.pipeline_dir / "agents" / "flow-repair.md"
TOOL = Path(__file__).resolve().parent / "flow_tool.py"
TIMEOUT = 15 * 60


def _learned() -> dict:
    try:
        return json.loads(LEARNED.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def try_learned_path(page, tile) -> bytes | None:
    """The download path the repair agent found last time, on this clip's tile."""
    path = _learned().get("download_path")
    if not path:
        return None
    try:
        # "@tile:N:<name>" steps act on this clip's own tile, whatever its number.
        for step in path[:-1]:
            _click(page, tile, step)
        with page.expect_download(timeout=60_000) as info:
            _click(page, tile, path[-1])
        data = Path(info.value.path()).read_bytes()
        return data if len(data) > 20_000 and not info.value.suggested_filename.lower().endswith(".zip") else None
    except Exception:
        return None


def _click(page, tile, step: str) -> None:
    if step.startswith("@tile:"):
        name = step.split(":", 2)[2]
        tile.hover()
        page.wait_for_timeout(1200)
        box = tile.bounding_box()
        buttons = page.get_by_role("button", name=name, exact=True)
        for i in range(buttons.count()):
            b = buttons.nth(i).bounding_box()
            if b and box and box["x"] <= b["x"] + b["width"] / 2 <= box["x"] + box["width"] \
                    and box["y"] <= b["y"] + b["height"] / 2 <= box["y"] + box["height"]:
                buttons.nth(i).click()
                page.wait_for_timeout(1000)
                return
        raise RuntimeError(f"no '{name}' on the tile")
    target = flow_steps._first_visible(
        page.get_by_role("menuitem", name=step).or_(page.get_by_role("button", name=step, exact=True))
        .or_(page.get_by_role("menuitem").filter(has_text=step)), 8)
    if target is None:
        raise RuntimeError(f"no '{step}'")
    target.click()
    page.wait_for_timeout(1000)


def _folder(job) -> Path:
    folder = RESCUE_DIR / job.id
    shutil.rmtree(folder, ignore_errors=True)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "job.json").write_text(json.dumps({
        "prompt": job.prompt, "aspect": job.aspect, "seconds": job.seconds,
        "failed_step": job.step, "error": job.error, "flow_project": job.flow_project,
    }, indent=2, ensure_ascii=False), encoding="utf-8")
    shot = settings.data_dir / "flow-debug" / f"{job.id}-failed.png"
    if shot.exists():
        shutil.copy2(shot, folder / "failed.png")
    # A small Node launcher runs the tool (Windows' shell breaks quoted paths with spaces in npm scripts).
    (folder / "tool.json").write_text(json.dumps({"python": sys.executable, "tool": str(TOOL)}), encoding="utf-8")
    (folder / "flow.cjs").write_text(
        'const { spawnSync } = require("child_process");\n'
        'const cfg = require("./tool.json");\n'
        'const done = spawnSync(cfg.python, [cfg.tool, ...process.argv.slice(2)], { stdio: "inherit" });\n'
        'process.exit(done.status ?? 1);\n', encoding="utf-8")
    (folder / "package.json").write_text(json.dumps({
        "name": "flow-rescue", "private": True,
        "scripts": {"flow-look": "node flow.cjs look", "flow-try": "node flow.cjs try"},
    }, indent=2), encoding="utf-8")
    return folder


def repair(job) -> None:
    """Runs the repair agent for a failed job; on success the clip is saved and the job is done."""
    from . import flow_video

    if not RULES.exists() or job.repaired:
        return
    job.repaired = True
    original_error = job.error
    job.status, job.step, job.error = "repairing", "Flow's page changed: Gagesite's repair agent is fetching your clip", ""
    folder = _folder(job)
    env = {k: v for k, v in os.environ.items() if k not in NESTED_SESSION_VARS}
    claude_accounts.run_env(env)
    command = [
        claude_binary(), "-p",
        "Rescue the clip described in job.json, following your instructions. Write rescue.json at the end.",
        "--output-format", "json",
        "--setting-sources", "project", "--strict-mcp-config",
        "--append-system-prompt-file", str(RULES),
        "--model", "sonnet", "--max-turns", "40",
        "--permission-mode", "acceptEdits",
        "--allowedTools", "Read", "Write", "Bash(npm run flow-look)", "Bash(npm run flow-try:*)",
        "--disallowedTools", "Edit,WebFetch,WebSearch,Task,PowerShell",
    ]
    try:
        subprocess.run(command, cwd=folder, env=env, capture_output=True, timeout=TIMEOUT,
                       stdin=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError):
        pass
    try:
        result = json.loads((folder / "rescue.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        result = {}
    clip = folder / "clip.raw"
    if clip.exists() and clip.stat().st_size > 20_000:
        job.step = "Preparing the video for the web"
        flow_video.save_clip(job, clip.read_bytes())
        job.status, job.step, job.error = "done", "Your video is in (fetched by the repair agent)", ""
        if result.get("recovered") and result.get("path"):
            LEARNED.write_text(json.dumps({
                "download_path": result["path"], "what_changed": result.get("what_changed", ""),
                "fix_for_developers": result.get("fix_for_developers", ""), "job": job.id,
                "learned_at": datetime.now(timezone.utc).isoformat(),
            }, indent=2, ensure_ascii=False), encoding="utf-8")
    else:
        job.status = "failed"
        seen = result.get("what_changed") or ""
        job.error = (f"{original_error} The repair agent couldn't fetch it either{': ' + seen if seen else '.'} "
                     "The clip is in your Google Flow library; you can download it there and upload it here.")
