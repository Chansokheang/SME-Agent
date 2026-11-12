"""Runs `claude -p` for a stage and turns its stream-json output into events for the browser.

The CLI runs in a worker thread with a plain subprocess (asyncio subprocesses are not
available under every event loop on Windows). Each line it prints is normalized and
published to an in-memory RunHandle; SSE clients subscribe to that handle and get the
full history replayed, so a page refresh mid-run picks up where it left off.
"""

import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path

from .config import settings
from .stages import Stage

# Env vars that make the CLI think it's nested inside another Claude Code session.
NESTED_SESSION_VARS = ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_SSE_PORT")

# A resumed conversation that can't be continued: its file is gone, or the account now in use won't
# accept it (e.g. signed thinking from another account). The run then carries on in a fresh one.
RESUME_LOST = ("no conversation found", "signature", "thinking block", "session not found")
RECAP_INTRO = (
    "<conversation-restarted>\nThis conversation's earlier history could not be loaded (for example, the owner "
    "switched Claude accounts), so it continues in a fresh one. Everything decided so far is in the project's "
    "files: read them before you answer, and carry on as if nothing happened. Do not mention this to the owner.\n"
    "</conversation-restarted>"
)


def resume_lost(error: str | None) -> bool:
    text = (error or "").lower()
    return any(marker in text for marker in RESUME_LOST)


def claude_binary() -> str:
    binary = settings.claude_bin or shutil.which("claude")
    if not binary:
        raise RuntimeError("claude CLI not found. Install Claude Code or set CLAUDE_BIN.")
    return binary


@dataclass
class RunResult:
    session_id: str | None = None
    assistant_text: str = ""
    # The reply's text blocks and tool calls in order: {t: "text", text} | {t: "tool", name, summary}.
    steps: list[dict] = field(default_factory=list)
    is_error: bool = False
    error: str | None = None
    cost_usd: float | None = None


@dataclass
class RunHandle:
    run_id: str
    events: list[dict] = field(default_factory=list)
    subscribers: set[asyncio.Queue] = field(default_factory=set)
    finished: bool = False
    process: subprocess.Popen | None = None
    stopped: bool = False  # the owner pressed Stop

    def publish(self, event: dict) -> None:
        self.events.append(event)
        for queue in self.subscribers:
            queue.put_nowait(event)

    def finish(self) -> None:
        self.finished = True
        for queue in self.subscribers:
            queue.put_nowait(None)

    async def subscribe(self) -> AsyncIterator[dict]:
        queue: asyncio.Queue = asyncio.Queue()
        for event in self.events:
            queue.put_nowait(event)
        if self.finished:
            queue.put_nowait(None)
        else:
            self.subscribers.add(queue)
        try:
            while (event := await queue.get()) is not None:
                yield event
        finally:
            self.subscribers.discard(queue)


def stage_prompt_file(stage: Stage) -> Path:
    """Joins the stage's prompt files into one file for --append-system-prompt-file."""
    folder = settings.pipeline_dir / "stages" / stage.key
    name = "-".join(part for part in (stage.key, stage.role, stage.variant) if part)
    combined = settings.data_dir / "prompts" / f"{name}.md"
    combined.parent.mkdir(parents=True, exist_ok=True)
    combined.write_text(
        "\n\n".join((folder / name).read_text(encoding="utf-8") for name in stage.prompt_files),
        encoding="utf-8",
    )
    return combined


def build_command(stage: Stage, session_id: str, resume: bool) -> list[str]:
    command = [
        claude_binary(),
        "-p",
        "--output-format", "stream-json",
        "--verbose",
        "--include-partial-messages",
        # Only the workspace's own settings (its Stop hook), not the host user's plugins/hooks.
        "--setting-sources", "project",
        "--strict-mcp-config",
        # Only the servers Gagesite gives this stage (none for most).
        *(["--mcp-config", stage.mcp_config] if stage.mcp_config else []),
        "--append-system-prompt-file", str(stage_prompt_file(stage)),
        "--model", stage.model,
        "--max-turns", str(stage.max_turns),
        "--permission-mode", "acceptEdits",
        # One argument per tool: the CLI also splits on spaces, which would break "Bash(npm run site:*)".
        "--allowedTools", *stage.allowed_tools,
        # Per stage: most only read and write files (no shell, no web, no sub-agents).
        "--disallowedTools", ",".join(stage.disallowed_tools),
    ]
    command += ["--resume", session_id] if resume else ["--session-id", session_id]
    return command


