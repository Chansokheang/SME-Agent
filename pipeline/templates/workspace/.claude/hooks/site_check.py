"""Gagesite's self-test of the website being built (Stage 4): `npm run site:check`.

Opens the website in a real browser the way the owner would: logs in with every test
account in docs/04-build.json, opens every finished page as each of them (and logged out),
follows the links on each page, and collects what goes wrong: server errors, browser
errors, Next.js error popups, failed logins, broken links and missing pages. It also saves
a screenshot of every page (docs/04-screens/<slug>.jpg), taken as someone allowed to see it.

It also calls every finished API address in "api" (with and without the test key), checks
that buttons have motion, and that the site respects visitors who turn animations off.

While pages are still being built it uses the owner's live preview when one is running,
otherwise its own `next dev`. Once EVERY page and API address is done it runs the FINAL
test instead: it makes the production build (as Vercel will), starts it, and tests that.
Results go to docs/04-check.json ("final": true for the final test). Exit code 0: no problems; 1: problems found (listed in
the output); 3: the self-test could not run here (no browser available).
"""

import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
import service_proc  # noqa: E402  (the separate API service, for "UI + dedicated API")

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
DOCS = ROOT / "docs"
SCREENS = DOCS / "04-screens"
REPORT = DOCS / "04-check.json"
PREVIEW_PORT = ROOT / ".claude" / "preview-port"
PREVIEW_LOG = ROOT / ".claude" / "preview.log"
OWN_LOG = ROOT / ".claude" / "check-server.log"
OWN_DIST = ".next-check"
FINAL_DIST = ".next-final"
SERVICE_PORT = ROOT / ".claude" / "service-port"
SERVICE_LOG = ROOT / ".claude" / "service.log"
SERVICE_OWN_LOG = ROOT / ".claude" / "check-service.log"

ANSI = re.compile(r"\x1b\[[0-9;]*m")
SKIP_LINK = re.compile(r"log-?out|sign-?out|/api/|\.(pdf|xlsx?|csv|zip|jpg|png|svg)$", re.I)
# "Failed to load resource" is reported with its address by the response listener instead.
CONSOLE_NOISE = re.compile(r"React DevTools|webpack-hmr|\[HMR\]|\[Fast Refresh\]|favicon\.ico|Download the React|Failed to load resource", re.I)
SERVER_ERROR = re.compile(r"⨯|Unhandled|Error:|PrismaClient\w*Error|TypeError|ReferenceError")
SERVER_NOISE = re.compile(r"NEXT_REDIRECT|NEXT_NOT_FOUND|⚠")
ERROR_TEXT = re.compile(
    r"Application error: a (server|client)-side exception|Unhandled Runtime Error|Internal Server Error|This page could not be found"
)
MAX_LINKS = 80
FINAL = False  # set in main(): every page and API address is done, so test the production build


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def answers(url: str, timeout: float = 90) -> bool:
    try:
        urllib.request.urlopen(url, timeout=timeout)
        return True
    except urllib.error.HTTPError:
        return True  # an error page still means the server is up
    except Exception:
        return False


