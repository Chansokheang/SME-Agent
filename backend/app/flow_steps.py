"""The clicks on Google Flow's own page (flow_video.py runs them in the background).

Flow (flow.google.com, late 2026) is an AI assistant per project: a prompt box ("What do you
want to create?"), a Start generation button, and per-project Agent settings (confirm before
generating, the video shape, how many clips, the video model). Each Gagesite video gets its own
new Flow project, set to: the clip's shape, one clip, and no extra confirmation (the owner
already confirmed by pressing "Make with Google Flow"). Other Flow projects keep their settings.

Kept apart because Flow changes its page now and then: when it does, only this file needs
updating. Steps find things by what a person sees (labels, button names), never by generated
class names, and fail with a plain message when they can't.
"""

import base64
import re
import time

ERROR_TEXT = re.compile(
    r"couldn.t generate|could not generate|generation failed|failed to generate|something went wrong|"
    r"violat|not enough credits|out of credits|insufficient credits|try again later|unable to generate|"
    r"can.t help with",
    re.IGNORECASE,
)
PROMPT_BOX = "What do you want to create?"
# Flow's own "what's new" and welcome boxes, closed before anything else.
ANNOUNCEMENT_BUTTONS = ("Get started", "Got it", "Dismiss banner", "Maybe later", "Not now")


class StepError(Exception):
    pass


def _first_visible(locator, timeout: float = 15):
    """The first visible match of a locator, waiting up to `timeout` seconds."""
    end = time.time() + timeout
    while True:
        for i in range(min(locator.count(), 30)):
            item = locator.nth(i)
            try:
                if item.is_visible():
                    return item
            except Exception:
                continue
        if time.time() >= end:
            return None
        time.sleep(0.5)


def dismiss_announcements(page) -> None:
    for _ in range(3):
        closed = False
        for name in ANNOUNCEMENT_BUTTONS:
            button = _first_visible(page.get_by_role("button", name=name, exact=True), 1)
            if button:
                button.click()
                page.wait_for_timeout(800)
                closed = True
        if not closed:
            return


def _prompt_box(page, timeout: float = 15):
    return _first_visible(page.get_by_role("textbox", name=PROMPT_BOX), timeout)


def new_project(page) -> None:
    dismiss_announcements(page)
    button = _first_visible(page.get_by_role("button", name="New project")
                            .or_(page.get_by_text("New project", exact=True)), 20)
    if not button:
        raise StepError("Couldn't find Flow's 'New project' button. Flow may have changed its page.")
    button.click()
    page.wait_for_url(re.compile(r"/project/"), timeout=30_000)
    page.wait_for_timeout(3000)
    dismiss_announcements(page)
    if not _prompt_box(page, timeout=30):
        raise StepError("Flow's project opened without its prompt box.")


def set_video_options(page, aspect: str) -> None:
    """In this project only: no extra confirmation, the clip's shape, and a single clip."""
    settings = _first_visible(page.get_by_role("button", name="Settings").filter(has_text="tune"), 10)
    if not settings:
        raise StepError("Couldn't open Flow's agent settings.")
    settings.click()
    panel_title = _first_visible(page.get_by_text("Agent settings", exact=True), 10)
    if not panel_title:
        raise StepError("Flow's agent settings didn't open.")
    # The panel lists: confirm (Always/Never), image defaults, then video defaults.
    never = _first_visible(page.get_by_text("Never", exact=True), 5)
    if never:
        never.click()
    video_model = page.get_by_role("button", name="Video generation default model")
    if video_model.count() == 0:
        raise StepError("Couldn't find Flow's video settings.")
    shape_text = "crop_9_16" if aspect == "9:16" else "crop_16_9"
    # The video shape and count buttons are the last radios before the video model button.
    radios = page.get_by_role("radio")
    shapes = [radios.nth(i) for i in range(radios.count()) if shape_text in (radios.nth(i).inner_text() or "")]
    counts = [radios.nth(i) for i in range(radios.count()) if (radios.nth(i).inner_text() or "").strip() == "x1"]
    if not shapes or not counts:
        raise StepError("Couldn't set the video's shape in Flow.")
    shapes[-1].click()  # the video section comes after the image section
    counts[-1].click()
    save = _first_visible(page.get_by_role("button", name="Save", exact=True), 5)
    if save:
        save.click()
        page.wait_for_timeout(1500)
    close = _first_visible(page.get_by_role("button", name="Close", exact=True), 2)
    if close and _first_visible(page.get_by_text("Agent settings", exact=True), 1):
        close.click()


