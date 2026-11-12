"""Screenshots of design previews, so UI Design can look at its own work and catch flaws.

Run by UI Design: npm run design-shot -- directions/1.html [pages/home.html ...]
For each file (relative to docs/03-design/) it saves a desktop and a phone screenshot in
docs/03-design/.shots/ and prints problems a browser can find on its own: images that don't
load, sideways scrolling on a phone, stray spaces before punctuation, wireframe text.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DESIGN = ROOT / "docs" / "03-design"
SHOTS = DESIGN / ".shots"
MAX_HEIGHT = 4000

# Scroll through the page so scroll-triggered effects run, then back to the top.
SCROLL_JS = """async () => {
  const step = Math.max(400, innerHeight * 0.8);
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
    window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120));
  }
  window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 400));
}"""
CHECKS_JS = r"""() => {
  const out = [];
  for (const img of document.images) {
    if (img.complete && img.naturalWidth === 0) out.push(`Image does not load: ${img.getAttribute('src')}`);
  }
  const text = document.body.innerText;
  const spaced = text.match(/[A-Za-z0-9ㄱ-힝)\]] +[,.;:!?](?=\s|$)/g) || [];
  if (spaced.length) out.push(`Stray space before punctuation (${spaced.length}x), e.g. "${spaced.slice(0, 3).join('", "')}"`);
  const colon = text.match(/\b\d{1,2} : \d{2}\b/g) || [];
  if (colon.length) out.push(`Spaced-out times, e.g. "${colon[0]}"`);
  const wire = text.match(/lorem ipsum|example author [a-z]\b|item \d\b|title goes here|placeholder text/gi) || [];
  if (wire.length) out.push(`Wireframe text: "${wire[0]}"`);
  return out;
}"""


def main() -> None:
    files = [a for a in sys.argv[1:] if a.strip()]
    if not files:
        files = sorted(str(p.relative_to(DESIGN)).replace("\\", "/") for p in (DESIGN / "directions").glob("*.html"))
    if not files:
        print("No previews to photograph yet. Usage: npm run design-shot -- directions/1.html")
        sys.exit(1)
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Screenshots are not available here (no browser).")
        sys.exit(3)
    SHOTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = None
        for channel in ("chrome", "msedge", None):
            try:
                browser = p.chromium.launch(channel=channel, headless=True) if channel else p.chromium.launch(headless=True)
                break
            except Exception:
                continue
        if browser is None:
            print("Screenshots are not available here (no browser).")
            sys.exit(3)
        for rel in files:
            path = (DESIGN / rel).resolve()
            if not path.is_file() or not path.is_relative_to(DESIGN):
                print(f"- {rel}: not found under docs/03-design/")
                continue
            slug = re.sub(r"[^a-z0-9]+", "-", rel.lower().removesuffix(".html")).strip("-")
            problems: list[str] = []
            for device, width, height in (("desktop", 1280, 800), ("phone", 390, 844)):
                page = browser.new_page(viewport={"width": width, "height": height})
                errors: list[str] = []
                page.on("pageerror", lambda exc: errors.append(f"Script error: {exc}"))
                try:
                    page.goto(path.as_uri(), wait_until="networkidle", timeout=60_000)
                except Exception:
                    page.wait_for_timeout(2000)
                page.evaluate(SCROLL_JS)
                page.wait_for_timeout(800)
                full = min(page.evaluate("document.documentElement.scrollHeight"), MAX_HEIGHT)
                shot = SHOTS / f"{slug}-{device}.png"
                page.screenshot(path=str(shot), full_page=True, clip={"x": 0, "y": 0, "width": width, "height": full})
                if device == "phone":
                    if page.evaluate("document.documentElement.scrollWidth > innerWidth + 1"):
                        problems.append("Scrolls sideways on a phone (something is wider than the screen)")
                else:
                    problems += page.evaluate(CHECKS_JS)
                problems += [e for e in errors if e not in problems]
                page.close()
            print(f"- {rel}: docs/03-design/.shots/{slug}-desktop.png and {slug}-phone.png")
            for problem in dict.fromkeys(problems):
                print(f"    PROBLEM: {problem}")
        browser.close()
    print("Now LOOK at every screenshot with Read and fix what is wrong before you finish.")


if __name__ == "__main__":
    main()
