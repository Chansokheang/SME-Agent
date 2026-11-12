---
name: gagesite-design
description: Design decided by the criteria (the kind of website, the kind of each page, researched references, the owner's brand), with motion from gpt-taste. No default template.
---

# DESIGN COMES FROM THE CRITERIA, NOT FROM A TEMPLATE
Generated websites look alike because one structure gets forced onto every page: a hero,
a bento grid, a big closing call to action, whether the page is a front page, a chatbot,
a dashboard or a list. Real products don't work that way. A chat app looks like ChatGPT
or Gemini; a lab's site leads with its research, people and papers; a portfolio leads
with the work. Design each website from these criteria, in this order:

1. **The kind of each page** (`pages[].type` in the plan) decides its LAYOUT and its states:
   `landing`, `content`, `listing`, `detail`, `chat`, `dashboard`, `form`, `docs`, `account`,
   `admin`, `auth`. Read its guide in `docs/03-patterns/page-<type>.md` (listed in
   `docs/03-patterns/index.json`) and build that page the way the leading products of
   that kind do: the layout their users already know. Only a `landing` page (or a site
   guide that asks for it) gets a hero.
2. **The kind of website** (`site_category`) decides WHAT it shows first and in what order:
   read `docs/03-patterns/site-<category>.md` when it exists.
3. **References**: the owner's own references and competitors from the plan, their linked
   sites (`docs/01-sources/link-*`) and `.design-refs/`: ideas for structure and feel,
   never copied.
4. **The owner's brand and notes**: their colours, logo, tone and "avoid" items. The
   STYLE (colours, type, shape, density, imagery) comes from here and from the business
   itself; the three styles you propose differ in style, while every page keeps the
   layout its kind calls for.
Gagesite researches a missing guide before you start, so most kinds have one. When a
page's kind or the website's kind still has no guide (`missing` in the index), use what
you know of the leading products of that kind the same way, and name them in
`inspired_by`: never fall back to a generic template look.

DO NOT USE EMOJIS IN YOUR CODE, COMMENTS, OR OUTPUT.

## QUALITY BAR (every page, every kind)
- Headings flow in 2-3 lines: give them wide containers and smaller sizes before letting
  them wrap more. Body text 16-19px, comfortable line length.
- Buttons are perfectly legible: dark background with light text, or the reverse.
- No meta-labels like "SECTION 01", "QUESTION 05", "ABOUT US" as decoration.
- Grids have no empty cells or missing corners (`grid-flow-dense` where cards vary in size).
- Real content only: no lorem ipsum, fake testimonials, awards or statistics.
- Every state is designed: empty, loading, error, success, and the phone layout.
- Wrap the page in `<main className="overflow-x-hidden w-full max-w-full">` so nothing
  causes a horizontal scrollbar.

## MOTION: gpt-taste (as written), placed by the kind of page
The motion of every website follows gpt-taste:

### ADVANCED GSAP MOTION & HOVER PHYSICS
Static interfaces are strictly forbidden. You must write real GSAP (`@gsap/react`, `ScrollTrigger`).
- **Hover Physics:** Every clickable card and image must react. Use `group-hover:scale-105 transition-transform duration-700 ease-out` inside `overflow-hidden` containers.
- **Scroll Pinning (GSAP Split):** Pin a section title on the left (`ScrollTrigger pin: true`) while a gallery of elements scrolls upwards on the right side.
- **Image Scale & Fade Scroll:** Images must start small (`scale: 0.8`). As they scroll into view, they grow to `scale: 1.0`. As they scroll out of view, they smoothly darken and fade out (`opacity: 0.2`).
- **Scrubbing Text Reveals:** Opacity of central paragraph words starts at 0.1 and scrubs to 1.0 sequentially as the user scrolls.
- **Card Stacking:** Cards overlap and stack on top of each other dynamically from the bottom as the user scrolls down.

Where each part goes, by the kind of page (the guide for that kind may add its own motion):
| Page kind | Motion |
|---|---|
| `landing`, `content` | All of it: hover physics, scroll pinning, image scale and fade, scrubbing text reveals, card stacking, where the content suits them. |
| `listing`, `detail` | Hover physics on every card and image, image scale on entry; one pinned or stacking moment on a detail page's story at most. |
| `chat` | Hover physics on buttons and source cards; new messages rise in, the answer streams in with a caret, the composer grows. Nothing pins, scrubs or fades the thread while someone reads. |
| `dashboard` | Hover physics on cards and rows; numbers count up, charts draw in once. No scroll effects on tables. |
| `form`, `auth`, `account`, `admin`, `docs` | Hover physics on buttons and choices, animated focus and results. No scroll effects around inputs or tables. |
Every motion is switched off under `prefers-reduced-motion`, and every page reads
completely with all motion off (screenshots and tests see it that way).

## CHECK BEFORE YOU SHOW IT (silently)
Each page follows its kind's guide; the website shows first what its kind calls for; the
style is the owner's; the quality bar holds; the motion is gpt-taste's, placed as above.
Your reply to the owner stays plain and short.
