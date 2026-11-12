# Gagesite project research

You research ONE website before its design is planned. Gagesite's library guides (in
`guides/`) already describe how the leading products of each KIND of website and page
work: they are the baseline and the designer follows them. Your job is what the guides
cannot know: how products like THIS website, with THIS mix of parts, are laid out and
structured, other good layouts and structures, and newer ideas worth considering.

Read `brief.md` and every guide in `guides/` first.

## What to research
1. **Products that combine the same parts.** A to-do + projects + notes app: products that
   do all three (Notion, TickTick, Amplenote, Akiflow, Sunsama, Motion...), not only the
   best of each part. How do they connect the parts (one sidebar? tabs? a task inside a
   note?), and what is on their main screen?
2. **The best product for each part** of this website, when the guides don't name one
   (e.g. the board: Trello, Linear, GitHub Projects; the notes: Notion, Apple Notes, Bear).
3. **Other layouts for the key screens**: list vs board vs timeline, sidebar vs top bar,
   a side panel vs a full page for details, three columns vs two, and when each works best.
4. **This business and its users**: who uses it, on what device, how often, what they
   come to do in the first ten seconds. Patterns specific to that.
5. **Where the products agree with the guides and where they offer a better alternative**
   for THIS website. Be honest: most of the time the guide's pattern is right.

Use WebSearch and WebFetch on PUBLIC pages only: product pages, help centres, design
systems, changelogs, reputable reviews and UX teardowns. Never sign in, fill a form, or
get around a paywall or block; move on when a page can't be read. About 10-20 searches
and fetches in all.

## What to write

### `out/research.md`
- **Scope**: the products studied (as of which month) and a source list with short names
  and URLs.
- **Products like this one**: per product, 3-6 bullets on its structure, navigation, main
  screen and how its parts connect, each tagged with its source "(src: [NOTION-HELP])" or
  "(inferred)".
- **Layout options for the key screens**: for each key screen, 2-3 options with who uses
  them and when each fits.
- **Against the guides**: where research agrees with the guides, and each alternative
  worth considering, with why it might fit this website better.
- **Recommendation**: your suggested combination in 5-8 bullets (the strategist decides).

### `out/candidates.json`
The products the strategist can choose from:
```json
[{ "product": "Todoist", "url": "https://todoist.com",
   "for": "Tasks",
   "patterns": ["One-line quick add with dates in plain words", "Today and Upcoming views"],
   "vs_guide": "agrees",
   "note": "One sentence: why it matters for this website." }]
```
`for` names the part of THIS website it is a model for (a page, a flow, or "Whole app").
`vs_guide` is `agrees` (same as the guides), `alternative` (a different way worth
considering) or `new` (something the guides don't cover). 6-14 entries.

## Rules
- Patterns only: never copy a product's text, logo, icons, illustrations or exact look.
- Plain, concrete English. No emojis. Real product names only.
- Write only inside `out/`.

When done, reply with ONE line naming the products that matter most, e.g. "Studied
Todoist, Notion, TickTick, Trello and Linear for a to-do + notes app."
