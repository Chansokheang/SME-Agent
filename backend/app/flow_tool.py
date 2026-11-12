"""The Flow repair agent's only tool: look at a Flow project and try a path of clicks.

    python flow_tool.py look
    python flow_tool.py try "@tile:0:More options" "Download" "Original size"

Run inside a rescue folder (data/flow-rescue/<job>/) whose job.json holds the Flow project's
address. Every call opens that project fresh in Gagesite's signed-in Chrome profile (no window).

- `look` saves look.png (a screenshot) and look.txt: the visible buttons, menu items and
  inputs (role, name, position), the media tiles (index, position, whether it is a finished
  clip) and the page's text.
- `try` clicks a path of things by their visible name, in order. A step written
  "@tile:N:<name>" hovers media tile N and clicks the button with that name drawn ON that tile
  (the page, the project and each tile can have buttons with the same name). If a download
  starts, the file is saved as clip.raw. Then it saves look.png and look.txt again.

Nothing that spends credits or changes the account can be clicked: names that start a
generation, delete, publish, share, upgrade, buy or sign out are refused.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import flow_steps, flow_video  # noqa: E402

FOLDER = Path.cwd()
REFUSED = re.compile(
    r"generat|start|send|creat|submit|delete|bin|remove|publish|share|youtube|upgrade|buy|subscri|plan|"
    r"sign ?out|log ?out|flag|report|rename|reuse|add to|favou?rite|agent|settings",
    re.IGNORECASE,
)
CONTROLS_JS = r"""() => [...document.querySelectorAll('button,[role=button],[role=menuitem],[role=menuitemradio],[role=option],a,input,textarea,[role=textbox]')]
  .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
  .map(e => { const r = e.getBoundingClientRect();
    return {role: e.getAttribute('role') || e.tagName.toLowerCase(), name: (e.getAttribute('aria-label') || '').trim(),
            text: (e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 60),
            x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)} })"""


def job() -> dict:
    return json.loads((FOLDER / "job.json").read_text(encoding="utf-8"))


def look(page, note: str = "") -> None:
    page.screenshot(path=str(FOLDER / "look.png"))
    lines = [note] if note else []
    tiles = flow_steps._tiles(page)
    lines.append(f"URL: {page.url}")
    lines.append(f"Media tiles: {tiles.count()}")
    for i in range(min(tiles.count(), 12)):
        box = tiles.nth(i).bounding_box() or {}
        label = tiles.nth(i).get_attribute("aria-label") or ""
        lines.append(f"  tile {i}: '{label}' at x={round(box.get('x', 0))} y={round(box.get('y', 0))} "
                     f"w={round(box.get('width', 0))} h={round(box.get('height', 0))}")
    lines.append("Visible controls (role | aria-label | text | position):")
    for c in page.evaluate(CONTROLS_JS)[:120]:
        lines.append(f"  {c['role']} | {c['name']} | {c['text']} | x={c['x']} y={c['y']} {c['w']}x{c['h']}")
    text = page.locator("body").inner_text(timeout=5000)
    lines.append("Page text (start):")
    lines.append(text[:2500])
    (FOLDER / "look.txt").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:80]))
    print("\nSaved look.png and look.txt (read them for the full picture).")


def open_project(page) -> None:
    url = job().get("flow_project")
    if not url:
        raise SystemExit("job.json has no Flow project address: the job failed before a project was made.")
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(6000)
    flow_steps.dismiss_announcements(page)


def click_step(page, step: str) -> None:
    if REFUSED.search(step.split(":")[-1]):
        raise SystemExit(f"Refused: '{step}' could spend credits or change the account.")
    if step.startswith("@tile:"):
        _, index, name = step.split(":", 2)
        tile = flow_steps._tiles(page).nth(int(index))
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
        raise SystemExit(f"No button named '{name}' on tile {index}.")
    target = flow_steps._first_visible(
        page.get_by_role("menuitem", name=step).or_(page.get_by_role("menuitemradio", name=step))
        .or_(page.get_by_role("button", name=step, exact=True)).or_(page.get_by_role("option", name=step))
        .or_(page.get_by_role("menuitem").filter(has_text=step)), 8)
    if target is None:
        raise SystemExit(f"Nothing visible named '{step}'. Run look to see what is there.")
    target.click()
    page.wait_for_timeout(1000)


def main() -> None:
    command, steps = (sys.argv[1] if len(sys.argv) > 1 else "look"), sys.argv[2:]
    with flow_video._flow_browser() as page:
        open_project(page)
        if command == "look":
            look(page)
            return
        if command != "try" or not steps:
            raise SystemExit('Use: look, or try "<step>" "<step>" ...')
        got = None
        try:
            for step in steps[:-1]:
                click_step(page, step)
            with page.expect_download(timeout=60_000) as info:
                click_step(page, steps[-1])
            got = info.value
        except SystemExit:
            raise
        except Exception as exc:  # no download came: show where it stands
            look(page, f"No download after the last step ({str(exc).splitlines()[0][:160]}).")
            sys.exit(1)
        path = got.path()
        data = Path(path).read_bytes() if path else b""
        if len(data) < 20_000:
            look(page, f"A download came ({got.suggested_filename}) but it is too small to be the clip.")
            sys.exit(1)
        if got.suggested_filename.lower().endswith(".zip"):
            look(page, "That downloaded a ZIP (a whole project), not the clip. Try the clip's own menu.")
            sys.exit(1)
        (FOLDER / "clip.raw").write_bytes(data)
        print(f"Downloaded {got.suggested_filename} ({len(data)} bytes) as clip.raw. The clip is rescued.")


if __name__ == "__main__":
    main()