class Server:
    """The owner's live preview if it is running, otherwise a private `next dev`.
    For the final test: the production build, started with `next start`."""

    def __init__(self, final: bool = False) -> None:
        self.process: subprocess.Popen | None = None
        self.log_path = PREVIEW_LOG
        self.url = ""
        self.final = final
        self.dist = FINAL_DIST if final else OWN_DIST
        # The separate API service, when the site has one ("UI + dedicated API").
        self.api_url = ""
        self.service: subprocess.Popen | None = None
        self.service_log_path = SERVICE_LOG

    def start_service(self) -> dict[str, str]:
        """Starts (or reuses the preview's) API service; returns the settings that point the website at it."""
        if not service_proc.exists(ROOT):
            return {}
        if not service_proc.installed(ROOT):
            fail("The API service's packages are not installed: run `npm run service:install` first.")
        try:
            port = int(SERVICE_PORT.read_text().strip())
        except (OSError, ValueError):
            port = 0
        if not self.final and port and service_proc.healthy(f"http://localhost:{port}"):
            self.api_url = f"http://localhost:{port}"
        else:
            port = free_port()
            self.api_url = f"http://localhost:{port}"
            self.service_log_path = SERVICE_OWN_LOG
            self.service_log = open(SERVICE_OWN_LOG, "w", encoding="utf-8", errors="replace")
            self.service = service_proc.start(ROOT, port, self.service_log,
                                              extra_env={"ALLOWED_ORIGINS": "http://localhost:3000,http://127.0.0.1:3000"})
            if not service_proc.wait_healthy(self.api_url, self.service):
                self.service_log.close()
                tail = "\n".join(self.read_service_log(0)[-25:])
                service_proc.stop(self.service)
                fail(f"The API service did not start (GET /health never answered). Its output:\n{tail}")
        return {"API_URL": self.api_url, "NEXT_PUBLIC_API_URL": self.api_url}

    def service_log_size(self) -> int:
        try:
            return self.service_log_path.stat().st_size
        except OSError:
            return 0

    def read_service_log(self, offset: int) -> list[str]:
        try:
            with open(self.service_log_path, "rb") as handle:
                handle.seek(offset)
                return [ANSI.sub("", line) for line in handle.read().decode("utf-8", "replace").splitlines()]
        except OSError:
            return []

    def __enter__(self) -> "Server":
        try:
            port = int(PREVIEW_PORT.read_text().strip())
        except (OSError, ValueError):
            port = 0
        service_env = self.start_service()
        if not self.final and port and answers(f"http://localhost:{port}"):
            self.url = f"http://localhost:{port}"
            return self
        port = free_port()
        self.url = f"http://localhost:{port}"
        self.log_path = OWN_LOG
        npm = shutil.which("npm") or "npm"
        env = {**os.environ, "NEXT_DIST_DIR": self.dist, "NEXT_TELEMETRY_DISABLED": "1", "PORT": str(port), **service_env}
        self.log = open(OWN_LOG, "w", encoding="utf-8", errors="replace")
        if self.final:
            print("Final test: building the finished website the way it will be built online...", flush=True)
            shutil.rmtree(SITE / self.dist, ignore_errors=True)
            built = subprocess.run([npm, "run", "build"], cwd=SITE, env={**env, "NODE_ENV": "production"},
                                   stdout=self.log, stderr=subprocess.STDOUT, timeout=900)
            if built.returncode != 0:
                tail = "\n".join(line for line in self.read_log(0)[-40:] if line.strip())
                self.log.close()
                shutil.rmtree(SITE / self.dist, ignore_errors=True)
                fail(f"The finished website does not build, so it could not go online. The build says:\n{tail}")
        self.process = subprocess.Popen(
            [npm, "run", "start" if self.final else "dev", "--", "-p", str(port)],
            cwd=SITE, env=env, stdout=self.log, stderr=subprocess.STDOUT,
            creationflags=(subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW) if os.name == "nt" else 0,
            start_new_session=os.name != "nt",
        )
        deadline = time.time() + 180
        while time.time() < deadline:
            if self.process.poll() is not None:
                break
            if answers(self.url, timeout=30):
                return self
            time.sleep(1.5)
        tail = "\n".join(self.read_log(0)[-25:])
        self.__exit__()
        fail(f"The website's server did not start. Its output:\n{tail}")
        return self

    def log_size(self) -> int:
        try:
            return self.log_path.stat().st_size
        except OSError:
            return 0

    def read_log(self, offset: int) -> list[str]:
        try:
            with open(self.log_path, "rb") as handle:
                handle.seek(offset)
                return [ANSI.sub("", line) for line in handle.read().decode("utf-8", "replace").splitlines()]
        except OSError:
            return []

    def __exit__(self, *_) -> None:
        if self.service:
            service_proc.stop(self.service)
            self.service_log.close()
            self.service = None
        if not self.process:
            return
        if self.process.poll() is None:
            if os.name == "nt":  # npm -> node -> next: end the whole tree
                subprocess.run(["taskkill", "/T", "/F", "/PID", str(self.process.pid)], capture_output=True)
            else:
                os.killpg(self.process.pid, signal.SIGTERM)
        self.log.close()
        self.process = None
        shutil.rmtree(SITE / self.dist, ignore_errors=True)


def fail(message: str) -> None:
    print(message)
    REPORT.write_text(json.dumps({"ok": False, "checked_at": time.time(), "final": FINAL,
                                  "problems": [{"page": "", "as": "", "problem": message}]},
                                 indent=2), encoding="utf-8")
    sys.exit(1)


