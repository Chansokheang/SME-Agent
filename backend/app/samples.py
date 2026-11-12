"""Sample photos for an image item the owner has no photos for yet.

Openverse (openly licensed images, searchable by keyword, with credits) is tried first. If it is
slow or unreachable, Picsum (always available, not matched to the topic) fills in. The chosen
links are stored in the plan, so the design shows exactly the samples the owner saw.
"""

import json
import re
import urllib.parse
import urllib.request

OPENVERSE = "https://api.openverse.org/v1/images/"
USER_AGENT = "Gagesite/0.1 (website builder prototype)"


# Photos that would look wrong on someone else's business: other brands, signage and packaging,
# art pieces and events. Matched against the photo's title and tags.
REJECT = re.compile(
    r"starbucks|dunkin|dannon|nestl|nescaf|mcdonald|costa coffee|tim hortons|coca|pepsi|lavazza|illy|"
    r"kfc|burger king|subway|krispy|tchibo|logo|brand|advert|ad|billboard|packag|label|"
    r"supermarket|grocery|shelf|vending|installation|sculpture|exhibit|museum|artwork|protest|"
    r"screenshot|poster|flyer|menu board|receipt|drawing|illustration|cartoon|meme|mockup|birthday|wedding|party|"
    r"halloween|christmas|vintage|psd|png|vector",
    re.IGNORECASE,
)
MIN_WIDTH = 1000


def _score(result: dict, words: list[str]) -> int:
    """How well a photo matches the keywords (title and tags), so the most on-topic come first."""
    text = " ".join([result.get("title") or "", *[t.get("name", "") for t in result.get("tags") or []]]).lower()
    return sum(word in text for word in words)


def _openverse(keywords: str, count: int, source: str | None = None) -> list[dict]:
    words = [w for w in re.split(r"[\s,]+", keywords.lower()) if w]
    query = urllib.parse.urlencode(
        {
            "q": " ".join(words),
            "page_size": 20,
            "license_type": "commercial",
            "mature": "false",
            "category": "photograph",
            "aspect_ratio": "wide",
            **({"source": source} if source else {}),
        }
    )
    request = urllib.request.Request(f"{OPENVERSE}?{query}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=8) as response:
        results = json.load(response).get("results", [])
    usable = []
    for r in results:
        about = " ".join([r.get("title") or "", *[t.get("name", "") for t in r.get("tags") or []]])
        if not r.get("url") or REJECT.search(about) or (r.get("width") or 0) < MIN_WIDTH:
            continue
        usable.append(r)
    usable.sort(key=lambda r: _score(r, words), reverse=True)
    return [
        {
            "url": r["url"],
            "thumb": r.get("thumbnail") or r["url"],
            "credit": f'{r.get("creator") or "Unknown"}, {(r.get("license") or "").upper()} via Openverse',
        }
        for r in usable[:count]
    ]


def _picsum(keywords: str, count: int) -> list[dict]:
    seed = re.sub(r"[^a-z0-9]+", "-", keywords.lower()).strip("-") or "sample"
    return [
        {
            "url": f"https://picsum.photos/seed/{seed}-{n}/1600/1067",
            "thumb": f"https://picsum.photos/seed/{seed}-{n}/480/320",
            "credit": "Picsum Photos (Unsplash)",
        }
        for n in range(1, count + 1)
    ]


# Rawpixel's public-domain photos are professional stock shots (well lit, no logos); the rest of
# Openverse is mostly personal Flickr snapshots, so it only fills the gaps.
PREFERRED_SOURCE = "rawpixel"


def find_samples(keywords: str, count: int = 3) -> list[dict]:
    found: list[dict] = []
    # Rawpixel with every keyword, then with only the first (e.g. "coffee shop" without
    # "storefront"), and only then everything else.
    first = keywords.split(",")[0].strip()
    attempts = [(keywords, PREFERRED_SOURCE), (first, PREFERRED_SOURCE), (keywords, None)]
    for words, source in dict.fromkeys(attempts):
        try:
            for item in _openverse(words, count, source):
                if len(found) < count and item["url"] not in {f["url"] for f in found}:
                    found.append(item)
        except Exception:  # slow, offline or changed: try the next, then Picsum
            continue
        if len(found) == count:
            return found
    return found + _picsum(keywords, count)[len(found):]
