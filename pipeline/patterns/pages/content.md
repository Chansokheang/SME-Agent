# Page guide: CONTENT (privacy policy, terms, rules, about, help article)

Studied: Google, Stripe, GitHub, Vercel, Linear, GOV.UK

How the leading products lay out a long page of text that people read selectively: the
privacy policies and terms of Google, Stripe, GitHub, Vercel and Linear, GOV.UK's
publishing components, and the reading guidance of NN/g, the U.S. Web Design System,
Canada.ca, Baymard and the UK ICO. People skim these pages for one answer ("what do you
keep about me?", "can I cancel?"), so the layout is about finding, not decoration: a
readable column, a dated title, a contents list, clear numbered sections, and a way to
ask. Sources: `out/research/content-research.md` (researched Nov 2026). Never copy a
product's name, logo, wording or exact look, and never copy another company's legal text.

## Layout (desktop)
- **The site's normal header and footer.** The footer links to every content page
  (Privacy, Terms, Cookies, Contact) on every page; that is how people find them.
- **Two columns from about 1024px wide**, centred, max total about 1040-1120px:
  - **Reading column, about 640-720px** (50-75 characters per line), left of centre.
  - **"On this page" column on the right, about 200-240px**, 48-64px gap, sticky about
    24px under the header. It lists the H2 sections (H3 only if few), one line each,
    13-14px muted text; the section in view is marked (ink colour plus a 2px bar on its
    left edge). Fixed width that does not change with link length.
  - On a site with several legal pages, an optional left list of sibling documents
    (Privacy, Terms, Cookies, about 180-200px) instead of a header dropdown; the current
    one marked and not linked.
  - Below 1024px the contents move above the body (see Phones).
- **Page head**, in the reading column, 48-64px under the header:
  - Small muted eyebrow or breadcrumb: "Legal" / "Help" (optional).
  - Title H1, 32-40px, the plain name: "Privacy policy", not a slogan.
  - One muted line directly under it: "Last updated 12 November 2026" (full date, never
    "recently"). If a new version is coming, a slim notice above the title with its date
    and a link to read it.
  - An intro of 1-3 sentences: who "we" are (business name, address or contact) and what
    the page covers.
- **Summary box (recommended for privacy and terms)**: right after the intro, a lightly
  tinted panel (radius 8-12px, padding 20-24px) titled "In short" with 4-6 plain bullets
  ("We keep your name, email and bookings.", "We never sell your data.", "Ask us to delete
  it at any time."). The big products rarely do this; regulators recommend it, and it is
  what a small business site can do better than the leaders. The full text below it
  always governs.
- **Body**:
  - Sections are H2, numbered when the page is legal ("1. What we collect"), 24-28px,
    48-64px above, 12-16px below. H3 for subsections (18-20px); avoid H4.
  - Body 16-18px, line-height 1.6-1.7, paragraphs 16-20px apart, short paragraphs (2-4
    sentences). Real lists for lists.
  - For data and rights, use small tables (what, why, how long kept) that scroll sideways
    inside themselves on phones: one table answers more than three paragraphs.
  - Defined words in bold the first time; links underlined and descriptive ("contact
    us", never "click here").
  - Each H2 has a stable anchor (`#data-we-keep`) and a small link icon on hover that
    copies its address.
- **End of page**: a "Contact us" section (who to write to, email, postal address,
  expected reply time), then "Changes to this policy" (how people are told) and, if kept,
  "Previous versions" as a short list of dated links. Then a quiet "Back to top" link.

## First screen
- Title, date, intro and the start of the summary (or the contents list on phones) are
  all visible without scrolling. No hero image, no banner, no illustration above the
  title. The text IS the page.

## Short content pages (about, simple help)
- Under about three screen heights or fewer than three sections: one column, no
  contents list, no sticky side column. Same title, date (for help and policy) and type
  rules. An image may follow the intro on an about page, inside the column width.

## States
- **Linked to a section**: the page opens scrolled to it, with the heading clear of the
  sticky header (`scroll-margin-top` = header height + 16-24px); a brief tint on the
  heading shows where you landed.
- **Long tables**: scroll inside a container with a visible edge shadow so people see
  there is more.
- **Print**: header, side columns and footer hidden; title, date and full text print in
  one column with link addresses shown after links.
- **Other languages**: a language link near the date; say which version governs.
- **Missing or placeholder content**: never publish "Lorem ipsum" or "[Company name]";
  an unfinished legal page is worse than none.

## Phones
- One column, 16-20px side padding, body 16-17px (never smaller).
- The contents list sits right after the intro (or summary) as a collapsed disclosure
  "On this page" with the sections inside; tapping a link closes it and jumps.
- Optional: a slim sticky bar under the header showing the current section name that
  opens the contents list; nothing else sticks.
- Tables scroll sideways inside themselves or become stacked label-value rows.
- "Back to top" appears as a small round button after scrolling about two screens.

## Look (style comes from the owner; these are the conventions to keep)
- Plain, quiet, high-contrast text on a plain background; the brand colour only in links,
  the current contents item and the summary panel tint.
- One readable text face (the site's UI sans, or a serif for body text if the brand uses
  one); headings in the same family or the site's display face, kept modest in size.
- Hairline rules between major sections are optional; no cards around each section, no
  shadows.

## Motion
- Smooth scroll to anchors (about 300-400ms, `cubic-bezier(0.22, 1, 0.36, 1)`); the
  heading tint fades out over about 1s.
- Current-section marker moves between items (150ms). Disclosure opens with height
  and fade (200ms). Back-to-top fades in (150ms).
- No scroll-triggered reveals of paragraphs, no parallax, nothing fading while read.
- With reduced motion: instant jumps, no tint animation.

## Accessibility
- One H1; headings in order with no skipped levels, so the outline makes sense to screen
  reader users.
- The contents list is a `nav` with `aria-label="On this page"`, a real list of links;
  the current item has `aria-current="true"`. In source order it comes before the body
  so keyboard users reach it first. After following a link, focus moves to the heading
  (give it `tabindex="-1"`).
- "Last updated" uses `<time datetime>`. Tables have header cells and a caption.
- Text contrast at least 4.5:1, links distinguishable by more than colour (underline).
- Text resizes to 200% without sideways scrolling of the body; line length holds.
- Write at plain-language level: short sentences, "we" and "you", explain any legal term.

## Looks cheap: avoid
Full-width text lines across a wide screen, tiny grey 12-13px legal text, a wall of
capital letters, no date or "last updated: 2019", a contents list on a page of three
short paragraphs, a contents list that scrolls away on a 10-section page, headings that
disappear under the sticky header when linked, accordions that hide the whole policy
(search with Ctrl+F stops working), a hero image or stock photo on a privacy page, a PDF
as the only version, copied policy text naming another company, and "click here" links.
