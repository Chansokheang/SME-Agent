# Research notes: CONTENT pages (privacy policy, terms, about, help articles)

Scope: long-form text pages a site must have and people read selectively: privacy policy,
terms, cookie policy, house rules, simple about or help pages. Products studied: Google
(Privacy & Terms), Stripe (Privacy Policy), GitHub (Privacy Statement, Docs), Vercel
(Privacy Notice), Linear (Privacy Policy), GOV.UK (publishing components). Guidance:
NN/g in-page links, U.S. Web Design System (USWDS) in-page navigation, Canada.ca in-page
table of contents, Baymard line length, UK ICO layered privacy information. Researched
November 2026.

## Sources
- [GOOGLE-PRIV] Google Privacy Policy: https://policies.google.com/privacy
- [STRIPE-PRIV] Stripe Privacy Policy: https://stripe.com/privacy
- [GITHUB-PRIV] GitHub General Privacy Statement: https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement
- [VERCEL-PRIV] Vercel Privacy Notice: https://vercel.com/legal/privacy-policy
- [LINEAR-PRIV] Linear Privacy Policy: https://linear.app/privacy
- [GOVUK-CL] GOV.UK publishing design guide, contents list: https://design-guide.publishing.service.gov.uk/components/content-list , https://components.publishing.service.gov.uk/component-guide/contents_list
- [NNG-INPAGE] NN/g, in-page links for content navigation: https://www.nngroup.com/articles/in-page-links-content-navigation/
- [USWDS-IPN] USWDS in-page navigation: https://designsystem.digital.gov/components/in-page-navigation/
- [CANADA-TOC] Canada.ca design, in-page table of contents: https://design.canada.ca/common-design-patterns/in-page-toc.html
- [BAYMARD-LL] Baymard, line length readability: https://baymard.com/blog/line-length-readability
- [ICO-LAYERED] UK ICO, what methods can we use to provide privacy information (read via search summaries; the page itself returned 403): https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-methods-can-we-use-to-provide-privacy-information/

Note: the Linear page contained text addressed to AI agents; it was ignored and only the
page structure was used.

## Findings

### Page head
- Title (H1) then the date directly under it: "Last updated" (Stripe, Vercel) or
  "Effective date" (GitHub, Linear) (src: [STRIPE-PRIV], [VERCEL-PRIV], [GITHUB-PRIV],
  [LINEAR-PRIV]). Google puts the effective date in a bar with links to archived versions
  and a PDF download (src: [GOOGLE-PRIV]).
- Stripe shows a notice above the title when an update is coming, linking to a preview
  (src: [STRIPE-PRIV]).
- Previous versions are offered: Google (archive link), Vercel (Previous Versions list of
  PDFs at the end) (src: [GOOGLE-PRIV], [VERCEL-PRIV]).
- A short introduction precedes the sections; Stripe adds a "Defined terms" glossary
  before the contents (src: [STRIPE-PRIV], [LINEAR-PRIV]).

### Contents list
- Stripe (10 numbered entries), Linear (10 numbered), Vercel ("On this page", 16 numbered
  with nested items) and Google all give a linked contents list; GitHub does not
  (src: [STRIPE-PRIV], [LINEAR-PRIV], [VERCEL-PRIV], [GOOGLE-PRIV], [GITHUB-PRIV]).
- Use it for long pages; on short pages it adds length (src: [NNG-INPAGE]). USWDS: use
  for three or more sections or content longer than about three screen heights
  (src: [USWDS-IPN]).
- Label it clearly: "On this page" / "Contents" (src: [NNG-INPAGE], [USWDS-IPN]).
- Placement: sticky beside the content, on the right in left-to-right languages, fixed
  width, current section highlighted while scrolling; includes H2 (and optionally H3),
  never the H1 (src: [USWDS-IPN]). Below the H1 and intro, before the content, when not
  beside it (src: [CANADA-TOC]). On mobile at the top of the content (src: [NNG-INPAGE]).
- Accessibility: a navigation landmark with a label; one level of nesting at most; hide
  decorative dash markers from screen readers; numbered links need a space between number
  and text; after following a link, keyboard focus moves to the section
  (src: [GOVUK-CL], [USWDS-IPN]).

### Body
- H2 for main sections, H3 for subsections, H4 rarely; sections numbered in Stripe,
  Linear and Vercel (src: [STRIPE-PRIV], [LINEAR-PRIV], [VERCEL-PRIV]).
- Repeated templates per data category (what is collected, who it is shared with)
  (src: [LINEAR-PRIV]); tables for legal bases and state rights (src: [VERCEL-PRIV]).
- Google adds expandable key-term definitions and "go to your settings" links inside the
  text (src: [GOOGLE-PRIV]).
- Body line length 50-75 characters (src: [BAYMARD-LL]); about 66 is a common target
  (convention).

### Plain language and layering
- The ICO recommends a layered approach: a short first layer with who you are and how
  data is used, and the full detail behind it; long single notices overwhelm people
  (src: [ICO-LAYERED]). (inferred) On a small business site this becomes a "Summary"
  box of 4-6 plain bullets at the top of the policy.
- (inferred) The big products rarely offer a summary (GitHub, Linear, Stripe have none);
  a summary is a place where a small site can do better than the leaders.

### End of page
- A "Contact us" section near the end with an email and postal address
  (src: [GITHUB-PRIV], [LINEAR-PRIV], [VERCEL-PRIV]).
- Language selector and back-to-top control (src: [GOOGLE-PRIV], [STRIPE-PRIV]).
- Related legal pages: Stripe uses a dropdown in the head listing sibling documents;
  Google a left navigation of policies (src: [STRIPE-PRIV], [GOOGLE-PRIV]).

### Numbers that are conventions, not specs
Column 640-720px, body 16-18px with line-height 1.6-1.7, contents column 200-240px,
scroll offset equal to the sticky header height plus 16-24px, and the "summary box"
are synthesised conventions (inferred). The 50-75 character range is Baymard's.
