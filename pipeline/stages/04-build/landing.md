

# This build: a LANDING PAGE (`docs/04-setup.json` has `"setup": "landing"`)

The owner wants ONE commercial, modern landing page: the kind a funded product launches
with, not a template. It sells the business in a single scroll and drives one main
action (`brief.main_action` in the plan: book, order, sign up, call, visit). This
section overrides the rest of these instructions wherever they disagree.

## What changes
- **One page.** `docs/04-build.json` lists `/` (name "Landing page"). Add `/privacy`
  only when the page has a form. The plan's other pages become SECTIONS of `/` (a menu
  page becomes a menu section, a contact page becomes the closing contact block). Never
  build logins, accounts, admin pages, dashboards or anything behind a sign-in. If the
  plan needs those, say once in `docs/04-build.md` that they need a full website.
- **No database.** Remove Prisma exactly as in "Sites without a database". Content lives
  in `site/content/landing.json` (every heading, text, list and price on the page), so
  the owner's later changes are text edits. The form (contact, booking request,
  waitlist, quote) is a server action that sends an email through Resend when
  `RESEND_API_KEY` is set and otherwise logs it; the visitor always sees a confirmation.
- **`landing_style`** in `docs/04-setup.json` picks the showpiece: `modern`, `3d` or
  `video` (see "Showpiece" below). Missing means `modern`.

## The storyboard comes first
A Motion Director writes `docs/04-storyboard.json` (and `docs/04-storyboard.md` for the
owner) before you build, and the owner approves it. When it exists, it is your brief:
- **Concept and big idea:** carry them through the whole page.
- **Sections:** build every section in its order and at its scroll range, with exactly the
  motion it describes, its phone version and its reduced-motion state.
- **`system`:** use its decisions everywhere. Put the motion durations and easings in one
  `src/lib/motion.ts`, the layout and type scale in `@theme`, and build the components it
  lists with those names, using its interaction timing and responsive rules.

Change it only where something can't be built; say so in `docs/04-build.md`. Don't edit
the storyboard files.

## Check the motion, not just the page
After the page works (`site:check` passes), run `npm run site:motion`. It scrolls the page
like a visitor and writes contact sheets to `docs/04-motion/`: four frames per storyboard
section on desktop, the hero before and after scrolling back up, and six frames down the
page on a phone. Read every sheet with the Read tool and compare it with the storyboard:
- Does each moment really happen across its four frames: does it pin, grow, fill or change?
- Is the text readable in every frame?
- Does the hero come back the way it started?
- Does the phone version hold up?

Fix what falls short, especially moments that look flat, unchanged across the four frames,
or cluttered, then run it again. Finish only when the sheets match the storyboard.

## Who designs it
- If `docs/03-design-skipped.json` exists, the owner skipped UI Design: there are no
  tokens, components or mockups. **You are the art director.** Before any code, write
  `site/DESIGN.md`: a concept in one sentence, the palette (hex values; the owner's colours
  from `docs/03-design-kit.json` first, if any), one display font and one text font (from
  `next/font/google`; never Inter, Roboto, Arial or system fonts as the display face),
  the type scale, the radius, light or dark, the section list in order, and the
  showpiece. Use the owner's logo, photos, style notes, "avoid" list and reference
  screenshots from the design kit when present. Every later task follows `site/DESIGN.md`.
- If UI Design was done, its tokens, fonts and components are the law. Keep them, and
  apply the landing structure and polish below on top.

## The structure (choose what fits; order matters)
1. **Navigation**: sticky, slim, with a blurred translucent background once scrolled. Logo
   left, 3 to 5 anchor links to sections, the main action as a button on the right. On a
   phone: logo, the button and a menu sheet.
   An announcement bar above it is optional (a real offer, opening, or launch only).
2. **Hero** (the most important 900 pixels). A headline of 2 lines (3 at most) on a wide
   container (`max-w-5xl` or wider, `clamp()` sizing) that says what the business does
   for the visitor, a one or two line subline, the main action plus one secondary action,
   and a proof line when there is real proof (a rating the owner gave, years in business,
   customers served). The showpiece lives here. On a phone the headline and the main
   button are visible without scrolling.
3. **Trust strip**: partner logos, press, certifications or the kinds of customers served
   as a slow marquee. Only real ones from the plan or the owner's documents; otherwise
   leave it out.