def send_prompt(page, prompt: str, aspect: str, seconds: int = 8) -> None:
    box = _prompt_box(page)
    if not box:
        raise StepError("Couldn't find Flow's prompt box.")
    # Flow's assistant can also make images or ask questions: say exactly what is wanted.
    shape = "vertical 9:16" if aspect == "9:16" else "wide 16:9"
    text = (f"Generate exactly one {shape} video clip, {seconds} seconds long, now (a video, not an "
            f"image), without asking questions first. It is a silent background loop for a website's "
            f"hero: one continuous shot, no cuts, no text, no music. The clip: {prompt}")
    box.click()
    page.keyboard.insert_text(text)
    page.wait_for_timeout(500)
    start = _first_visible(page.get_by_role("button", name="Start generation"), 5)
    if not start:
        raise StepError("Couldn't find Flow's Start generation button.")
    start.click()


# Each made clip (or image) is a tile in the project's media grid. A finished clip shows as a
# still thumbnail; its video only loads when the tile is hovered or opened.
TILE = "flow-grid-tile-container"


def _tiles(page):
    return page.locator(TILE)


def tile_count(page) -> int:
    return _tiles(page).count()


def _video_sources(page) -> list[str]:
    return page.evaluate(
        """() => [...document.querySelectorAll('video')]
              .map(v => v.currentSrc || v.src || (v.querySelector('source') || {}).src || '')
              .filter(s => s && !s.startsWith('data:'))"""
    )


def _tile_is_video(tile) -> bool:
    """A FINISHED clip: no progress percentage on the tile, and hovering it loads a real video.
    (A clip still being made shows a percentage, and its menu can't download it yet.)"""
    try:
        if re.search(r"\b\d{1,3}\s?%", tile.inner_text(timeout=3000) or ""):
            return False
        tile.hover(timeout=5000)
        tile.page.wait_for_timeout(1500)
        return bool(tile.evaluate(
            "t => [...t.querySelectorAll('video')].some(v => (v.currentSrc || v.src || '').startsWith('http'))"))
    except Exception:
        return False


def _confirm_if_asked(page) -> bool:
    """If the assistant still asks to go ahead, confirm once (the owner already chose to make it)."""
    for name in ("Generate", "Confirm", "Continue", "Yes, generate", "Go ahead"):
        button = _first_visible(page.get_by_role("button", name=name, exact=True), 0.2)
        if button:
            button.click()
            return True
    return False


def wait_for_video(page, timeout: float, tiles_before: int):
    """Waits for the new clip's tile to finish, and returns that tile."""
    end = time.time() + timeout
    confirmed = False
    while time.time() < end:
        page.wait_for_timeout(8000)
        count = tile_count(page)
        if count > tiles_before:
            # The newest tile comes first in the grid; check the new ones for a finished clip.
            for i in range(count - tiles_before):
                tile = _tiles(page).nth(i)
                if _tile_is_video(tile):
                    return tile
        if not confirmed:
            confirmed = _confirm_if_asked(page)
        text = page.locator("body").inner_text(timeout=5000)
        if ERROR_TEXT.search(text):
            line = next((l.strip() for l in text.splitlines() if ERROR_TEXT.search(l)), "")
            raise StepError(f"Google Flow said: {line[:200]}")
    raise StepError("Google Flow didn't finish the video in time. It may still appear in your Flow project; "
                    "try again in a few minutes.")


def _tile_menu_button(page, tile):
    """The clip's own "More options" button: the one drawn on top of the tile (the page and the
    project have buttons with the same name, whose menus download the whole project)."""
    box = tile.bounding_box()
    if not box:
        return None
    buttons = page.get_by_role("button", name="More options", exact=True)
    for i in range(buttons.count()):
        button = buttons.nth(i)
        try:
            b = button.bounding_box()
        except Exception:
            continue
        if not b:
            continue
        cx, cy = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
        if box["x"] <= cx <= box["x"] + box["width"] and box["y"] <= cy <= box["y"] + box["height"]:
            return button
    return None


def download(page, tile) -> bytes:
    """Flow's own Download, at the clip's original size (720p): the file a person would get."""
    tile.hover()
    page.wait_for_timeout(1200)
    more = _tile_menu_button(page, tile)
    if more is None:
        raise StepError("Couldn't open the clip's menu in Flow.")
    more.click()
    item = _first_visible(page.get_by_role("menuitem").filter(has_text="Download"), 10)
    if not item:
        raise StepError("Couldn't find Download in Flow's clip menu.")
    item.click()
    size = _first_visible(page.get_by_role("menuitem").filter(has_text="Original size"), 10)
    if not size:
        raise StepError("Couldn't find the original-size download in Flow.")
    with page.expect_download(timeout=180_000) as info:
        size.click()
    path = info.value.path()
    if not path:
        raise StepError("Flow's download didn't finish.")
    return open(path, "rb").read()
