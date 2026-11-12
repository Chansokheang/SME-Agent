# Research notes: LANDING pages (the homepage that introduces a business and leads to its main action)

Scope: homepages of Linear, Stripe, Vercel and Lingoda (a language-school homepage, for a
small-business-like service), plus NN/g homepage, fold and carousel research. Researched
November 2026.

## Sources
- [LINEAR] Linear homepage: https://linear.app/
- [STRIPE] Stripe homepage: https://stripe.com/
- [VERCEL] Vercel homepage: https://vercel.com/
- [LINGODA] Lingoda homepage: https://www.lingoda.com/en/
- [NNG-HOME] NN/g, Top 10 Guidelines for Homepage Usability: https://www.nngroup.com/articles/top-ten-guidelines-for-homepage-usability/
- [NNG-FOLD] NN/g, The Fold Manifesto: https://www.nngroup.com/articles/page-fold-manifesto/
- [NNG-CAROUSEL] NN/g, Auto-Forwarding Carousels and Accordions Annoy Users: https://www.nngroup.com/articles/auto-forwarding/

## Findings

### Hero
- One-sentence tagline that says what the business does (src: [NNG-HOME]).
- Linear: centred headline of about nine words, one-sentence subhead, a large product image
  (src: [LINEAR]). Vercel: headline, one-line subhead, three short value statements, two
  CTAs (src: [VERCEL]). Stripe: headline + subhead, two CTAs with one dark primary, logo
  strip (src: [STRIPE]). Lingoda: headline, subhead, picker + two CTAs, stats and rating
  directly underneath (src: [LINGODA]).
- Shared: exactly one primary and one secondary CTA, never three (src: [STRIPE], [VERCEL],
  [LINEAR] final CTA, [LINGODA]).
- Show real content, not just descriptions of it (src: [NNG-HOME]); Linear shows the real
  product UI as the hero visual (src: [LINEAR]).
- Meaningful photos of real people beat stock art (src: [NNG-HOME]).

### Above the fold
- The 100px just above the fold get 102% more attention than the 100px below; average
  difference about 84% (src: [NNG-FOLD]).
- Put the most interesting info at the top; avoid "false floors" such as a full-screen hero
  with only a scroll arrow (src: [NNG-FOLD]).
- Emphasise the top 1-4 tasks with clear starting points (src: [NNG-HOME]).

### Section order (shared skeleton)
- Announcement strip (optional) -> header -> hero -> logo/proof row -> value/benefit cards
  (3 across) -> feature or offer sections -> proof (testimonials with name and role, stats)
  -> what's new -> final CTA repeating the hero pair -> footer with link columns
  (src: [LINEAR], [STRIPE], [LINGODA]).
- Lingoda adds a 3-step "how it works" and an FAQ before the footer (src: [LINGODA]).
- Stripe segments by audience, with a section per segment (src: [STRIPE]); a small
  business usually has 2-4 offers, so one section per offer works the same way (inferred).
- Card modules are consistent: image, bold title, short text, one link (src: [STRIPE]).
- Linear's "changelog" list (dated entries) and Vercel's "recently shipped" cards show the
  business is alive; for a small business, "news / upcoming dates" plays that role
  (src: [LINEAR], [VERCEL]; inferred for SMB).

### Proof
- Logos, big numbers, named testimonials with role and company everywhere (src: [STRIPE]).
- Two testimonial cards side by side + a total customer count line (src: [LINEAR]).
- Stats and a rating placed directly under the hero, visible without scrolling
  (src: [LINGODA]); NN/g's university study gives the same advice for rankings and stats
  (see `education-research.md`, [NNG-UNI]).

### Things to avoid
- Auto-forwarding carousels: a key offer visible only ~20% of the time, users read motion
  as ads, accessibility harm; advance only on user request (src: [NNG-CAROUSEL]).
- Over-formatted content looks like ads and is ignored (src: [NNG-HOME], [NNG-CAROUSEL]).
- Vague link text (src: [NNG-CAROUSEL]); link names should start with the key word
  (src: [NNG-HOME]).
- Stripe's logo and news rails do loop (src: [STRIPE]); fine for decorative logos, not for
  content people must read (inferred).

### Where they differ
- SaaS leaders (Linear, Vercel) use dark or near-monochrome, product-screenshot heroes;
  Stripe uses an abstract colourful graphic; service businesses (Lingoda) use people
  photography and stats. For a local small business, a real photo of the place/people and
  concrete facts (location, hours, prices from) beat abstract art (inferred).

### Conventions vs specs
Widths (1120-1280px container), heading sizes and spacing in the guide are common web
conventions observed across these sites, not official specs.
