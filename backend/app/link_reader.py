"""Reads a website the owner links in the Stage 1 chat (their current site, or one they like).

The stage AI has no web access, so Gagesite opens the link itself: a headless browser renders the
page (JavaScript apps included), saves a screenshot, and writes a plain-text copy of what is on it
(title, menu, headings, buttons, tables, forms and text) plus the same for a few pages from its
menu. Both land in docs/01-sources/ next to the owner's documents, where the AI reads them.

Only public http(s) addresses are opened: anything that resolves to this machine or a private
network is refused, so a link can't be used to reach internal services.
"""

import ipaddress
import json
import re
import socket
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "Mozilla/5.0 (compatible; Gagesite/0.1; website builder prototype)"
URL_PATTERN = re.compile(r"https?://[^\s<>\"'()]+", re.IGNORECASE)
MAX_LINKS_PER_MESSAGE = 2
EXTRA_PAGES = 4  # pages from the site's own menu, read as text only
DETAIL_PAGES = 2  # item pages opened from a list or table (e.g. one product, one protein)
MAX_TEXT = 12_000  # characters of visible text kept per page
TIMEOUT_MS = 25_000


class LinkError(Exception):
    """A plain-language reason the page could not be read."""


@dataclass
class PageText:
    url: str
    title: str = ""
    markdown: str = ""


@dataclass
class LinkResult:
    url: str
    title: str = ""
    pages: list[PageText] = field(default_factory=list)
    screenshot: bytes | None = None
    rendered: bool = True  # False when only the raw HTML could be fetched (no JavaScript)
    # Item pages opened from the first page's list: (text, [screenshots, top first]).
    details: list[tuple[PageText, list[bytes]]] = field(default_factory=list)


def find_urls(text: str) -> list[str]:
    seen: list[str] = []
    for match in URL_PATTERN.findall(text or ""):
        url = match.rstrip(".,;:!?)]}")
        if url not in seen:
            seen.append(url)
    return seen[:MAX_LINKS_PER_MESSAGE]


