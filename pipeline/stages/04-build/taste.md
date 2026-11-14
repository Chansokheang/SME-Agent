

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

## How it feels to use (presses, open and close, dragging, type)
Adapted from Emil Kowalski's "apple-design" skill (MIT licence,
github.com/emilkowalski/skills), which translates Apple's interface talks for the web.
Scroll stories follow "Motion" above; these rules are for everything a visitor touches.
- **Answer the press, not the release.** Buttons, cards and links react the moment they are
  pressed (`:active` scale 0.97-0.98 in about 100ms). Nothing on the way from a tap to the
  result waits for no reason: no artificial delays, no debounce on buttons.
- **Everything can change its mind.** A menu, drawer, sheet or accordion that is opening can
  be closed again mid-way, and turns back from where it is on screen (GSAP tweens on the
  same element with `overwrite: "auto"`, or springs). Never block input while something
  animates.
- **Springs for what people touch, no bounce by default.** Opening, closing and moving UI
  (menus, sheets, tab indicators, toggles) uses a spring with no overshoot (in Motion:
  `{ type: "spring", bounce: 0, duration: 0.3 }` to `0.4`). A little bounce (`0.15` to
  `0.2`) only after a flick or a drag let go. Scroll-scrubbed moments keep their own easing.
- **Same way in, same way out.** A panel that slides in from the right leaves to the right.
  Menus, popovers and sheets grow from the button that opened them (`transform-origin` at
  that button), not from the middle of the screen.
- **Dragging feels physical** (sliders, before/after, carousels, a 3D object to turn):
  - the item stays under the finger from the point where it was grabbed
    (`setPointerCapture`, no jump to its centre);
  - about 10px of movement decides the direction before anything moves;
  - a flick carries on: it lands on the snap point nearest to where its speed would take it,
    and keeps that speed as it settles;
  - past the first or last item it gives a little and springs back, instead of stopping dead.
- **Glass only over moving content.** A blurred bar or sheet (`backdrop-filter`) sits over
  content that scrolls beneath it; never glass on glass. Text on glass is a little heavier
  and darker than elsewhere.
- **Type spacing follows size.** Display headings: negative letter-spacing (-0.01em to
  -0.03em) and tight lines (1.0 to 1.15). Body: letter-spacing 0, lines 1.5 to 1.7. Small
  labels and caps: slightly positive. Spacing in `rem`, so a visitor's larger text size
  doesn't break the layout.
- **Every comfort setting has a version:**
  - `prefers-reduced-motion: reduce`: short fades or the still final state instead of
    slides, springs and parallax, but presses and changes still show;
  - `prefers-reduced-transparency: reduce`: EVERY surface with a blur or see-through
    background becomes solid without blur, including the header, menus, sheets and
    pop-ups, not only those with a "glass" class (target `[class*="backdrop-"]` and the
    glass class together, or give every blurred surface the same class);
  - `prefers-contrast: more`: solid backgrounds with a clear border;
  - nothing large drifts or loops slowly across the whole screen.
