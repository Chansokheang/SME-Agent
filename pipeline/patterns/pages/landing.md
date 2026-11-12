# Page guide: LANDING (the homepage that introduces a business and leads to its main action)

Studied: Linear, Stripe, Vercel, Lingoda

How the leading homepages are built (Linear, Stripe, Vercel, and Lingoda as a service
business), checked against NN/g's homepage, fold and carousel research. They share one
skeleton: a plain promise and two buttons at the top, proof straight after, then the offer
in consistent cards, then a closing call to action that mirrors the hero. People know this
shape; make it the owner's own through STYLE (type, colour, photography, shape), never by
breaking the skeleton. Sources: `out/research/landing-research.md` (researched Nov 2026).
Never copy a product's name, logo, wording or exact look.

## Layout (desktop)
- **Container** 1120-1280px with 24-32px side padding; text blocks inside it no wider than
  about 640-720px. Sections separated by 96-128px of space (64-80px on phones), not by
  heavy lines or alternating loud background bands. At most one or two tinted sections.
- **Announcement strip (optional)**: one line, 36-40px tall, only for something real and
  time-bound ("Spring term applications open until 28 Feb ->"). Dismissible.
- **Header**, 60-72px, sticky and slightly translucent after scrolling: logo left; 4-6 text
  links (the main offer first, e.g. Courses / Services / Menu); right: a text link (Log in
  or phone number) and ONE filled button for the main action.
- **Hero**: two layouts are standard, pick by content:
  - *Split*: text left (about 50-55%), a real photo or product image right; best for
    service businesses with good photos.
  - *Centred*: headline and buttons centred, a wide image or product view below; best when
    the visual is a product or a strong single photo.
  - Contents: an eyebrow (optional, short: location or category), a headline of 6-12 words
    saying what is offered and for whom, a 1-2 sentence subline (max about 560px wide),
    a primary button + a secondary button or text link, then a small proof line (rating
    with source, years, number of customers).
- **Proof row**: directly under the hero: 3-4 key numbers or facts in a row, or a quiet row
  of partner/client logos in grey, or both. Facts must be true and specific.
- **Offer section**: a section heading (h2) and one line, then 2-4 cards in a row, one per
  main offer: image or colour block, title, 1-2 lines, 2-3 key facts (price from, duration,
  schedule), one link. Equal heights, same anatomy.
- **Why us / how it works**: either 3 benefit cards (icon or small image, title, two
  lines) or 3-4 numbered steps showing the path from first contact to result. Alternating
  image/text rows (2-3 at most) work for a story with real photos.
- **People** (for services): the team or teachers as 3-4 portrait cards with name, role
  and one line, linking to the full page.
- **Testimonials**: 2-3 cards side by side with a short quote, full name or first name +
  initial, and what they bought or achieved. Static, no auto-rotation.
- **Fresh content (optional)**: upcoming dates, news or new offers as a dated list of 3
  items with "See all".
- **FAQ teaser**: the 4-6 most common questions as an accordion + link to the full FAQ.
- **Final call to action**: a centred heading, one line, and the same two buttons as the
  hero. Contact basics beside or under it for local businesses (address, hours, phone).
- **Footer**: 3-4 link columns (offer, company, help, legal), address, hours, phone,
  social links, privacy, business registration details, copyright.

## First screen
- Must answer, without scrolling: what this is, who it is for, where/how (for local
  businesses), and what to do next. The proof line or the top of the proof row should be
  visible on a 1366x768 laptop.
- Avoid a full-height (100vh) hero with nothing but a slogan and a scroll arrow: it looks
  like the end of the page. Let the next section peek in (hero about 70-85% of the
  viewport, or content that clearly continues).
- One primary action only. The secondary is quieter (outlined or text link), lower risk
  ("See prices", "Ask a question", "Take the level check").
- Real imagery: the actual place, people, product or work. If there are no good photos,
  use a strong typographic hero with a colour field rather than stock pictures.

## States
- **Content-driven sections** (courses, upcoming dates, news) show skeleton cards while
  loading and hide the section entirely if empty; never "No items" on a homepage.
- **Seasonal states**: when the main offer is closed (term full, holiday), the hero
  subline and button change ("Next intake opens 1 May" + "Get notified").
- **Announcement** removed automatically after its date.
- **Logged-in visitors** see the header's Log in replaced by their account menu; the hero
  stays the same (the homepage is not a dashboard).

## Phones
- Header: logo, a compact primary button, menu button opening a full-height sheet with the
  links, the primary action and contact details at the bottom.
- Hero stacks: headline (28-36px), subline, buttons full width or side by side if short,
  then the image (or the image first only if it is essential and short, max ~45vh).
- Card rows become a single column, or a horizontal scroller with the next card peeking
  (about 85% width cards) for 4+ items; proof numbers become a 2x2 grid.
- Tap targets at least 44px; phone numbers and addresses are tappable (`tel:`, map link).
- Keep total page length reasonable: 6-9 sections, not 15.

## Motion
- Hero content eases in on load (opacity + 12-16px rise, 400-600ms, 60-80ms stagger
  between headline, subline, buttons). Images fade in, no zoom bursts.
- Sections reveal once as they enter the viewport (fade + 16-24px, 400-500ms), never on
  every scroll back and never on text people are already reading.
- Hover: cards lift 2-4px with a soft shadow, buttons darken/scale 1.02, 150-200ms.
- Logo rows may scroll slowly in a loop only if they are decoration; anything people must
  read is static. No auto-rotating hero carousels, no parallax-heavy scroll-jacking, no
  scroll-pinned storytelling for a small business site.
- Easing `cubic-bezier(0.22, 1, 0.36, 1)`. With reduced motion: no transforms, content
  simply appears.

## Accessibility
- One `h1` (the hero headline); each section starts with an `h2`. Landmarks: `header`,
  `nav`, `main`, `footer`; a "Skip to content" link.
- Buttons and links named for where they go ("See all courses", not "Learn more" repeated
  six times; if "Learn more" is kept visually, add hidden context).
- Text on images needs a solid or gradient scrim reaching 4.5:1; never put body text on a
  busy photo.
- Every meaningful image has alt text; decorative ones `alt=""`.
- Accordions are real buttons with `aria-expanded`; any looping motion can be paused.
- Page title: business name + what it offers + location if local.

## What not to do
- A hero that says nothing concrete ("Your journey starts here") or three equal CTAs.
- Auto-rotating sliders, video backgrounds that hide the message, stock photos of smiling
  people in headsets.
- Walls of icon cards with generic words (Quality, Passion, Excellence).
- Fake urgency (countdowns that reset), fake numbers, anonymous five-star quotes.
- Every section a different layout and background colour; centred text paragraphs longer
  than 3 lines; tiny grey text for important facts.
- Hiding prices, location or contact behind several clicks.
- Popups on arrival (newsletter, chat bubbles that open by themselves).