def check_public(url: str) -> str:
    """The cleaned URL, or LinkError when it isn't a public http(s) address."""
    parsed = urllib.parse.urlparse(url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise LinkError("Only web addresses starting with http:// or https:// can be read.")
    try:
        infos = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror:
        raise LinkError(f"{parsed.hostname} could not be found. Check the address.") from None
    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if not address.is_global:
            raise LinkError("That address points to a private or local network, which Gagesite doesn't open.")
    return urllib.parse.urlunparse(parsed._replace(fragment=""))


# Runs inside the page: a compact outline of what a visitor sees.
EXTRACT_JS = r"""
(maxText) => {
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const visible = (el) => {
    const r = el.getBoundingClientRect(); const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
  };
  const uniq = (xs) => [...new Set(xs.filter(Boolean))];
  const nav = uniq([...document.querySelectorAll("nav a, header a, aside a, [role=navigation] a")]
    .filter(visible).map((a) => { const t = clean(a.innerText); return t ? `${t} -> ${a.href}` : ""; })).slice(0, 40);
  const headings = [...document.querySelectorAll("h1, h2, h3")].filter(visible)
    .map((h) => `${"#".repeat(Number(h.tagName[1]) + 1)} ${clean(h.innerText)}`).filter((h) => h.length > 4).slice(0, 40);
  const buttons = uniq([...document.querySelectorAll("button, [role=button], a[class*=btn], a[class*=button]")]
    .filter(visible).map((b) => clean(b.innerText))).filter((t) => t && t.length < 40).slice(0, 30);
  const tables = [...document.querySelectorAll("table")].filter(visible).slice(0, 3).map((t) => {
    const rows = [...t.querySelectorAll("tr")].slice(0, 8).map((tr) =>
      [...tr.querySelectorAll("th, td")].map((c) => clean(c.innerText).replace(/\|/g, "/").slice(0, 60)));
    const total = t.querySelectorAll("tr").length;
    return { rows, total };
  });
  const forms = [...document.querySelectorAll("form")].filter(visible).slice(0, 5).map((f) =>
    [...f.querySelectorAll("input, select, textarea")].filter((i) => i.type !== "hidden").map((i) => {
      const label = (i.id && document.querySelector(`label[for="${i.id}"]`)?.innerText) || i.placeholder || i.name || i.type;
      return clean(label);
    }).filter(Boolean));
  const meta = document.querySelector('meta[name="description"]')?.content || "";
  const text = clean(document.body ? document.body.innerText : "").slice(0, maxText);
  return { title: document.title, meta, nav, headings, buttons, tables, forms, text,
           links: [...document.querySelectorAll("a[href]")].map((a) => a.href) };
}
"""


def _page_markdown(url: str, data: dict) -> str:
    lines = [f"## {data.get('title') or url}", "", f"Address: {url}", ""]
    if data.get("meta"):
        lines += [f"Description: {data['meta']}", ""]
    if data.get("nav"):
        lines += ["### Menu links", *[f"- {item}" for item in data["nav"]], ""]
    if data.get("headings"):
        lines += ["### Headings", *data["headings"], ""]
    if data.get("buttons"):
        lines += ["### Buttons", ", ".join(data["buttons"]), ""]
    for number, table in enumerate(data.get("tables") or [], 1):
        rows = [r for r in table["rows"] if r]
        if not rows:
            continue
        width = max(len(r) for r in rows)
        rows = [r + [""] * (width - len(r)) for r in rows]
        lines += [f"### Table {number} (first rows of {table['total']})",
                  "| " + " | ".join(rows[0]) + " |", "|" + "---|" * width,
                  *["| " + " | ".join(r) + " |" for r in rows[1:]], ""]
    for number, fields in enumerate(data.get("forms") or [], 1):
        if fields:
            lines += [f"### Form {number} fields", ", ".join(fields), ""]
    if data.get("text"):
        lines += ["### Visible text", data["text"], ""]
    return "\n".join(lines)


def _same_site_pages(start: str, links: list[str], nav: list[str]) -> list[str]:
    """Up to EXTRA_PAGES other pages of the same site, menu links first."""
    host = urllib.parse.urlparse(start).hostname
    ordered = [item.rsplit(" -> ", 1)[-1] for item in nav] + links
    found: list[str] = []
    for link in ordered:
        parsed = urllib.parse.urlparse(link)
        clean = urllib.parse.urlunparse(parsed._replace(fragment="", query=""))
        if parsed.hostname != host or clean.rstrip("/") == start.rstrip("/") or clean in found:
            continue
        if re.search(r"\.(pdf|jpg|jpeg|png|gif|zip|docx?|xlsx?)$|logout|log-out|signout|delete", parsed.path, re.I):
            continue
        found.append(clean)
        if len(found) == EXTRA_PAGES:
            break
    return found


SKIP_ITEM = re.compile(r"/(new|create|add|edit|import|export|login|log-in|signup|settings)(/|$)", re.I)

# Links inside list rows and cards: the usual way to an item's own page.
ITEM_LINKS_JS = r"""
() => [...document.querySelectorAll("table tbody a[href], [role=row] a[href], li a[href], article a[href], [class*=card] a[href]")]
  .map((a) => a.href)
"""


def _detail_urls(page, start: str) -> list[str]:
    """Up to DETAIL_PAGES item pages reachable from the list on this page: links in rows and cards,
    or (for apps whose rows open on click) the address a row click leads to."""
    host = urllib.parse.urlparse(start).hostname
    base = urllib.parse.urlparse(start).path.rstrip("/")
    found: list[str] = []

    def keep(link: str) -> None:
        parsed = urllib.parse.urlparse(link)
        clean = urllib.parse.urlunparse(parsed._replace(fragment="", query=""))
        if parsed.hostname != host or clean in found or clean.rstrip("/") == start.rstrip("/") or SKIP_ITEM.search(parsed.path):
            return
        if base and not parsed.path.startswith(base + "/"):
            return  # an item of THIS list lives under its address, e.g. /proteins/207
        found.append(clean)

    for link in page.evaluate(ITEM_LINKS_JS):
        keep(link)
        if len(found) == DETAIL_PAGES:
            return found
    for index in range(DETAIL_PAGES):
        try:
            row = page.locator("table tbody tr").nth(index)
            cells = row.locator("td")
            # Click a cell with text, not the checkbox column.
            (cells.nth(1) if cells.count() > 1 else row).click(timeout=3000)
            page.wait_for_url(lambda u: u.rstrip("/") != start.rstrip("/"), timeout=6000)
            keep(page.url)
        except Exception:
            pass
        if page.url.rstrip("/") != start.rstrip("/"):
            page.goto(start, wait_until="networkidle", timeout=15_000)
            page.wait_for_timeout(800)
    return found[:DETAIL_PAGES]


def _screens(page, count: int = 2) -> list[bytes]:
    """The first screens of a page, top first (separate images stay readable when shown)."""
    # Apps often scroll a panel instead of the page: scroll whichever holds the most content.
    scroll_js = """(step) => {
      const els = [document.scrollingElement, ...document.querySelectorAll("main, [class*=overflow], div")];
      const box = els.filter((el) => el && el.scrollHeight - el.clientHeight > 150)
        .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0];
      if (!box) return false;
      const before = box.scrollTop; box.scrollTop = before + step; return box.scrollTop > before;
    }"""
    shots = [page.screenshot(type="jpeg", quality=80)]
    for _ in range(count - 1):
        if not page.evaluate(scroll_js, 820):
            break
        page.wait_for_timeout(400)
        shots.append(page.screenshot(type="jpeg", quality=80))
    return shots


def _read_with_browser(url: str) -> LinkResult:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = None
        for channel in ("chrome", "msedge", None):  # the installed Chrome or Edge, else Playwright's own
            try:
                browser = p.chromium.launch(channel=channel, headless=True) if channel else p.chromium.launch(headless=True)
                break
            except Exception:
                continue
        if browser is None:
            raise RuntimeError("no browser available")
        try:
            page = browser.new_page(viewport={"width": 1440, "height": 900}, user_agent=USER_AGENT)
            try:
                page.goto(url, wait_until="networkidle", timeout=TIMEOUT_MS)
            except Exception:
                page.goto(url, wait_until="load", timeout=TIMEOUT_MS)
            page.wait_for_timeout(1500)  # let JavaScript apps finish their first render
            check_public(page.url)  # where redirects ended up
            data = page.evaluate(EXTRACT_JS, MAX_TEXT)
            result = LinkResult(url=page.url, title=data.get("title") or "", screenshot=page.screenshot(type="jpeg", quality=80))
            result.pages.append(PageText(url=page.url, title=data.get("title") or "", markdown=_page_markdown(page.url, data)))
            start = page.url
            for detail in _detail_urls(page, start):
                try:
                    page.goto(detail, wait_until="networkidle", timeout=15_000)
                    page.wait_for_timeout(1200)
                    sub = page.evaluate(EXTRACT_JS, MAX_TEXT // 2)
                    text = PageText(url=page.url, title=sub.get("title") or "", markdown=_page_markdown(page.url, sub))
                    result.details.append((text, _screens(page)))
                except Exception:
                    continue
            for extra in _same_site_pages(start, data.get("links") or [], data.get("nav") or []):
                try:
                    page.goto(extra, wait_until="networkidle", timeout=15_000)
                    page.wait_for_timeout(800)
                    sub = page.evaluate(EXTRACT_JS, MAX_TEXT // 3)
                    result.pages.append(PageText(url=page.url, title=sub.get("title") or "", markdown=_page_markdown(page.url, sub)))
                except Exception:
                    continue
            return result
        finally:
            browser.close()


def _read_plain(url: str) -> LinkResult:
    """Without a browser: the raw HTML as text (JavaScript-built pages come out nearly empty)."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=15) as response:
        html = response.read(3_000_000).decode(response.headers.get_content_charset() or "utf-8", errors="replace")
    title = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    body = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", html, flags=re.I | re.S)
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body)).strip()[:MAX_TEXT]
    data = {"title": title.group(1).strip() if title else "", "text": text}
    return LinkResult(url=url, title=data["title"], pages=[PageText(url=url, title=data["title"], markdown=_page_markdown(url, data))], rendered=False)


def read(url: str) -> LinkResult:
    url = check_public(url)
    try:
        return _read_with_browser(url)
    except LinkError:
        raise
    except Exception:
        try:
            return _read_plain(url)
        except Exception:
            raise LinkError("The page didn't open. It may be down, need a log-in, or block automatic visits.") from None


def slug(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    text = f"{parsed.hostname or 'site'}{parsed.path}".lower()
    return "link-" + (re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:70] or "site")


def save(folder: Path, result: LinkResult, asked_url: str) -> dict:
    """Writes link-<site>.md (+ .jpg) into the sources folder and records it in .links.json."""
    name = slug(asked_url)
    read_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    note = (
        f"# Website: {result.title or asked_url}\n\n"
        f"Gagesite opened {asked_url} on {read_at} and copied what it shows, so you can use it for the plan.\n"
        + ("" if result.rendered else "Only the raw page could be fetched (no JavaScript), so parts may be missing.\n")
        + (f"A screenshot of the first screen is in `{name}.jpg`.\n" if result.screenshot else "")
        + f"\nPages read: {len(result.pages)}\n\n"
    )
    for old in folder.glob(f"{name}-item-*.jpg"):
        old.unlink()
    item_images: list[str] = []
    item_parts: list[str] = []
    for number, (text, shots) in enumerate(result.details, 1):
        files = []
        for part, shot in enumerate(shots, 1):
            file = f"{name}-item-{number}-{part}.jpg"
            (folder / file).write_bytes(shot)
            files.append(file)
        item_images += files
        item_parts.append(
            f"# Item page {number} (one record opened from the list)\n\nScreenshots, top first: "
            + ", ".join(f"`{f}`" for f in files)
            + "\n\n"
            + text.markdown
        )
    if item_parts:
        note += f"Item pages opened from the list: {len(item_parts)}, at the end of this file, with screenshots.\n\n"
    (folder / f"{name}.md").write_text(note + "\n\n".join([p.markdown for p in result.pages] + item_parts), encoding="utf-8")
    if result.screenshot:
        (folder / f"{name}.jpg").write_bytes(result.screenshot)
    else:
        (folder / f"{name}.jpg").unlink(missing_ok=True)
    index = load_index(folder)
    index[name] = {
        "url": asked_url,
        "title": result.title,
        "pages": len(result.pages),
        "screenshot": bool(result.screenshot),
        "item_images": item_images,
        "read_at": read_at,
    }
    (folder / ".links.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"name": name, **index[name]}


def load_index(folder: Path) -> dict:
    path = folder / ".links.json"
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    except json.JSONDecodeError:
        return {}


def remove(folder: Path, name: str) -> bool:
    index = load_index(folder)
    if name not in index:
        return False
    for suffix in (".md", ".jpg"):
        (folder / f"{name}{suffix}").unlink(missing_ok=True)
    for item in folder.glob(f"{name}-item-*.jpg"):
        item.unlink()
    del index[name]
    (folder / ".links.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    return True