4. **Features / offer**: a bento grid of 3 to 5 cards (`grid-flow-dense`, spans that
   interlock with no empty cells), each card a mix of a real photo or a crafted visual
   (a mini UI, a chart, a product shot on a soft gradient) and short, specific copy.
5. **How it works**: 3 steps, each with a visual, read left to right on desktop.
6. **Showcase**: layered product visuals, the menu or catalogue highlights, a gallery, or
   the showpiece continued by scroll (pinned section, scrubbed reveal or horizontal scroll).
7. **Results / numbers**: count-up figures. ONLY real figures from the plan or documents.
8. **Pricing** (only when the plan has prices or packages): up to 3 cards, the
   recommended one emphasised, a monthly/yearly switch only if the plan has both.
9. **Testimonials** (only quotes the owner provided): portraits, names, short quotes, as a
   carousel or a two-row marquee. Never invent reviews, names, ratings or user counts.
10. **FAQ**: an accordion of the 5 to 8 questions visitors really ask (from the plan,
    opening hours, delivery, prices, booking rules).
11. **Closing call to action**: a big, high-contrast band repeating the main action, with
    the form or contact details (address, map link, hours) when the plan has them.
12. **Footer**: logo, short line, section links, contact, social links, legal links and the
    photo credits.

## The look to aim for
Today's best motion-first landing pages (the kind collected on motionsites.ai) share a few
traits. Aim for them, in this business's own voice, and never copy any one page:
- **Cinematic, image-led hero.** One full-bleed photo, video or 3D scene carries the
  first screen, with oversized display type over it (often a short, punchy 2 to 4 word
  line like a magazine cover, then a calm subline). A dark or tinted wash keeps the text
  readable.
- **Editorial typography.** Very large, tightly set headlines (condensed or heavy grotesk,
  or an elegant serif for premium or craft businesses), mixed weights or an italic word for
  emphasis, and lots of air around them.
