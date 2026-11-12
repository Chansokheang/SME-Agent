# Page guide: DASHBOARD (the home/overview page of an admin area or business tool)

Studied: Stripe Dashboard, Shopify admin, shadcn/ui, IBM Carbon

How the leading admin tools lay out their home page (Stripe Dashboard, Shopify admin, the
widely copied shadcn/ui dashboard template, IBM Carbon's dashboard guidance), checked
against NN/g and Pencil & Paper research. The shared idea: the home page answers "what
needs me now?" first, "how are we doing?" second, and gets the owner to the right list in
one click. For a small business, the to-do part matters more than charts. Sources:
`out/research/dashboard-research.md` (researched Nov 2026). Never copy a product's name,
logo, wording or exact look.

## Layout (desktop)
- **Sidebar, left, 240-280px**, a light neutral tint or white with a hairline divider.
  Top: business name/logo (and a "View site" link). Middle: navigation, Home first, then
  the record lists in order of daily use (e.g. Applications, Messages, Courses, Teachers,
  FAQ), each with an icon and, where useful, a count badge of items needing action ("3").
  Bottom: Settings, help, and the signed-in user with a menu (profile, sign out).
  Collapses to a 64px icon rail; Ctrl/Cmd+B toggles it.
- **Top bar, 48-56px**: page title ("Overview") or breadcrumb, on the right: global search
  (Ctrl/Cmd+K) when there are many records, a notifications bell with an unseen count, and
  one primary "New" action (e.g. "Add course") if creating is common.
- **Content area**: max width about 1200-1440px, 24-32px padding, 16-24px gap between
  cards. Cards: radius 8-12px, 1px border or very soft shadow, 16-24px padding, title
  top-left (14-15px semibold), period or "View all" top-right.
- **Order, top to bottom**:
  1. **Greeting line + period control** (optional): "Good morning" with today's date, and
     on the right a period selector (Today, 7 days, 30 days, This term) that applies to
     the whole page.
  2. **Needs attention**: a card or row listing what to act on, each a single line with a
     count, a short label and a link: "5 new applications to review", "2 unread messages",
     "Business English (Mar) is full", "1 course starts in 3 days with 2 seats left".
     When nothing needs attention, it says so in one quiet line ("You are all caught up").
  3. **Key numbers**: 3-4 stat cards in one row. Each: label (13-14px, muted), the
     number (28-36px, tabular figures), and a comparison line ("+4 vs last week", arrow
     + word, coloured only as a supporting cue). Each card links to the filtered list
     behind it. Pick numbers the owner acts on (new applications, accepted this period,
     seats filled / total, unread messages), not vanity counts.
  4. **Two-column zone** (about 2:1): left, the most important recent list (e.g. latest
     applications: name, item, date, status badge, quick Accept/Reject or "Review") as a
     compact table of 5-8 rows with "View all"; right, a secondary card (capacity per
     course as horizontal bars with "12 / 15", or the latest messages with sender, first
     line, time).
  5. **Trend (optional)**: one line or bar chart over the selected period, only when there
     is enough data to show a trend (weeks of activity). Clear axis, one or two series,
     tooltip on hover, no 3D, no pies.
- Everything above should fit in about one and a half screens on a laptop; deeper analysis
  belongs on other pages.

## First screen
- The "needs attention" list and the key numbers must be visible without scrolling.
- First run / no data yet: replace numbers and lists with a **setup checklist** card (e.g.
  "Add your first course", "Add teachers", "Publish your FAQ", "Check your contact
  details"), each with a status tick and a button, plus a progress line "2 of 4 done".
  Hide it once complete.
- Never a decorative hero, a welcome banner that pushes content down, or empty charts.

## States
- **Loading**: skeletons in the exact shape of each card (number bars, table rows) so the
  layout does not jump; each card loads independently.
- **Empty card**: one sentence saying what will appear and why it is empty ("No
  applications yet. They will appear here when students apply."), with a relevant action
  if one exists. Charts with no data show the message, not flat zero lines.
- **Error in one card**: message inside the card with Retry; other cards keep working.
- **Quick actions** (Accept/Reject from the list): optimistic update with an inline status
  change and an "Undo" in a small toast for 5-8 seconds; destructive or irreversible
  actions ask first in a small dialog that names the record.
- **Stale data**: show "Updated 2 min ago" with a refresh button when data is not live.
- **Notifications**: the bell opens a panel (about 360px) with the newest first, unread
  marked with a dot, "Mark all as read", each item linking to the record.

## Phones (admins do check on the go)
- Sidebar becomes a drawer from a menu button; the top bar keeps title, bell and avatar.
- Order stays the same: needs attention, then numbers (2x2 grid), then lists as stacked
  cards (name, status badge, date, one action). Charts shrink to a simple sparkline or move
  below.
- Tables never squeeze into tiny columns: on phones they turn into card lists.
- Tap targets 44px; quick actions behind a "..." menu or swipe, never tiny icon buttons.

## Look (style comes from the owner; these are the conventions to keep)
- Calm, neutral surfaces (white/very light grey, or a designed dark mode); the brand colour
  only for the primary button, active nav item, links and focus. Status colours are
  reserved for meaning (green done, amber attention, red problem, blue info) and always
  paired with words.
- Dense but readable: body 14px, line-height 1.4-1.5, table rows 44-52px, numbers with
  tabular figures. One sans family; headings at most 20-24px.
- Borders over shadows; icons outline style at 16-20px, consistent.

## Motion
- Minimal and functional: hover backgrounds 100-150ms; panels and drawers slide 200ms;
  numbers do not count up; skeleton shimmer subtle or a static pulse.
- Status changes animate the badge colour (150ms) and the row may briefly highlight.
- Easing `cubic-bezier(0.22, 1, 0.36, 1)`; reduced motion removes slides and shimmer.

## Accessibility
- Landmarks: `nav` (sidebar, labelled "Admin"), `main`; one `h1` per page; each card has a
  heading (h2) so screen reader users can jump between them.
- Stat cards are links or contain a link named with the context ("New applications: 5, view
  list"). Deltas include words ("up 4 from last week"), not only arrows or colour.
- Charts have a text alternative: a summary sentence and/or a "View as table" toggle.
- Count badges in the nav are read with the label ("Messages, 2 unread").
- Toasts announced politely (`aria-live="polite"`); Undo reachable by keyboard; focus stays
  on the list after a quick action.
- Contrast 4.5:1 for text including muted labels; 3:1 for borders, chart lines and icons.

## What not to do
- A wall of 8-12 metric tiles, gauges, donuts and 3D charts because the data exists.
- Vanity numbers with no comparison or action (total page views since launch).
- Charts for tiny volumes (three applications a week drawn as a jagged line).
- Making the owner hunt for new items: no counts in the nav, no "needs attention" area.
- Duplicating navigation inside the content, or a marketing-style hero on an admin home.
- Colour-only status, red/green as the only difference, unexplained abbreviations.
- Full-page spinners, layout jumps as cards load, toasts that are the only proof an action
  happened.