def tool_summary(name: str, tool_input: dict) -> str:
    target = (tool_input.get("file_path") or tool_input.get("pattern") or tool_input.get("command")
              or tool_input.get("query") or tool_input.get("url") or "")
    return f"{name} {Path(target).name if 'file_path' in tool_input else target}".strip()


def normalize(raw: dict, result: RunResult) -> list[dict]:
    """Map one stream-json line to zero or more UI events, collecting the final result as we go."""
    kind = raw.get("type")
    if kind == "system" and raw.get("subtype") == "init":
        result.session_id = raw.get("session_id")
        return [{"type": "init", "session_id": raw.get("session_id"), "model": raw.get("model")}]
    if kind == "stream_event":
        event = raw.get("event", {})
        if event.get("type") == "message_start":
            return [{"type": "message_start"}]
        delta = event.get("delta", {})
        if event.get("type") == "content_block_delta" and delta.get("type") == "text_delta":
            return [{"type": "text_delta", "text": delta.get("text", "")}]
        return []
    if kind == "assistant":
        events = []
        for block in raw.get("message", {}).get("content", []):
            if block.get("type") == "text" and block.get("text", "").strip():
                result.assistant_text += ("\n\n" if result.assistant_text else "") + block["text"].strip()
                result.steps.append({"t": "text", "text": block["text"].strip()})
            elif block.get("type") == "tool_use":
                summary = tool_summary(block.get("name", ""), block.get("input", {}))
                result.steps.append({"t": "tool", "name": block.get("name"), "summary": summary})
                events.append({"type": "tool_use", "name": block.get("name"), "summary": summary})
        return events
    if kind == "result":
        result.is_error = bool(raw.get("is_error"))
        result.cost_usd = raw.get("total_cost_usd")
        if result.is_error:
            # "errors" holds the actual reason (e.g. "No conversation found..."); "subtype" is only its kind.
            errors = [str(e) for e in raw.get("errors") or [] if e]
            result.error = "; ".join(errors) or raw.get("result") or raw.get("subtype")
        return [{
            "type": "result",
            "is_error": result.is_error,
            "cost_usd": result.cost_usd,
            "duration_ms": raw.get("duration_ms"),
            "num_turns": raw.get("num_turns"),
        }]
    return []


