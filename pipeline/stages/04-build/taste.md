

## Design quality, adapted (applies to every page you build)
The design rules above are how UI Design decided this website: from the kind of each page,
the kind of website, references and the owner's brand, with gpt-taste's motion. Keep the
built site at the same level: it must not slide back into templated defaults (a hero on a
tool's main screen, six-line headings in narrow columns, rows of three identical icon
cards, meta-labels like "SECTION 01", empty gaps in grids, invisible button text).

What wins, in order:
1. The approved design: `docs/03-design/pages/*.html`, `components.html` and
   `tokens.json`. Key pages match their mockups closely. Never "improve" an approved
   page into something different.
2. The owner's colours, logo, "avoid" notes and the plan.
3. The guide for each page's kind and the website's kind (`docs/03-patterns/`): every
   page without a mockup is built the way its kind is laid out there, from the same
   components, in the approved style.
4. The overrides below, then the design rules' quality bar.

Small-business overrides:
- A visitor understands in five seconds what the business is and how to do the main
  action. A tool's first screen (a chatbot, a database, a portal) is the tool itself.
- Text on a photo stays readable whatever the photo is: a solid or near-solid panel,
  or a dark gradient of at least 75% behind it; otherwise put the text beside the photo.
- Section spacing about `py-16 md:py-24` on content pages. Body text 16-19px.
- No marquees or tickers unless they carry something visitors need. Never "trusted
  partners", fake testimonials, awards or statistics.
- No picsum.photos, and no stock photo presented as the business itself; no heavy
  filters (grayscale, luminosity blend) on food, drink or product photos. Images come
  from `brand/`, the owner's chosen samples (labelled "Sample photo"), the design's
  licensed photos in `docs/03-design/imagery/` (with credits), or labelled placeholders.
- Do the design rules' checks silently. Your chat replies stay plain and short.
- Admin and owner-only pages get a simple, functional layout, but still designed:
  clear hierarchy, colour coding where the design has it, one main action per row.
- Seed data and page text are realistic for this business (believable names, titles,
  prices, dates that add up), never wireframe text like "Item 1", "Example author A"
  or sentences describing the layout.

## Motion: gpt-taste, placed by the kind of page
Motion follows the design rules' "MOTION" section exactly: real GSAP (`gsap`,
`@gsap/react` with `useGSAP`, `ScrollTrigger`) for hover physics, scroll pinning, image
scale and fade, scrubbing text reveals and card stacking, placed by the kind of each page
(full on `landing` and `content` pages; message, streaming and composer motion on `chat`;
counts and hover physics on `dashboard`; hover and focus only around forms, tables,
accounts and admin). Also follow "Motion" above for presses, results and open/close.
- Build each effect in a client component with `useGSAP` (cleaned up automatically),
  scoped to its section.
- Put every scroll effect inside `gsap.matchMedia()` under
  `(prefers-reduced-motion: no-preference)`, and skip it when `navigator.webdriver` is
  true: the self-test and screenshots must see every word and image at full strength.
  Content is visible without JavaScript: set start states (opacity 0.1, scale 0.8) from
  GSAP after mount, never in CSS or markup.
- Helpers already in `site/src/components/effects/` you may use for the common parts:
  `Reveal`, `Stagger`, `CountUp`, `Marquee`, `TiltCard`, `TextReveal`, `ParallaxImage`,
  `PinnedShowcase`, `StackedCards`, `SmoothScroll` (smooth wheel scrolling, only in the
  layout of public content pages, never around chat, admin, account or tool pages).
- If `site/package.json` lacks `gsap`, `@gsap/react` or `lenis`, add them (`gsap ^3.15.1`,
  `@gsap/react ^2.1.2`, `lenis ^1.3.27`) and run `npm run site:install`.
