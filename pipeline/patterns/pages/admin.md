# Page guide: ADMIN (an owner or staff member manages records: bookings, items, people)

Studied: Linear, Stripe Dashboard, Shopify admin, SAP Fiori, IBM Carbon, Atlassian

This guide covers how the leading admin tools lay out a page where someone sees every
record of one type and acts on it: all bookings, the list of rooms or products, members or
customers. The sources are Linear, the Stripe Dashboard, Shopify's admin (Polaris index
table), SAP Fiori's list report, and the Carbon and Atlassian design systems. They share
one shape: a title with one primary action, a search-and-filter bar, a table, and
editing in a panel. Follow that shape and keep it calm. A small-business admin is used a
few times a week by one or two people, so plain labels and comfortable rows beat power-
user density. Sources: `out/research/admin-research.md` (researched Nov 2026). Never copy
a product's name, logo, wording or exact look.

## Layout (desktop)
- **Admin navigation**: a left sidebar of about 220-240px, or, with only 2-4 admin pages,
  tabs under the site header. Items: one per record type ("Bookings", "Rooms", "Members"),
  with the current one highlighted. A "Back to site" or "Member view" link sits at the
  bottom or top. Admin pages never mix with member navigation.
- **Content area**: full width up to about 1200-1280px, 24-32px padding.
- **Page header**, in one row: the title (e.g. "Members", 24-28px) with a muted count
  ("24"), and on the right ONE primary button ("Add member", "Add room"). Secondary page
  actions (Export) go in a "..." menu next to it. An optional one-line description goes
  under the title only when the page needs explaining.
- **View tabs** (optional, under the header): 2-5 preset views with counts, e.g.
  "Upcoming · Today · Past · Cancelled" for bookings, "Active · Deactivated" for people,
  "Visible · Hidden" for items. Tabs are the cheapest and clearest filter.
- **Toolbar** (one row, directly above the table): a search field on the left (240-320px,
  placeholder naming what it searches: "Search by name or email"). Then 1-3 filter
  dropdowns as chips ("Room: All", "Date: This week"), and on the right a sort or
  "Display" control. Applied filters show as removable chips with "Clear all".
- **Table**:
  - Rows 48px (40px if the data is dense, 64px only for two-line rows), with header row
    height matching. Hairline row dividers. Zebra striping is optional.
  - First column is the record's name or its key fact (the member's name and email on two
    lines, the booking's date and time). It is the link that opens the record.
  - 4-7 columns. Text left-aligned, numbers and amounts right-aligned with tabular
    figures, and status as a small badge with text ("Active", "Cancelled"), never colour
    alone. Dates use one short format ("Tue 12 Nov, 14:00").
  - Column headers sort on click (arrow on the sorted column, on hover for others).
  - Last column: row actions. With 1-2 actions, show text or icon buttons inline
    ("Edit", "Cancel"). With 3 or more, use a "..." menu. Destructive items go last in the
    menu, separated, in the danger colour.
  - Header sticks when the page scrolls. The first column may stick when the table scrolls
    sideways.
- **Selection and bulk actions** (only where admins really act on many at once): a
  checkbox column. When rows are selected, a bar replaces the toolbar: "3 selected", verb +
  noun actions ("Cancel bookings", "Deactivate members"), and "Clear selection". Row actions
  are disabled while selecting.
- **Pagination** at the bottom: "1-25 of 132", Previous / Next, and an optional rows-
  per-page control. Under about 100 rows, show them all and skip pagination.

## Viewing and editing a record
- **Small records** (under about 10 fields: a room, a member): edit in a **right drawer**
  (420-560px) or a centred modal (480-640px) over the list. The title names the record
  ("Edit Room 2"). Fields are stacked one per row with labels above. The footer holds
  "Cancel" and "Save changes" on the right, primary on the right. The list stays visible
  and updates in place after saving.
- **Larger records**, or records with history: a **detail page** (`/admin/members/12`).
  It has a header with the name and status badge and primary actions top right, then
  sections (Details, Bookings, Activity), with a breadcrumb back to the list.
- **Adding** uses the same form as editing, empty, with the button "Add room" /
  "Create member".
- Save shows a short success toast ("Room 2 saved") and the row briefly highlights. Errors
  appear inline on the field, with a summary at the top of the form when there are
  several. Nothing typed is lost.
- If the panel has unsaved changes and the admin tries to close it, ask: "Discard
  changes?" with "Keep editing" / "Discard".

## Record-type specifics (patterns that recur)
- **Bookings / orders / appointments**: columns are When (date + time range), Resource,
  Booked by, Status, Created. Default view is Upcoming, sorted soonest first. Filters are
  Resource and Date range. The action is Cancel (with an optional reason sent to the
  person). Past rows are read-only.
- **Items / resources / products**: columns are Name (+ thumbnail), key attributes
  (capacity, price), Visibility (Visible / Hidden) and Updated. Prefer **Hide** over
  Delete when records have history. Hidden items vanish from public views but keep their
  bookings and orders. Delete is only allowed when nothing refers to the item, and needs
  typed or explicit confirmation.
