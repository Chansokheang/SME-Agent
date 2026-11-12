"""Gagesite's motion check of a landing page (Stage 4): `npm run site:motion`.

The self-test checks that pages WORK; this shows how the page MOVES. It opens the running
website like a visitor (motion on), scrolls down it in small wheel steps the way a person does,
and photographs each storyboard section at the start, a third, two thirds and the end of its
scroll range. Each section becomes one contact sheet (4 frames side by side) in
docs/04-motion/, so the builder can SEE whether a moment feels like the storyboard: does the
pinned chapter really change step by step, does the media really grow, is the text readable at
every frame. Then it scrolls back up and photographs the hero again, to check moments reverse.

On phones it takes one sheet of 6 frames down the page.
Exit code 0: sheets written (problems, if any, are listed); 3: no browser here.
"""

import io
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from site_check import DOCS, ROOT, Server  # noqa: E402

OUT = DOCS / "04-motion"
STORYBOARD = DOCS / "04-storyboard.json"
DESKTOP = {"width": 1440, "height": 900}
PHONE = {"width": 390, "height": 844}
FRAME_WIDTH = 560


def sections() -> list[dict]:
    """The storyboard's sections and their scroll ranges (percent of the page's scroll)."""
    try:
        board = json.loads(STORYBOARD.read_text(encoding="utf-8"))
        found = []
        for s in board.get("sections", []):
            start, end = (s.get("scroll") or [None, None])[:2]
            if isinstance(start, (int, float)) and isinstance(end, (int, float)) and 0 <= start < end <= 100:
                found.append({"id": str(s.get("id") or s.get("name") or len(found)), "name": s.get("name", ""),
                              "start": start, "end": end})
        if found:
            return found
    except (OSError, ValueError, AttributeError):
        pass
    # No storyboard: eight even slices of the page.
    return [{"id": f"part-{i + 1}", "name": f"Part {i + 1}", "start": i * 12.5, "end": (i + 1) * 12.5} for i in range(8)]


def launch(playwright):
    args = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
    for channel in ("chrome", "msedge", None):
        try:
            return playwright.chromium.launch(channel=channel, headless=True, args=args) if channel \
                else playwright.chromium.launch(headless=True, args=args)
        except Exception:
            continue
    return None


def sheet(frames: list[bytes], labels: list[str], title: str, path: Path) -> None:
    from PIL import Image, ImageDraw

    images = [Image.open(io.BytesIO(f)).convert("RGB") for f in frames]
    scaled = [im.resize((FRAME_WIDTH, int(im.height * FRAME_WIDTH / im.width))) for im in images]
    gap, top = 8, 34
    height = max(im.height for im in scaled) + top + 26
    canvas = Image.new("RGB", (len(scaled) * (FRAME_WIDTH + gap) + gap, height), (24, 24, 28))
    draw = ImageDraw.Draw(canvas)
    draw.text((gap, 10), title, fill=(240, 240, 240))
    for i, (im, label) in enumerate(zip(scaled, labels)):
        x = gap + i * (FRAME_WIDTH + gap)
        canvas.paste(im, (x, top))
        draw.text((x, top + im.height + 6), label, fill=(190, 190, 190))
    canvas.save(path, quality=72)


def scroll_to(page, target: int, state: dict, mobile: bool) -> None:
    """Moves like a visitor: small steps, so scrubbed and pinned moments update on the way."""
    while abs(target - state["pos"]) > 2:
        step = max(-220, min(220, target - state["pos"]))
        if mobile:
            page.evaluate(f"window.scrollBy(0, {step})")
        else:
            page.mouse.wheel(0, step)
        state["pos"] += step
        page.wait_for_timeout(45)
    page.wait_for_timeout(900)  # let smoothed scrubbing settle


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    try:
        from playwright.sync_api import sync_playwright
        import PIL  # noqa: F401
    except ImportError:
        print("The motion check can't run here (no browser available). Skipped.")
        sys.exit(3)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.jpg"):
        old.unlink()
    parts = sections()
    problems: list[str] = []
    written: list[str] = []
    with Server(final=False) as server, sync_playwright() as playwright:
        browser = launch(playwright)
        if browser is None:
            print("The motion check can't run here (no browser available). Skipped.")
            sys.exit(3)
        try:
            # Desktop: one sheet per section, then back to the top.
            context = browser.new_context(viewport=DESKTOP)
            page = context.new_page()
            # Moments skip automated browsers (so the self-test sees finished content); this check
            # wants them on, like a real visitor.
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => false})")
            errors: list[str] = []
            page.on("pageerror", lambda exc: errors.append(str(exc)[:300]))
            page.goto(server.url + "/", wait_until="networkidle", timeout=120_000)
            page.wait_for_timeout(3500)
            scrollable = page.evaluate("document.documentElement.scrollHeight") - DESKTOP["height"]
            state = {"pos": 0}
            hero_start = page.screenshot(type="jpeg", quality=70)
            for part in parts:
                frames, labels = [], []
                for k in (0, 1 / 3, 2 / 3, 1):
                    percent = part["start"] + (part["end"] - part["start"]) * k
                    scroll_to(page, int(scrollable * percent / 100), state, False)
                    frames.append(page.screenshot(type="jpeg", quality=70))
                    labels.append(f"{percent:.0f}% of the page")
                name = f"desktop-{part['id']}.jpg"
                sheet(frames, labels, f"Desktop - {part['name'] or part['id']} ({part['start']:.0f}-{part['end']:.0f}%)",
                      OUT / name)
                written.append(name)
            scroll_to(page, 0, state, False)
            page.wait_for_timeout(1500)
            sheet([hero_start, page.screenshot(type="jpeg", quality=70)], ["At load", "After scrolling back up"],
                  "Desktop - does the hero come back the way it started?", OUT / "desktop-back-to-top.jpg")
            written.append("desktop-back-to-top.jpg")
            if page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"):
                problems.append("Desktop: the page scrolls sideways.")
            problems += [f"Desktop browser error: {e}" for e in errors[:5]]
            context.close()

            # Phone: six frames down the page.
            context = browser.new_context(viewport=PHONE, is_mobile=True, has_touch=True)
            page = context.new_page()
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => false})")
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)[:300]))
            page.goto(server.url + "/", wait_until="networkidle", timeout=120_000)
            page.wait_for_timeout(3500)
            scrollable = page.evaluate("document.documentElement.scrollHeight") - PHONE["height"]
            state = {"pos": 0}
            frames, labels = [], []
            for percent in (0, 15, 35, 55, 75, 95):
                scroll_to(page, int(scrollable * percent / 100), state, True)
                frames.append(page.screenshot(type="jpeg", quality=70))
                labels.append(f"{percent}%")
            sheet(frames, labels, "Phone - six points down the page", OUT / "phone.jpg")
            written.append("phone.jpg")
            if page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"):
                problems.append("Phone: the page scrolls sideways.")
            problems += [f"Phone browser error: {e}" for e in errors[:5]]
            context.close()
        finally:
            browser.close()

    (OUT / "index.json").write_text(json.dumps({"checked_at": time.time(), "sheets": written, "problems": problems},
                                               indent=2), encoding="utf-8")
    print("Motion sheets written (look at each with the Read tool, compare with docs/04-storyboard.json):")
    for name in written:
        print(f"- docs/04-motion/{name}")
    if problems:
        print("\nProblems found:")
        for p in problems:
            print(f"- {p}")
    else:
        print("\nNo errors while scrolling. Judge the motion itself from the sheets.")


if __name__ == "__main__":
    main()
