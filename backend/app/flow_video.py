"""Google Flow, driven in the background: makes a landing page's hero video with the Gagesite
owner's own Flow account and credits (Flow has no API).

- Gagesite keeps its own Chrome profile in data/flow-browser/. The owner signs in to Google ONCE
  in a normal Chrome window Gagesite opens on that profile (`open_sign_in`): Gagesite never sees
  or types the password, and nothing is automated while they sign in.
- Afterwards a single worker thread takes one video request at a time: it opens Flow with that
  profile (Playwright, no window), types the prompt, starts the generation, waits for the clip,
  and saves it where the website serves it (site/public/media/hero.mp4).
- One request = one generation, only when the owner presses the button, so credits are never
  spent unasked.

Flow is a web app that changes its page from time to time: when a step can't find what it
expects, the job fails with a plain message and a screenshot in data/flow-debug/, and the
manual upload keeps working.
"""

import json
import os
import re
import shutil
import subprocess
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from . import flow_repair, flow_steps
from .config import settings

FLOW_URL = "https://flow.google.com/"
PROFILE_DIR = settings.data_dir / "flow-browser"
STATE_FILE = settings.data_dir / "flow.json"
DEBUG_DIR = settings.data_dir / "flow-debug"
# Generating a clip took about 8 minutes in the first test; give it room before calling it failed.
GENERATE_TIMEOUT = 20 * 60
ASPECTS = ("16:9", "9:16")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def chrome_path() -> str | None:
    """The installed Google Chrome (Flow and Google's sign-in work best in real Chrome)."""
    candidates = [
        os.environ.get("CHROME_PATH", ""),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
    ]
    for path in candidates:
        if path and Path(path).exists():
            return path
    return shutil.which("google-chrome") or shutil.which("chrome")


def _load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save_state(**changes) -> dict:
    state = {**_load_state(), **changes}
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")
    return state


@dataclass
class Job:
    project_id: str
    prompt: str
    aspect: str = "16:9"
    seconds: int = 8
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    status: str = "queued"  # queued | running | repairing | done | failed
    step: str = "Waiting for its turn"
    error: str = ""
    file: str = ""
    created_at: str = field(default_factory=_now)
    finished_at: str = ""
    # The Flow project the clip was made in (for the repair agent), and whether the generation
    # was sent (only then is there a clip to rescue).
    flow_project: str = ""
    generated: bool = False
    repaired: bool = False