- **People (members, staff, customers)**: columns are Name + email, Role, Status
  (Active / Deactivated), Last sign-in, Joined. Actions are Edit, Reset password,
  Deactivate (and Reactivate for deactivated people). **Deactivate, don't delete**: it can
  be reversed, ends their sessions and keeps their history. Admins cannot deactivate
  themselves or the last admin. The control is disabled with the reason.
- **Reset password**: either send a time-limited reset link ("We'll email Ana a link to
  set a new password. It expires in 1 hour.") or set a temporary password shown ONCE with
  a copy button and "Ana must change it at next sign-in". The dialog says exactly how the
  person will get in.
- **Adding a person**: name, email and role, then either "Send invite email" or
  "Set a temporary password". After adding, show what to tell the person.

## First screen
- The list itself, on the most useful default view: upcoming bookings soonest first,
  active members alphabetical, visible items in display order.
- An optional strip of 2-4 counts above the table ("Today: 5 bookings", "This week: 18")
  only if the admin actually checks those numbers. No charts for their own sake.

## States
- **Loading**: skeleton rows (5-8) in the table shape, with the header and toolbar
  already drawn. Nothing for waits under 1 second.
- **Empty, nothing created yet**: centred in the table area, a short title ("No rooms
  yet"), one line on what they're for, and the primary action ("Add your first room").
  Only shown when no records exist at all.
- **No results** (search/filter): a small message in the table body: "No members match
  'kim'" and a "Clear filters" button. Never the big first-run empty state.
- **Destructive confirmations**: a small modal (about 400-480px). The title is the action
  and the object ("Cancel this booking?"). The body says the consequence ("Ana Kim will be
  emailed that Room 2 on Tue 12 Nov, 14:00-15:00 is cancelled."). Buttons are a neutral
  "Keep booking" and a danger "Cancel booking", right-aligned with the danger button on
  the right. Bulk versions state the count ("Cancel 3 bookings?").
- **Undo**: where the action can be reversed (hide, deactivate), skip the modal and offer
  "Undo" in a toast for 5-8 seconds instead.
- **Disabled actions** explain why on hover/focus ("You can't deactivate your own
  account").
- **Errors** from the server: inline banner above the table with Retry. The table keeps
  the last good data.
- **Permissions**: a non-admin who opens an admin URL sees "You don't have access to this
  page" with a link home, never a broken page.

## Phones
- The admin works on phones, but it is designed for desktop first. Under about 768px the
  sidebar becomes a menu button, and the page header keeps the title with a compact "Add"
  button.
- Tables turn into **stacked cards**: line 1 the name or key fact, line 2 two or three
  secondary facts, a status badge top right, and a "..." menu for actions. Do not
  side-scroll a 7-column table.
- Filters collapse into a "Filters" button opening a bottom sheet. Search stays visible.
- Drawers and modals become full-screen sheets with the Save button at the bottom.

## Look (style comes from the owner; these are the conventions to keep)
- Quieter than the member-facing site: neutral surfaces, the brand colour only for the
  primary button, links, the selected nav item and focus rings. The danger colour only on
  destructive actions.
- Body and table text 14px (15-16px if the owner prefers comfort), labels 12-13px muted,
  and tabular figures for times and amounts.
- Radii 6-10px on inputs, buttons and badges, 12px on drawers and modals. Shadows only on
  drawers, modals and menus.
- Clear page titles and section headings, not decorative ones. Icons are optional and
  always paired with text in the nav.

## Motion
- Drawer slides in from the right (200-250ms), modal fades and scales from 98% (150-
  200ms), menus fade (120ms).
- A saved or added row highlights briefly (background fades out over about 1s). A
  removed row collapses (200ms).
- Easing `cubic-bezier(0.22, 1, 0.36, 1)`. No bounce. With reduced motion, use fades only.

## Accessibility
- A real `<table>` with `<th scope="col">`. Sortable headers are buttons with
  `aria-sort`. The row link is the name cell, not a click handler on the whole row (a
  whole-row click may be added for the mouse, but the name link must exist).
- Row action buttons name the record: "Edit Room 2", "Cancel booking for Ana Kim, 12
  Nov 14:00". "..." menus are labelled "More actions for Room 2".
- Drawers and modals trap focus, close on Esc and return focus to the trigger. The first
  field gets focus on open (or the safe button in a destructive dialog).
- Toasts use a polite live region and stay at least 5 seconds. Undo is keyboard-reachable.
- Status badges have text. Contrast is at least 4.5:1 for text and 3:1 for borders and
  icons.

## Looks cheap: avoid
A dashboard of decorative charts nobody asked for. Icon-only buttons without labels. A
red trash icon on every row. Delete as the default for people and items with history.
Confirm dialogs that say "Are you sure?" with OK/Cancel. A 10-column table that scrolls
sideways on a laptop. Full-page reloads after every edit. Toasts as the only error
message. Pagination for 20 rows. Admin links shown to members. A form that loses
everything on one server error.
