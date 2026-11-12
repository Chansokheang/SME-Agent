# Research notes: DASHBOARD pages (the overview/home page of an admin or business tool)

Scope: Stripe Dashboard home, Shopify admin home, the shadcn/ui "dashboard-01" open-source
block (a widely copied template of the leaders' layout), IBM Carbon data-visualisation
guidance, plus NN/g and Pencil & Paper dashboard research. Researched November 2026.
Vercel's dashboard docs and Shopify's Polaris app-home pattern were tried but had moved or
returned nothing useful.

## Sources
- [STRIPE-DASH] Stripe Docs, Web Dashboard basics: https://docs.stripe.com/dashboard/basics
- [SHOPIFY-ADMIN] Shopify Help, Shopify admin overview: https://help.shopify.com/en/manual/shopify-admin/shopify-admin-overview
- [SHOPIFY-APP] Shopify Dev, App structure: https://shopify.dev/docs/apps/design/app-structure
- [SHADCN] shadcn/ui blocks, dashboard-01: https://ui.shadcn.com/blocks
- [CARBON] Carbon Design System, Dashboards: https://carbondesignsystem.com/data-visualization/dashboards/
- [NNG-DASH] NN/g, Dashboards: Making Charts and Graphs Easier to Understand: https://www.nngroup.com/articles/dashboards-preattentive/
- [PP-DASH] Pencil & Paper, Data dashboards UX pattern analysis: https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards

## Findings

### Shell
- Stripe: sidebar with Home, Balances, Transactions, Customers, Product catalog; a
  Shortcuts section (pinned + recently visited); Products section; Settings split into
  personal/account/product; `?` lists keyboard shortcuts (src: [STRIPE-DASH]).
- Shopify: sidebar as main navigation (orders, products, customers, analytics, marketing,
  discounts, apps, settings); global search with Ctrl/Cmd+K, results filterable by
  category; a bell opening an Alerts feed with an unseen count, mark read/unread
  (src: [SHOPIFY-ADMIN]).
- shadcn dashboard-01: inset sidebar (about 288px: spacing 72 x 4px), header 48px, then
  section cards (KPIs), an interactive area chart, then a data table (src: [SHADCN]).
  The sidebar groups (main nav, documents, secondary, user) are inferred from file names.

### Home content
- Stripe Home: analytics and charts on performance AND important notifications (unresolved
  disputes, verifications to complete); widgets the owner can add/remove (src: [STRIPE-DASH]).
- Shopify Home: real-time metrics (sales, traffic), task reminders, urgent items that link
  straight to the page to act (src: [SHOPIFY-ADMIN]).
- "Product home page" dashboards are a navigation hub with totals and deltas for each
  main section (src: [PP-DASH]); "functional" dashboards point users to where they need to
  act (src: [PP-DASH]). A small-business admin home is both (inferred).

### Layout and hierarchy
- Most important data top-left with highest contrast and largest area; F-pattern; least
  important last (src: [CARBON], [PP-DASH]).
- Order: priority items, then overview, then detail (src: [PP-DASH]).
- Fit on one screen, glanceable, minimal interaction (src: [NNG-DASH]).
- Consistent card anatomy: title top-left, date control top-right, legend bottom
  (src: [PP-DASH]). Same colour per data set throughout (src: [CARBON]).

### Numbers and charts
- Big bold numbers only for the metrics that matter; deltas consistent (relative % or
  absolute vs benchmark), shown as arrow + text or coloured icon (src: [PP-DASH]).
- Numbers without baselines (previous period, target) are hard to read (src: [PP-DASH]).
- Bars for comparison (sorted), lines for trends; avoid pies/donuts (except one dominant
  share), gauges, treemaps, 3D; colour for highlighting, not magnitude (src: [NNG-DASH]).
- Annotate peaks and averages without hiding the data (src: [CARBON]).

### Filters, states, mistakes
- Page-level filters in a fixed header; module-level filters for one card; date pickers in
  the same spot on every card (src: [PP-DASH]).
- Loading feedback when filters change; design empty states (src: [PP-DASH]).
- Mistakes: density overload, charts added because data exists, jargon without tooltips,
  colour-only meaning, no CSV export (src: [PP-DASH]).
- Don't duplicate the shell (sidebar, search) inside the content area (src: [SHOPIFY-APP]).

### Where they differ
- Stripe: chart-heavy, customisable widgets. Shopify: tasks and alerts first, then
  metrics. For a small business with low volume (tens of records a week), charts are
  sparse and noisy; a to-do list of items needing action plus a few counts is more useful
  than trend charts (inferred).

### Conventions vs specs
Pixel values (sidebar 240-288px, header 48-56px, card padding) are conventions taken from
the shadcn template and common admin UIs, not official specs from Stripe or Shopify.