def page_slug(path: str) -> str:
    slug = re.sub(r"[\[\]]", "", path.strip("/")).replace("/", "-")
    return slug or "home"


def same_path(url: str, target: str) -> bool:
    return (urlparse(url).path.rstrip("/") or "/") == (urlparse(target).path.rstrip("/") or "/")


def launch(playwright):
    for channel in ("chrome", "msedge", None):
        try:
            return playwright.chromium.launch(channel=channel, headless=True) if channel else playwright.chromium.launch(headless=True)
        except Exception:
            continue
    return None


ISSUES_JS = """() => {
  const portal = document.querySelector('nextjs-portal');
  const text = portal && portal.shadowRoot ? portal.shadowRoot.textContent || '' : '';
  const m = text.match(/(\\d+)\\s+Issues?/);
  return m ? Number(m[1]) : 0;
}"""

LINKS_JS = """() => Array.from(document.querySelectorAll('a[href]'))
  .map(a => a.getAttribute('href'))
  .filter(h => h && h.startsWith('/') && !h.startsWith('//'))"""

# Visible buttons with no transition or animation of their own (they don't react when pressed).
STILL_BUTTONS_JS = """() => {
  const moves = (el) => {
    const s = getComputedStyle(el);
    const timed = (v) => v.split(',').some(t => parseFloat(t) > 0);
    return timed(s.transitionDuration) || (s.animationName !== 'none' && timed(s.animationDuration));
  };
  const buttons = Array.from(document.querySelectorAll(
    'button, [role="button"], input[type="submit"], input[type="button"]'))
    .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  return buttons.filter(el => !moves(el))
    .map(el => (el.innerText || el.value || el.getAttribute('aria-label') || el.title || 'a button with no label')
      .trim().replace(/\\s+/g, ' ').slice(0, 40));
}"""
REDUCED_MOTION = re.compile(r"prefers-reduced-motion|reducedMotion|useReducedMotion|motion-reduce:|motion-safe:")


