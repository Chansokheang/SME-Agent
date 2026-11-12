# Research notes: ADMIN pages (manage records: bookings, items, people)

## Scope
- Products and systems studied: Linear, Stripe Dashboard, Shopify admin (Polaris index
  table), IBM Carbon (data table), Atlassian Design System (modal dialog), SAP Fiori (list
  report floorplan; page blocked to automated reads, so used only from prior knowledge,
  marked inferred), plus admin help pages from several user-management products.
- As of: November 2026.
- Method: public design-system docs, product docs and help centres. Nothing was signed into.

## Sources
- [CARBON-DT] Carbon Design System, Data table usage:
  https://carbondesignsystem.com/components/data-table/usage/
- [POLARIS-IT] Shopify Polaris, Index table (official page and package README excerpts
  via search): https://polaris.shopify.com/components/index-table ,
  https://unpkg.com/@shopify/polaris@9.14.0/src/components/IndexTable/README.md
- [SHOPIFY-INDEX] Shopify app-home index template: https://shopify.dev/docs/api/app-home/patterns/templates/index
- [ATL-MODAL] Atlassian Design System, Modal dialog usage: https://atlassian.design/components/modal-dialog/usage
- [LINEAR-DISPLAY] Linear docs, Display options: https://linear.app/docs/display-options
- [LINEAR-PEEK] Linear docs, Peek preview: https://linear.app/docs/peek
- [LINEAR-VIEWS] Linear docs, Custom views: https://linear.app/docs/custom-views
- [STRIPE-APPS] Stripe Apps design docs (drawer / ContextView / FocusView):
  https://stripe.com/docs/stripe-apps/design
- [STRIPE-DASH] Stripe Dashboard basics: https://docs.stripe.com/dashboard/basics
- [STRIPE-CUST] Stripe support, updates to the customer detail page:
  https://support.stripe.com/questions/updates-to-the-customer-detail-page
- [USERMGMT] User-management help pages (authentik, Noloco, Rocket.Chat, ThoughtFarmer,
  Deltek), via search summary: https://docs.goauthentik.io/docs/users-sources/user/user_basic_operations ,
  https://guides.noloco.io/users-and-permissions/user-management , https://docs.rocket.chat/users
- [PRIMER-EMPTY] GitHub Primer, Empty states: https://primer.style/product/ui-patterns/empty-states/
- [PRIMER-LOAD] GitHub Primer, Loading: https://primer.style/product/ui-patterns/loading/

## Findings

### Page shape
- An index (list) page shows a collection of same-type objects so the admin can act on
  them or open a full view (src: [POLARIS-IT]).
- Stripe uses list pages plus separate detail pages, and is moving all detail pages to one
  shared layout for consistency (src: [STRIPE-CUST]). Stripe also has a side drawer that
  opens beside content for side-by-side work, and a focus view for complex, single tasks
  (src: [STRIPE-APPS]).
- Linear: "Peek" previews an item in a panel from a list (Space), with J/K moving through
  the list (src: [LINEAR-PEEK]). Display options (ordering, grouping, visible fields)
  sit top right, and are separate from filters (src: [LINEAR-DISPLAY]).
- Fiori list report: a header with title, a filter bar, then a table with its own toolbar
  (create and table-level actions), with rows navigating to an object page (inferred,
  from prior knowledge of the Fiori floorplan; page not readable).
- Shared pattern: title + primary "Add" action -> search/filter bar -> table -> pagination,
  with item editing in a drawer/side panel or a detail page (inferred from all of the above).

### Tables
- Carbon row heights: 24 / 32 / 40 (default) / 48 / 64px. The header matches the row
  height, and 64px only for two-line rows (src: [CARBON-DT]). These are Carbon's specs, a
  sound convention for others.
- Toolbar above the table holds global actions, up to 5, with the rest in an overflow menu
  (src: [CARBON-DT]).
- Search: a collapsed search icon in the toolbar, or an always-open field on the left
  (src: [CARBON-DT]).
- Batch actions: a bar replaces the toolbar once rows are selected. Row actions are
  disabled during batch mode. Cancel or deselect all to exit (src: [CARBON-DT]). Polaris:
  bulk actions are for repetitive tasks across many items, labelled verb + noun
  (src: [POLARIS-IT]).
- Row actions: overflow ("...") menu per row. If a row has fewer than 3 actions, show them
  as inline buttons. Hover-only menus must stay visible on touch (src: [CARBON-DT]).
- Pagination always at the bottom, optionally with items-per-page (src: [CARBON-DT]).
- Sorting via column headers: the sorted column shows an arrow, unsorted columns show it on
  hover (src: [CARBON-DT]). Zebra striping is optional (src: [CARBON-DT]).
- Numbers right-aligned, text left-aligned (inferred convention; not covered by Carbon page).

### Filters and views
- Polaris "index filters": search, filter, sort, and save the result as a view (tabs)
  (src: [POLARIS-IT]). Linear custom views do the same (src: [LINEAR-VIEWS]).
- Stripe Customers can be filtered by email, card status, created date, etc., and has a
  search bar (src: [STRIPE-DASH] via search summary).
- For a small admin, 2-4 preset tabs (e.g. Upcoming / Today / Past / Cancelled) cover
  most needs without a filter builder (inferred).

### Empty, loading
- Empty-state structure: graphic (optional), title, short description, one primary action,
  optional "Learn more" link. Welcome first-time empty states, explain temporary ones,
  and avoid vague messages (src: [PRIMER-EMPTY]). In Shopify's template the "create your first"
  empty state appears only when no objects exist at all (src: [SHOPIFY-INDEX]); a
  filter with no results is a different, smaller message (inferred).
- Loading: no indicator under 1 s, an indeterminate one at 1-3 s, skeletons for large
  areas, and no layout shift (src: [PRIMER-LOAD]).

### Destructive actions and dialogs
- Modals are for immediate tasks needing a response. Use them sparingly (src: [ATL-MODAL]).
- The primary button label matches the title verb. Buttons sit right-aligned, primary on
  the right. Esc, the close button and clicking outside all dismiss the modal. Focus
  returns to the trigger. Never open a modal from a modal (src: [ATL-MODAL]).
- Do not use colour alone for severity (src: [ATL-MODAL]).

### People management (members, staff, customers)
- Deactivate rather than delete. It can be reversed, keeps the person's history, and ends
  their sessions (src: [USERMGMT]).
- Guardrails: admins cannot deactivate themselves or the main admin (src: [USERMGMT]).
- Password reset patterns: (a) a time-limited reset link, (b) the admin sets a temporary
  password, ideally with "must change at next sign-in", (c) self-service only. If no email
  is sent, the page must say how the person gets their login (src: [USERMGMT]).
- Disruptive actions sit behind a confirmation that explains the impact (src: [USERMGMT]).
- Lists show status (Active / Deactivated) and often last sign-in (src: [USERMGMT]).

### Where products differ (and the better choice for a small business)
- Drawer editing (Stripe drawers, Linear peek) vs full detail pages (Fiori object page,
  Stripe detail). For records with fewer than ~10 fields, a right drawer or modal form keeps
  the list in view and is faster (inferred).
- Dense power-user tables (Linear, Carbon xs/sm) vs comfortable ones (Polaris). For a
  part-time admin, 48px rows with clear labels are better (inferred).
- Saved views / filter builders (Linear, Polaris) are overkill under a few hundred rows.
  Preset tabs + search suffice (inferred).