- **Motion that tells the story.** Animation tied to the scroll position (see "Scroll-driven
  story"): pinned chapters, words that fill as you read, media that grows to full width,
  sideways tracks. Nothing loops for the sake of looping.
- **Product as the hero.** Products, rooms, dishes or results are shown big, cut out or on
  soft backgrounds, in carousels, lookbooks or a gallery that responds to the pointer.
- **Show the real product, in real frames.** For an app, a service with an online part, or
  anything with a screen (booking, ordering, accounts, a dashboard), show its actual screens
  inside realistic device frames: phones with the notch and status bar, a laptop, or a
  browser window. Build them in code as small, real interfaces with the business's words,
  numbers and colours (a balance, a booking card, a menu, a schedule), never as icons or
  grey boxes. Fan a few out in the hero, and run a row of them as the sideways track.
- **A hero picture people remember.** Behind or beside a short headline, put one striking
  piece of art: the owner's best photo, the hero video, or an abstract 3D render made in
  code. For example, hundreds of instanced spheres twisted into a helix, soft glass shapes or
  a field of particles, lit softly in the page's colours, still or barely moving. It is the
  first impression, so give it the most care on the page.
- **One bold idea per page.** For example, a particle cloud that forms the logo, a product
  that turns as you scroll, a gallery that fans out, or a word that fills with video.
  Choose one and do it very well, rather than five small gimmicks.
- **Restraint everywhere else.** Few colours, consistent spacing, sharp details (hairline
  dividers, small caps labels, real icons) and fast loading.

## Commercial quality bar
- Look like a product launch from a top studio: generous whitespace (`py-24 md:py-32` and
  up between sections), a strong type hierarchy (display headings 48 to 96 pixels on
  desktop, tight tracking, body 16 to 18 pixels with a 1.6 line height), max 2 fonts,
  one accent colour used sparingly, and subtle depth: soft gradients, mesh or radial
  glows, fine grain, hairline borders, layered cards with soft shadows, glass only where
  it reads well.
- Motion is a **scroll-driven story** (see "Scroll-driven story" below), not sections that
  fade up as they appear. Hover lift on cards and buttons that respond are still welcome.
- Copy is specific to THIS business: real names, products, prices, places from the plan
  and documents. No lorem ipsum, no "Welcome to our website", no "revolutionise",
  no generic three-icon rows.
- Photos: the owner's photos first, then the openly licensed ones (credited), shown with
  care (consistent crop, colour treatment that fits the palette). Never stock people
  passed off as the owner's staff or customers.
- Speed and access: the hero text renders first (server components; the showpiece loads
  after it), images through `next/image` with sizes, contrast at least 4.5:1, every button
  and link reachable by keyboard with a visible focus ring, no horizontal scroll at
  375 pixels wide, and a Lighthouse-friendly page (no layout shift when the showpiece
  appears).
- Metadata: title, description, Open Graph image (a designed 1200x630 image route) and a
  favicon from the logo.

## Scroll-driven story (the owner's chosen motion for every landing page)
The page tells its story as the visitor scrolls: animation is TIED TO THE SCROLL POSITION
(GSAP ScrollTrigger with `scrub`), so it moves exactly as far as the visitor scrolls and plays
backwards when they scroll back up. This replaces "fade up as each section appears": use the
template's Reveal and Stagger at most twice on the whole page, for small details, never for
whole sections.

Build 3 to 5 of these moments (choose the ones that fit the content, spread down the page,
and never two of the same kind in a row):
1. **Hero hand-off.** As the hero scrolls away, the showpiece (photo, video, 3D scene or
   cards) scales or moves and the headline drifts up and dims, so the hero passes into the
   next section instead of simply scrolling off.
2. **Pinned chapter.** A section stays pinned (`pin: true`, 150 to 250% of the screen's
   height of scrolling) while its content changes step by step: 3 or 4 steps of "how it
   works", course levels, menu courses or rooms. Images cross-fade or slide, a progress line
   fills, and the active step's text swaps.
3. **Statement fill.** One short, strong paragraph about the business (2 to 3 lines, large
   type) whose words go from 15% to 100% opacity in reading order as it scrolls through the
   middle of the screen. Use it once.
4. **Media zoom.** A photo or the video starts as an inset, rounded card and grows to full
   width (scale or `clip-path`) as it reaches the middle of the screen, then holds.
5. **Horizontal track.** A row of cards (courses, products, gallery) pins and moves sideways
   as the visitor scrolls down. Use it only for 4 to 8 items, with a visible count or progress.
6. **Video scrub.** The hero video (or another clip) plays frame by frame with the scroll,
   forward and backward, while headlines and captions change over it. Use it only with the
   `video` showpiece; see "Video that plays with the scroll".
7. **Layered parallax.** Two or three layers (background photo, floating cards, text) move
   at different speeds through one section, with small depth and no tilt.

How to build them (all inside `src/components/scroll/`, one component per moment):
- `"use client"`, `useGSAP` from `@gsap/react`, `gsap.registerPlugin(ScrollTrigger)`, and
  everything inside `gsap.matchMedia()`:
  - **Desktop and tablet** (`(min-width: 768px) and (prefers-reduced-motion: no-preference)`):
    the full moments.
  - **Phones** (`(max-width: 767px) and (prefers-reduced-motion: no-preference)`): lighter
    versions. No horizontal pin (a swipeable row instead), pins shortened to 100 to 150%,
    and the same fills and zooms.
  - **Reduced motion:** nothing animates and everything sits in its final state.
- `scrub: 0.6` to `1` (smoothed, never jumpy); `ease: "none"` on scrubbed tweens; set start
  states with `gsap.set` INSIDE matchMedia, so content is fully visible without JavaScript,
  in screenshots and in the self-test (skip all moments when `navigator.webdriver` is true,
  like the template's `arrival.ts`).
- Keep the template's SmoothScroll (Lenis) in the layout, synced with ScrollTrigger. Call
  `ScrollTrigger.refresh()` after images and fonts load. Pinned sections must not cause
  layout shift, and anchor links must still land on the right section (header offset).
- Animate only `transform`, `opacity` and `clip-path`, never width, height or top.
- Test by scrolling down AND back up: every moment must reverse cleanly, no element may stay
  stuck half-way, and the text must be readable at every scroll position.

## Showpiece
### `modern`
A crafted hero visual without WebGL: a composition of layered, floating cards (the
product, the menu, a booking card, a stat) over a soft gradient or a large treated
photo, with gentle parallax on scroll and pointer, and one scroll-driven moment further
down (a pinned showcase or stacked cards).

### `3d`
A real-time three.js scene in the hero.
- Add `three`, `@react-three/fiber` (v9, for React 19) and `@react-three/drei` to
  `site/package.json`, plus `@types/three` in devDependencies, then `npm run site:install`.
- The scene is abstract and on-brand unless the owner gave a model. Pick ONE:
  - a glossy or glass object (a sphere, blob, torus knot or extruded logo shape) with soft
    studio lighting (`Environment` preset);
  - a particle cloud (`Points` with a few thousand points) that drifts and gathers into a
    shape that means something for the business (the logo, a product, a globe, a book)
    as the visitor scrolls.

  Either way, give it slow idle motion and a gentle reaction to the pointer and to scroll. With `docs/03-design-kit.json` `model` set, show `brand/model.glb` instead (copy it
  to `site/public/brand/`), framed and lit like a product shot.
- Load it with `next/dynamic` and `ssr: false` behind a static gradient or poster of the
  same composition, so the headline never waits. `dpr={[1, 2]}`, pause rendering when the
  hero is off-screen or the tab is hidden, a lighter scene on phones, and the static poster
  only when `prefers-reduced-motion` is set or WebGL is unavailable.
- The text stays HTML above the canvas, never inside it.
- **3D scroll:** the scene is part of the scroll-driven story, not a still backdrop. As the
  visitor scrolls, the camera moves along a planned path (a ScrollTrigger timeline that
  scrubs the camera position and target, eased between 3 to 5 stops). Each stop lines up
  with a section, for example from the outside of the place to a room, or around the
  product to one detail. Keep the canvas fixed behind the sections it serves, and fade it
  out after the last one.

### Remotion: animated scenes driven by the scroll (optional, any showpiece)
For one section that explains something step by step (how booking works, how an order is
made, the product being put together), you may use Remotion's player instead of a video
file: an animated scene written in React that renders in the browser, crisp at any size,
with the business's real words and colours.
- Add `remotion` and `@remotion/player` to `site/package.json` (the same version for both)
  and run `npm run site:install`. Write the composition in `src/remotion/` (30 fps, 4 to 8
  seconds, using `useCurrentFrame`, `interpolate` and `spring`), and show it with
  `<Player>` loaded through `next/dynamic` with `ssr: false`.
- Drive it with the scroll: pin its section and map the scroll progress to the frame
  (`playerRef.current.seekTo(frame)` in a ScrollTrigger `onUpdate`), so the animation
  plays forward and backward with the scroll. Never autoplay it in a loop.
- Phones: the same scene, shorter pin. Reduced motion: show the last frame, still.
- Note for the owner in `docs/04-build.md`: Remotion is free for individuals and companies
  of up to 3 people; larger companies need a Remotion company licence.

## Interactive touches (every landing page, 1 or 2 that fit)
Small things the visitor can play with, built with real content, never as gimmicks:
- a picker that changes what is shown (a room, a level, a size, a plan) with the details
  and price updating, linking to the main action;
- a before/after slider, a simple calculator (price, time saved) or a "find your fit" quiz
  of 2 or 3 questions;
- a 3D object or scene the visitor can turn by dragging (with a hint), when the showpiece
  is 3D.

Each one works by keyboard and touch, and the page still makes sense without it.

### `video`
A full-screen video hero, made with Google Flow (Google's AI video tool). Gagesite makes it
in the background with the owner's Flow account when they press "Make with Google Flow"
(or they upload a clip of their own). The wide clip lands in `site/public/media/hero.mp4`
and the optional phone clip in `site/public/media/hero-portrait.mp4`.
- **Decide what the video is for, before writing any prompt.** Research this kind of
  business (its leading sites in `docs/03-patterns/` and `docs/01-sources/`), then pick ONE
  job for the clip:
  - `ambient`: the mood of the place, like steam over a cup, light through a studio window
    or a calm room. Best for cafés, hotels, salons, spas, studios and craft businesses.
    6 to 8 seconds, with almost no camera motion so the headline stays readable.
  - `product`: the product turning, being made or used, for shops, makers and food.
    6 to 8 seconds, with one slow camera move.
  - `process` or `story`: the service happening (a lesson, a repair, a workout), as one
    continuous moment. 8 to 10 seconds at most. Never a sequence of cuts, which reads as
    an advert and loops badly.

  If a full-screen video doesn't suit this business, because the plan is about clarity
  more than atmosphere (prices, schedules, a technical service), still write the prompts.
  Keep them calm and `ambient`, and say in `docs/04-build.md` that a still photo would also
  work.
- **What every hero clip must be** (what good landing pages use): a short, seamless
  loop of 6 to 10 seconds (never over 10, since longer clips cost more Flow credits and
  load slower); one shot with no cuts; slow, steady motion; nothing important in the
  middle third where the headline sits; and the page's palette and light. It must have no
  text, no logos, no faces of real people, no brand names, and no sound. The page plays it
  muted. AI video invents garbled lettering on anything that usually carries words, so keep
  posters, signs, book covers, screens and labels out of frame or far out of focus.
- Write `docs/04-landing-video.json` FIRST, before building the page, so the owner can
  start a video while you build:
  `{ "kind": "ambient", "prompts": [{ "title": "Morning light", "prompt": "...", "aspect": "16:9", "seconds": 8 }, ...] }`.
  Give 2 or 3 wide (`16:9`) prompts and one phone (`9:16`) prompt for the same idea,
  framed for a tall screen. Write each one in English, in full: the subject and setting
  from this business, the shot and the one camera move, the lighting, the palette, the
  mood, and "a seamless loop: the last frame matches the first".
- Also write `docs/04-landing-video.md` for the owner: the same prompts, and that they can
  press "Make with Google Flow" on the Implementation page or make the clip themselves
  and upload it there.
- The hero uses `<video autoPlay muted loop playsInline preload="metadata">` with a
  poster, a dark or tinted overlay so the headline keeps its contrast, and the text on top.
  A server component checks whether `public/media/hero.mp4` (or `.webm`) exists, and uses
  `hero-portrait.mp4` on narrow screens when that exists too. Until a clip exists, show a
  designed fallback of the same mood (a treated photo or an animated gradient), so the page
  looks finished either way. Check at request time (`dynamic = "force-dynamic"` on the
  page, or read the folder in a route), so a video added later shows without a rebuild. With `prefers-reduced-motion`, show the poster only.
- Mention in `docs/04-build.md` whether the video is in yet.
- **Video that plays with the scroll** (when the storyboard asks for it): Gagesite also turns
  every hero clip into a frame sequence, `public/media/hero-frames/0001.webp` and onward, with
  `frames.json` giving `count`, `fps`, `width`, `height` and `pattern`. Draw it on a
  `<canvas>` (cover-fit, device-pixel-ratio aware) inside a pinned section of 200 to 300% of
  the screen's height, and map the scroll progress to the frame
  (`Math.round(progress * (count - 1))`) in a ScrollTrigger `onUpdate`. Never seek a
  `<video>`, which stutters.
  - **Loading:** preload the first frame immediately (it is also the poster), then load the
    rest in order in the background with `new Image()`. Before a frame has loaded, keep
    drawing the nearest loaded one.
  - **On top of the canvas:** text and key moments (a headline that changes at 30%, a
    caption at 70%) are HTML over the canvas, timed to the same progress.
  - **Phones:** load every second frame and use a shorter pin.
  - **Reduced motion:** show a single, well-chosen frame.
  - **Fallback:** if `frames.json` is missing, use the plain `<video>` hero described above.

## One builder, in this order
A landing page is built by ONE builder (you), not a team. Work through it in this order,
and keep `docs/04-build.json` up to date as you go:
1. **Setup.** Remove Prisma, write `site/DESIGN.md` (when the design was skipped), the
   fonts, the colours in `@theme`, `content/landing.json` and, for `3d`, the showpiece
   packages (`npm run site:install`). Run `site:typecheck`.
2. **Frame and hero.** The layout, navigation, footer, hero and showpiece. Run
   `site:check` and look at the screenshots of `/` on desktop and phone before going on:
   the hero sets the bar for everything else.
3. **Sections**, two or three at a time, each followed by `site:typecheck`.
4. **Finish.** The form, FAQ, metadata, Open Graph image and `/privacy` when there is a
   form. Then `site:build` and a final `site:check`.
5. **Review it like a tester would**, from the screenshots, and fix before you finish:
   - a hero headline over 3 lines on desktop;
   - the main action not visible on a phone without scrolling;
   - horizontal scroll;
   - invented proof (reviews, logos, numbers or counts not in the plan or documents);
   - placeholder text;
   - missing reduced-motion fallbacks;
   - sections that simply fade up instead of the scroll-driven moments, or moments that
     don't reverse cleanly when scrolling back up;
   - the headline waiting on the 3D scene or the video;
   - text over video or photos that is hard to read;
   - sections that look alike or generic.

   Then mark `/` done.