class FlowWorker:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.jobs: list[Job] = []
        self.thread: threading.Thread | None = None
        self.sign_in_window: subprocess.Popen | None = None

    # ---------- signing in (the owner, by hand, in a normal Chrome window) ----------

    def signing_in(self) -> bool:
        return self.sign_in_window is not None and self.sign_in_window.poll() is None

    def open_sign_in(self) -> None:
        chrome = chrome_path()
        if not chrome:
            raise FlowError("Google Chrome isn't installed on this computer. Install it, then try again.")
        if self.busy():
            raise FlowError("A video is being made right now. Sign in again after it finishes.")
        if self.signing_in():
            return
        PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        self.sign_in_window = subprocess.Popen(
            [chrome, f"--user-data-dir={PROFILE_DIR}", "--no-first-run", "--no-default-browser-check",
             "--new-window", FLOW_URL],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        _save_state(sign_in_opened_at=_now())

    def status(self) -> dict:
        state = _load_state()
        return {
            "chrome_found": chrome_path() is not None,
            "signing_in": self.signing_in(),
            "signed_in": bool(state.get("signed_in")),
            "checked_at": state.get("checked_at"),
            "busy": self.busy(),
        }

    def check(self) -> dict:
        """Opens Flow in the background and sees whether the profile is signed in."""
        if self.signing_in():
            raise FlowError("Close the Google Flow sign-in window first, then check again.")
        if self.busy():
            return self.status()
        with self.lock:
            with _flow_browser() as page:
                signed_in = _signed_in(page)
        _save_state(signed_in=signed_in, checked_at=_now())
        return self.status()

    # ---------- making videos ----------

    def busy(self) -> bool:
        return any(j.status in ("queued", "running", "repairing") for j in self.jobs)

    def submit(self, project_id: str, prompt: str, aspect: str, target: Path, seconds: int = 8) -> Job:
        if aspect not in ASPECTS:
            raise FlowError("The video shape must be 16:9 or 9:16.")
        prompt = prompt.strip()
        if not prompt:
            raise FlowError("Write what the video should show first.")
        if self.signing_in():
            raise FlowError("Close the Google Flow sign-in window first.")
        if not _load_state().get("signed_in"):
            raise FlowError("Sign in to Google Flow first.")
        if any(j.project_id == project_id and j.status in ("queued", "running", "repairing") for j in self.jobs):
            raise FlowError("A video for this website is already being made.")
        job = Job(project_id=project_id, prompt=prompt[:2000], aspect=aspect, seconds=min(10, max(6, seconds)))
        job.file = str(target)
        self.jobs.append(job)
        self.jobs = self.jobs[-50:]
        if not self.thread or not self.thread.is_alive():
            self.thread = threading.Thread(target=self._run, name="flow-video", daemon=True)
            self.thread.start()
        return job

    def project_jobs(self, project_id: str) -> list[dict]:
        return [_job_view(j) for j in self.jobs if j.project_id == project_id][-5:]

    def _run(self) -> None:
        while True:
            job = next((j for j in self.jobs if j.status == "queued"), None)
            if not job:
                return
            job.status, job.step = "running", "Opening Google Flow"
            try:
                with self.lock:
                    with _flow_browser() as page:
                        _make_video(page, job)
                job.status, job.step = "done", "Your video is in"
            except FlowError as exc:
                job.status, job.error = "failed", str(exc)
            except flow_steps.StepError as exc:
                job.status, job.error = "failed", f"{exc} The manual upload still works."
                if job.generated and job.flow_project:
                    # Flow made the clip but its page has changed: the repair agent rescues it.
                    flow_repair.repair(job)
            except Exception as exc:  # Playwright's own errors: keep the message short
                job.status, job.error = "failed", f"Google Flow didn't respond as expected ({str(exc).splitlines()[0][:160]})."
            job.finished_at = _now()


class FlowError(Exception):
    pass


class _flow_browser:
    """Flow in the background, with Gagesite's own signed-in Chrome profile."""

    def __enter__(self):
        from playwright.sync_api import sync_playwright

        if not PROFILE_DIR.exists():
            raise FlowError("Sign in to Google Flow first.")
        self._pw = sync_playwright().start()
        chrome = chrome_path()
        try:
            self._context = self._pw.chromium.launch_persistent_context(
                str(PROFILE_DIR),
                executable_path=chrome or None,
                headless=os.environ.get("FLOW_SHOW_BROWSER") != "1",
                accept_downloads=True,
                viewport={"width": 1440, "height": 900},
            )
        except Exception as exc:
            self._pw.stop()
            if "user data directory is already in use" in str(exc).lower() or "ProcessSingleton" in str(exc):
                raise FlowError("The Google Flow sign-in window is still open. Close it, then try again.") from None
            raise
        page = self._context.pages[0] if self._context.pages else self._context.new_page()
        page.set_default_timeout(30_000)
        return page

    def __exit__(self, *exc) -> None:
        try:
            self._context.close()
        finally:
            self._pw.stop()


def _job_view(job: Job) -> dict:
    view = asdict(job)
    view.pop("file", None)
    return view


def _debug_shot(page, job: Job, name: str) -> None:
    try:
        DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(DEBUG_DIR / f"{job.id}-{name}.png"))
    except Exception:
        pass