def call_api(base: str, method: str, target: str, key: str | None) -> tuple[int, str]:
    """One request to the website's API: (status, body). Status 0 when it did not answer at all."""
    headers = {"Accept": "application/json"}
    data = None
    if key:
        headers["Authorization"] = f"Bearer {key}"
    if method != "GET":
        headers["Content-Type"] = "application/json"
        data = b"{}"  # empty input: a write must refuse it, never store it
    request = urllib.request.Request(base + target, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return response.status, response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", "replace")
    except Exception as exc:  # noqa: BLE001
        return 0, str(exc)


def check_api(server, endpoints: list[dict], key: str, problem) -> int:
    """Calls each finished API address without and with the test key. Returns how many were called."""
    called = 0
    for entry in endpoints:
        method = str(entry.get("method") or "GET").upper()
        label = f"API {method} {entry.get('path')}"
        target = entry.get("preview") or entry.get("path") or ""
        if "[" in target or not target.startswith("/"):
            problem(label, "a program", 'This API address has no "preview" with a real id, so it can not be called.')
            continue
        # Signing in or signing up can't need a key: they are how a visitor gets one.
        public = re.search(r"/auth/(login|signin|sign-in|register|signup|sign-up)$", str(entry.get("path") or ""))
        needs_key = entry.get("needs_key", not public) is not False
        offset = server.service_log_size() if server.api_url else server.log_size()
        base = server.api_url or server.url
        called += 1
        status, body = call_api(base, method, target, None)
        if status == 0:
            problem(label, "a program", f"The API did not answer: {body[:200]}")
            continue
        if status >= 500:
            problem(label, "a program", f"The API answered with error {status} when called without a key.")
        elif needs_key and status < 400:
            problem(label, "a program", f"The API answered {status} WITHOUT an access key: anyone on the internet could use it. "
                    "It must answer 401 when the key is missing or wrong.")
        elif needs_key and status not in (401, 403):
            problem(label, "a program", f"Without an access key the API should answer 401, not {status}.")
        if needs_key and not key:
            problem(label, "a program", 'docs/04-build.json has no "api_test_key", so the API could not be tried with a key. '
                    "Seed one local test key for a test account and put it there.")
        else:
            status, body = call_api(base, method, target, key if needs_key else None)
            if status in (401, 403):
                problem(label, "a program", f"The API refused the test key (error {status}).")
            elif status >= 500 or status == 0:
                problem(label, "a program", f"The API failed with the test key (error {status}): {body[:300]}")
            elif method == "GET":
                if status != 200:
                    problem(label, "a program", f"The API answered {status} with the test key; it should answer 200 with the data.")
                else:
                    try:
                        json.loads(body)
                    except json.JSONDecodeError:
                        problem(label, "a program", "The API did not answer with JSON: " + body[:200])
            elif status < 400:
                problem(label, "a program", f"The API accepted an empty request ({status}): it must check its input and answer 400.")
        log_lines = server.read_service_log(offset) if server.api_url else server.read_log(offset)
        server_lines = [line.strip() for line in log_lines if SERVER_ERROR.search(line) and not SERVER_NOISE.search(line)]
        if server_lines:
            problem(label, "a program", "Server error output:\n" + "\n".join(server_lines[:12]))
    return called


def login_path(api: list) -> str:
    """The service's sign-in address from docs/04-build.json (POST .../auth/login); the layered
    starter's /api/v1/auth/login when it isn't listed (projects before it used /v1/auth/login)."""
    for entry in api or []:
        path = str(entry.get("path") or "") if isinstance(entry, dict) else ""
        if str(entry.get("method", "")).upper() == "POST" and re.search(r"/auth/(login|signin|sign-in)$", path):
            return path
    return "/api/v1/auth/login"


def service_token(server, accounts: list[dict], problem, api: list | None = None) -> str:
    """The separate API service signs people in itself: log in as the first test account for a token."""
    path = login_path(api or [])
    label = f"API POST {path}"
    if not accounts:
        problem(label, "a program", "docs/04-build.json has no test_accounts, so the API could not be "
                "tried signed in. Seed one test account per role and list them there.")
        return ""
    account = accounts[0]
    body = json.dumps({"email": account["email"], "password": account["password"]}).encode()
    request = urllib.request.Request(server.api_url + path, data=body, method="POST",
                                     headers={"Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return str(json.loads(response.read()).get("data", {}).get("token") or "")
    except Exception as exc:  # noqa: BLE001
        problem(label, "a program", f"Signing in to the API as {account['email']} failed: {exc}")
        return ""


def wants_showcase() -> bool:
    """The owner uploaded a 3D model and asked for the home page's 3D showcase."""
    try:
        kit = json.loads((DOCS / "03-design-kit.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return bool(kit.get("showcase_3d") and kit.get("model"))


def check_showcase(server, playwright, problem) -> None:
    """The home page must load the owner's 3D model and show it."""
    if not (SITE / "public" / "brand" / "model.glb").is_file():
        problem("/", "everyone", "The 3D model is missing: copy brand/model.glb to site/public/brand/model.glb (see 3D showcase).")
        return
    browser = launch(playwright)
    if browser is None:
        return
    try:
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        loaded: list[int] = []
        page.on("response", lambda r: loaded.append(r.status) if r.url.split("?")[0].endswith(".glb") else None)
        try:
            page.goto(server.url + "/", wait_until="load", timeout=150_000)
            page.wait_for_timeout(1500)
            # The showcase may sit just below the first screen: bring it into view, then give it time.
            page.evaluate("document.querySelector('model-viewer')?.scrollIntoView({block: 'center'})")
            page.wait_for_timeout(6000)
        except Exception as exc:
            problem("/", "everyone", f"The home page did not load for the 3D check: {str(exc).splitlines()[0]}")
            return
        if not page.query_selector("model-viewer"):
            problem("/", "everyone", "The home page has no 3D showcase: the owner asked for their 3D model there (see 3D showcase).")
        elif not loaded:
            problem("/", "everyone", "The 3D model never loads on the home page (no request for the .glb file). Check its src and that it is not hidden.")
        elif not any(200 <= s < 400 for s in loaded):
            problem("/", "everyone", f"The 3D model file fails to load (error {loaded[-1]}).")
    finally:
        browser.close()


def has_reduced_motion_rule() -> bool:
    for path in (SITE / "src").rglob("*"):
        if path.suffix in {".css", ".ts", ".tsx", ".js", ".jsx"} and path.is_file():
            try:
                if REDUCED_MOTION.search(path.read_text(encoding="utf-8", errors="ignore")):
                    return True
            except OSError:
                continue
    return False


def main() -> None:
    for stream in (sys.stdout, sys.stderr):  # page text may be Korean etc.; Windows consoles default to cp949
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    try:
        build = json.loads((DOCS / "04-build.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        fail("docs/04-build.json is missing or not valid JSON, so there is nothing to check yet.")
    global FINAL
    all_pages = [p for p in build.get("pages", []) if isinstance(p, dict)]
    pages = [p for p in all_pages if p.get("status") == "done"]
    endpoints = [e for e in build.get("api", []) if isinstance(e, dict)]
    done_endpoints = [e for e in endpoints if e.get("status") == "done"]
    FINAL = bool(all_pages) and len(pages) == len(all_pages) and len(done_endpoints) == len(endpoints)
    accounts = [a for a in build.get("test_accounts", []) if isinstance(a, dict) and a.get("email") and a.get("password")]
    login_path = next((p["path"] for p in build.get("pages", []) if re.search(r"log-?in|sign-?in", str(p.get("path", "")))), "/login")
    if not pages:
        print("No pages are marked done yet: nothing to check.")
        return

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("The self-test can't run here (no browser available). Skipped.")
        sys.exit(3)

    problems: list[dict] = []
    seen: dict[str, str] = {}  # page path -> who could see it
    shot: set[str] = set()  # pages photographed (a clean view replaces one with problems)
    SCREENS.mkdir(parents=True, exist_ok=True)

    def problem(page: str, who: str, text: str) -> None:
        text = text.strip()[:1200]
        if not any(p["page"] == page and p["problem"] == text for p in problems):
            problems.append({"page": page, "as": who, "problem": text})

    if FINAL:
        print("Every page is done: running the FINAL test on the finished website.", flush=True)
    api_called = 0
    with Server(final=FINAL) as server, sync_playwright() as playwright:
        browser = launch(playwright)
        if browser is None:
            print("The self-test can't run here (no browser available). Skipped.")
            sys.exit(3)
        visitors = [("logged out", None)] + [(f"{a.get('role') or a['email']} ({a['email']})", a) for a in accounts]
        links_checked: set[str] = set()
        try:
            for who, account in visitors:
                context = browser.new_context(viewport={"width": 1440, "height": 900})
                page = context.new_page()
                errors: list[str] = []
                page.on("pageerror", lambda exc: errors.append(f"Browser error: {exc}"))
                page.on("console", lambda msg: errors.append(f"Browser console error: {msg.text}")
                        if msg.type == "error" and not CONSOLE_NOISE.search(msg.text) else None)
                page.on("response", lambda r: errors.append(
                    f"A file the page needs is missing or failing: {r.url.replace(server.url, '')} (error {r.status})")
                    if r.status >= 400 and r.request.resource_type != "document" and "favicon" not in r.url else None)

                def visit(target: str):
                    errors.clear()
                    offset = server.log_size()
                    try:
                        response = page.goto(server.url + target, wait_until="load", timeout=150_000)
                    except Exception as exc:
                        return None, [f"The page did not load: {str(exc).splitlines()[0]}"]
                    try:
                        page.wait_for_load_state("networkidle", timeout=15_000)
                    except Exception:
                        pass
                    page.wait_for_timeout(600)
                    found = list(errors)
                    if response is not None and response.status >= 500:
                        found.append(f"The server answered with error {response.status}.")
                    if response is not None and response.status == 404:
                        found.append("The page was not found (404).")
                    body = page.inner_text("body") if page.query_selector("body") else ""
                    match = ERROR_TEXT.search(body)
                    if match and not found:
                        found.append(f"The page shows: {match.group(0)}")
                    issues = page.evaluate(ISSUES_JS)
                    if issues and not found:
                        found.append(f"Next.js shows {issues} issue(s) on this page.")
                    if not found:
                        still = page.evaluate(STILL_BUTTONS_JS)
                        if still:
                            names = ", ".join(f'"{n}"' for n in dict.fromkeys(still))
                            found.append(f"{len(still)} button(s) have no motion when hovered or pressed: {names[:300]}. "
                                         "Give them a transition (see Motion).")
                    server_lines = [line.strip() for line in server.read_log(offset)
                                    if SERVER_ERROR.search(line) and not SERVER_NOISE.search(line)]
                    if server_lines:
                        found.append("Server error output:\n" + "\n".join(server_lines[:12]))
                    return response, found

                if account:
                    _, found = visit(login_path)
                    for text in found:
                        problem(login_path, who, text)
                    offset = server.log_size()
                    try:
                        page.locator('input[type="email"], input[name="email"]').first.fill(account["email"], timeout=10_000)
                        page.locator('input[type="password"]').first.fill(account["password"], timeout=10_000)
                        errors.clear()
                        page.locator('input[type="password"]').first.press("Enter")
                        page.wait_for_url(lambda url: not same_path(url, login_path), timeout=60_000)
                    except Exception:
                        page.wait_for_timeout(500)
                        shown = page.locator('[role="alert"]').all_inner_texts()
                        server_lines = [line.strip() for line in server.read_log(offset)
                                        if SERVER_ERROR.search(line) and not SERVER_NOISE.search(line)]
                        detail = "\n".join(errors + server_lines + [f"The page says: {t}" for t in shown if t.strip()])
                        problem(login_path, who, "Logging in with this test account did not work."
                                + (f"\n{detail}" if detail else " The login page stayed open with no message."))
                        context.close()
                        continue

                for entry in pages:
                    target = entry.get("preview") or entry.get("path", "/")
                    if "[" in target:
                        problem(entry["path"], who, 'The page has no "preview" address with a real id, so it can\'t be opened.')
                        continue
                    response, found = visit(target)
                    for text in found:
                        problem(entry["path"], who, text)
                    reached = same_path(page.url, target)
                    if reached and (not found or entry["path"] not in shot) and entry["path"] not in seen:
                        shot.add(entry["path"])
                        if not found:
                            seen[entry["path"]] = who
                        height = min(page.evaluate("document.documentElement.scrollHeight"), 2700)
                        page.screenshot(path=str(SCREENS / f"{page_slug(entry['path'])}.jpg"), type="jpeg", quality=80,
                                        full_page=True, clip={"x": 0, "y": 0, "width": 1440, "height": max(height, 900)})
                    if not reached:
                        continue
                    for href in page.evaluate(LINKS_JS):
                        href = href.split("#")[0]
                        if not href or href in links_checked or SKIP_LINK.search(href) or len(links_checked) >= MAX_LINKS:
                            continue
                        links_checked.add(href)
                        try:
                            status = context.request.get(server.url + href, max_redirects=5, timeout=120_000).status
                        except Exception:
                            continue
                        if status == 404 or status >= 500:
                            problem(entry["path"], who, f"The link to {href} is broken (error {status}).")
                context.close()
        finally:
            browser.close()
        if server.api_url and not service_proc.healthy(server.api_url):
            problem("API GET /health", "a program", "The API service stopped answering during the test.")
        if done_endpoints:
            key = str(build.get("api_test_key") or "") or (service_token(server, accounts, problem, build.get("api")) if server.api_url else "")
            api_called = check_api(server, done_endpoints, key, problem)
        if wants_showcase() and any(p.get("path") == "/" for p in pages):
            check_showcase(server, playwright, problem)

    if not has_reduced_motion_rule():
        problem("", "everyone",  # the build panel shows an empty page as "Website"
                "The site ignores visitors who turn animations off: add a prefers-reduced-motion rule (see Motion).")

    for entry in pages:
        if entry["path"] not in seen and not any(p["page"] == entry["path"] for p in problems):
            problem(entry["path"], "everyone",
                    "No test account could open this page: everyone was sent somewhere else. Add a test account that may see it.")

    REPORT.write_text(json.dumps({"ok": not problems, "checked_at": time.time(), "final": FINAL, "pages": len(pages),
                                  "api": api_called,
                                  "accounts": len(accounts), "seen_as": seen, "problems": problems}, indent=2), encoding="utf-8")
    print(f"Self-test: {len(pages)} finished pages, opened logged out and as {len(accounts)} test account(s), "
          f"{len(links_checked)} links followed, {api_called} API address(es) called."
          + (" This was the FINAL test, on the production build." if FINAL else ""))
    print(f"Screenshots of {len(shot)} pages saved in docs/04-screens/. Read the ones you changed.")
    if not problems:
        print("No problems found.")
        return
    print(f"\n{len(problems)} problem(s) found. Fix each one, then run `npm run site:check` again:\n")
    for item in problems:
        print(f"- {item['page']} (as {item['as']}): {item['problem']}\n")
    sys.exit(1)


if __name__ == "__main__":
    main()