class RunManager:
    def __init__(self) -> None:
        self.handles: dict[str, RunHandle] = {}
        self._slots = asyncio.Semaphore(settings.max_concurrent_runs)

    def get(self, run_id: str) -> RunHandle | None:
        return self.handles.get(run_id)

    def stop(self, run_id: str) -> bool:
        """End a run now: the CLI and everything it started (npm, the self-test...)."""
        handle = self.handles.get(run_id)
        if not handle or handle.finished:
            return False
        handle.stopped = True
        process = handle.process
        if process and process.poll() is None:
            if sys.platform == "win32":
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True)
            else:
                process.kill()
        return True

    def start(
        self,
        run_id: str,
        stage: Stage,
        workspace: Path,
        prompt: str,
        session_id: str,
        resume: bool,
        on_finish: Callable[[RunHandle, RunResult], Awaitable[None]],
        extra_env: dict[str, str] | None = None,
        recap_for: Callable[[], str] | None = None,
        pre: list[tuple[Stage, Path, str, Callable[[RunResult], None]]] | None = None,
    ) -> RunHandle:
        """`recap_for` gives the earlier conversation in plain text, for when a resumed conversation
        can't be loaded and the run carries on in a fresh one (result.session_id is then the new one).
        `pre` are steps run first in the same slot and the same live view, each (stage, folder, prompt,
        after): e.g. the design research before UI Design. Their failure never stops the main run."""
        handle = RunHandle(run_id)
        self.handles[run_id] = handle
        asyncio.create_task(
            self._run(handle, stage, workspace, prompt, session_id, resume, on_finish, extra_env or {}, recap_for,
                      pre or [])
        )
        return handle

    async def _run(self, handle, stage, workspace, prompt, session_id, resume, on_finish, extra_env, recap_for=None,
                   pre=()) -> None:
        loop = asyncio.get_running_loop()
        result = RunResult(session_id=session_id)
        if self._slots.locked():
            handle.publish({"type": "queued"})
        # Wait for a free slot, but let Stop end a run that is still waiting.
        acquired = False
        while not handle.stopped:
            try:
                await asyncio.wait_for(self._slots.acquire(), timeout=1)
                acquired = True
                break
            except asyncio.TimeoutError:
                continue
        if not acquired:
            result.is_error, result.error = True, "Stopped by the owner"
        else:
            try:
                handle.publish({"type": "started"})
                for pre_stage, pre_folder, pre_prompt, after in pre:
                    if handle.stopped:
                        break
                    pre_result = RunResult(session_id=str(uuid.uuid4()))
                    try:
                        await asyncio.to_thread(
                            self._execute, loop, handle, pre_stage, pre_folder, pre_prompt, pre_result.session_id,
                            False, pre_result, {},
                        )
                    except Exception as exc:
                        pre_result.is_error, pre_result.error = True, str(exc)
                    try:
                        after(pre_result)
                    except Exception:
                        pass
                    handle.publish({"type": "message_start"})  # the main run's words start fresh
                await asyncio.to_thread(
                    self._execute, loop, handle, stage, workspace, prompt, session_id, resume, result, extra_env
                )
                if resume and result.is_error and not handle.stopped and resume_lost(result.error):
                    # The conversation couldn't be picked up (e.g. another Claude account is in use now and
                    # it won't continue this one). Start a fresh conversation once, with a recap of what was
                    # said: the work itself (plan, board, website) lives in the project's files anyway.
                    recap = recap_for() if recap_for else ""
                    result = RunResult(session_id=str(uuid.uuid4()))
                    retry_prompt = RECAP_INTRO + (f"\n\n<earlier-conversation>\n{recap}\n</earlier-conversation>" if recap else "") \
                        + "\n\n" + prompt
                    await asyncio.to_thread(
                        self._execute, loop, handle, stage, workspace, retry_prompt, result.session_id, False, result,
                        extra_env,
                    )
            except Exception as exc:  # spawn failures, missing CLI, etc.
                result.is_error, result.error = True, str(exc)
            finally:
                self._slots.release()
        try:
            await on_finish(handle, result)
        finally:
            handle.publish({"type": "done", "status": "failed" if result.is_error else "succeeded"})
            handle.finish()

    @staticmethod
    def _use_account(run_id: str, env: dict[str, str]) -> None:
        """Run on the Claude account the owner picked, and note it on the run."""
        from sqlmodel import Session

        from . import claude_accounts
        from .db import Run, engine

        label = claude_accounts.run_env(env)
        try:
            with Session(engine) as session:
                run = session.get(Run, run_id)
                if run:
                    run.account = label
                    session.add(run)
                    session.commit()
        except Exception:
            pass  # noting it is best effort; the run itself goes ahead

    def _execute(self, loop, handle, stage, workspace, prompt, session_id, resume, result, extra_env) -> None:
        env = {k: v for k, v in os.environ.items() if k not in NESTED_SESSION_VARS}
        env["PIPELINE_STAGE"] = stage.key
        env.pop("GAGESITE_ROLE", None)
        if stage.role:
            env["GAGESITE_ROLE"] = stage.role  # the end-of-turn check checks this role's work
        env.update(extra_env)
        env["GAGESITE_PYTHON"] = sys.executable  # has the browser the website self-test needs
        self._use_account(handle.run_id, env)
        # stderr goes to a temp file so a chatty stderr can never fill its pipe and stall stdout.
        stderr_file = tempfile.TemporaryFile(mode="w+", encoding="utf-8", errors="replace")
        process = subprocess.Popen(
            build_command(stage, session_id, resume),
            cwd=workspace,
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=stderr_file,
            encoding="utf-8",
            errors="replace",
        )
        handle.process = process
        if handle.stopped:  # Stop pressed while the run was still waiting for a slot
            process.kill()
        # The prompt goes in on stdin, which avoids command-line quoting and length limits.
        try:
            process.stdin.write(prompt)
            process.stdin.close()
        except OSError:
            pass

        for line in process.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                raw = json.loads(line)
            except json.JSONDecodeError:
                continue
            for event in normalize(raw, result):
                loop.call_soon_threadsafe(handle.publish, event)

        process.wait()
        handle.process = None
        if handle.stopped:
            result.is_error, result.error = True, "Stopped by the owner"
        stderr_file.seek(0)
        stderr = stderr_file.read()
        stderr_file.close()
        if process.returncode != 0 and not result.is_error:
            result.is_error = True
            result.error = stderr.strip()[-2000:] or f"claude exited with code {process.returncode}"


runs = RunManager()