def _signed_in(page) -> bool:
    page.goto(FLOW_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    if "accounts.google.com" in page.url:
        return False
    # Signed in, Flow shows the Google account button in its top bar.
    return page.get_by_role("button", name=re.compile(r"^Google Account:")).count() > 0


def _make_video(page, job: Job) -> None:
    page.context.set_default_timeout(30_000)
    job.step = "Opening Google Flow"
    if not _signed_in(page):
        _save_state(signed_in=False, checked_at=_now())
        raise FlowError("Google Flow is signed out. Sign in again, then retry.")
    try:
        job.step = "Starting a new Flow project"
        flow_steps.new_project(page)
        job.flow_project = page.url
        job.step = "Setting up the video"
        flow_steps.set_video_options(page, job.aspect)
        job.step = "Sending your prompt to Google Flow"
        before = flow_steps.tile_count(page)
        flow_steps.send_prompt(page, job.prompt, job.aspect, job.seconds)
        job.generated = True
        job.step = "Google Flow is making the video (usually 2 to 8 minutes)"
        tile = flow_steps.wait_for_video(page, GENERATE_TIMEOUT, before)
        job.step = "Saving the video to your website"
        try:
            data = flow_steps.download(page, tile)
        except flow_steps.StepError:
            # A path the repair agent found earlier, if Flow's usual one stopped working.
            data = flow_repair.try_learned_path(page, tile)
            if data is None:
                raise
    except Exception:
        _debug_shot(page, job, "failed")
        raise
    if len(data) < 20_000:
        raise FlowError("Google Flow returned an empty video. Try again or use another prompt.")
    save_clip(job, data)


def save_clip(job: "Job", data: bytes) -> None:
    """The clip, ready for the web, plus its scroll frames, where the website serves it."""
    target = Path(job.file)
    target.parent.mkdir(parents=True, exist_ok=True)
    for old in target.parent.glob(f"{target.stem}.*"):
        old.unlink(missing_ok=True)
    job.step = "Preparing the video for the web"
    target.write_bytes(_web_ready(data, job.aspect))
    job.step = "Making the scroll frames"
    make_scroll_frames(target)


SCROLL_FPS = 15


def make_scroll_frames(video: Path) -> dict | None:
    """Turns a hero clip into a numbered frame sequence, `<name>-frames/0001.webp` and so on,
    plus `frames.json`, so the page can play it with the scroll (drawn on a canvas, forward and
    backward), like product pages do. A video file can't seek smoothly enough for that.
    15 frames a second, at most 1600 pixels wide. Without ffmpeg there are no frames, and
    the page uses the plain video instead."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg or not video.exists():
        return None
    folder = video.parent / f"{video.stem}-frames"
    shutil.rmtree(folder, ignore_errors=True)
    folder.mkdir(parents=True, exist_ok=True)
    portrait = video.stem.endswith("portrait")
    scale = "scale=-2:'min(1600,ih)'" if portrait else "scale='min(1600,iw)':-2"
    done = subprocess.run(
        [ffmpeg, "-y", "-loglevel", "error", "-i", str(video), "-an", "-vf", f"fps={SCROLL_FPS},{scale}",
         "-c:v", "libwebp", "-quality", "72", "-compression_level", "4", str(folder / "%04d.webp")],
        capture_output=True, timeout=300,
    )
    frames = sorted(folder.glob("*.webp"))
    if done.returncode != 0 or not frames:
        shutil.rmtree(folder, ignore_errors=True)
        return None
    try:
        size = subprocess.run(
            [shutil.which("ffprobe") or "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
             "stream=width,height", "-of", "csv=p=0", str(frames[0])], capture_output=True, text=True, timeout=30,
        ).stdout.strip().split(",")
        width, height = int(size[0]), int(size[1])
    except (OSError, ValueError, IndexError, subprocess.SubprocessError):
        width, height = 0, 0
    info = {"count": len(frames), "fps": SCROLL_FPS, "width": width, "height": height,
            "pattern": f"/media/{folder.name}/{{index}}.webp", "index_digits": 4, "first": 1,
            "bytes": sum(f.stat().st_size for f in frames)}
    (folder / "frames.json").write_text(json.dumps(info, indent=2), encoding="utf-8")
    return info


def _web_ready(data: bytes, aspect: str) -> bytes:
    """A hero loop as good landing pages ship it: no sound, at most 1080p, H.264 MP4 that starts
    playing while it loads, a few MB. Without ffmpeg on this computer, Flow's file is kept as it is."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return data
    work = settings.data_dir / "flow-tmp"
    work.mkdir(parents=True, exist_ok=True)
    source, result = work / f"{uuid.uuid4().hex}.in", work / f"{uuid.uuid4().hex}.mp4"
    try:
        source.write_bytes(data)
        scale = "scale='min(1920,iw)':-2" if aspect == "16:9" else "scale=-2:'min(1920,ih)'"
        done = subprocess.run(
            [ffmpeg, "-y", "-loglevel", "error", "-i", str(source), "-an", "-vf", scale,
             "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p",
             "-movflags", "+faststart", str(result)],
            capture_output=True, timeout=300,
        )
        if done.returncode == 0 and result.exists() and result.stat().st_size > 20_000:
            return result.read_bytes()
        return data
    except (OSError, subprocess.SubprocessError):
        return data
    finally:
        source.unlink(missing_ok=True)
        result.unlink(missing_ok=True)


worker = FlowWorker()
