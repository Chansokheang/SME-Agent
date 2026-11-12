# Page guide: ACCOUNT (my bookings, my orders, my reservations)

Studied: Cal.com, Calendly, Airbnb, Shopify, Robin, Nexudus, Booking.com

How the leading products lay out the page where a signed-in person sees THEIR OWN records,
upcoming and past, and changes or cancels them (Cal.com Bookings, Calendly Meetings, Airbnb
Trips, Shopify customer-account Orders, Robin's schedule, the Nexudus member portal,
Booking.com "Bookings & Trips"). The pattern is settled: Upcoming first, Past behind a tab,
one item per row with the date leading, and the actions on the item itself. Follow it, and
make it the owner's own through STYLE. Sources: `out/research/account-research.md`
(researched Nov 2026). Never copy a product's name, logo, wording or exact look.

## Layout (desktop)
- **The site's normal header** (logo, the main pages, the account menu on the right with
  the person's name or initials, "My bookings" / "My orders", "Log out"). The current page
  is marked in the header. No separate account sidebar unless the account has 4+ pages
  (bookings, profile, payment, settings); then a left list of about 200-220px.
- **One centred column, about 720-880px wide**, 24px side padding, 32-48px from the header.
  This is a personal list read top to bottom, not an admin table: no wide grid, no column
  sorting, no bulk select.
- **Page head, one row**: the title on the left ("My bookings", 24-32px) and the main
  next action on the right as a primary button ("Book a room", "Make a booking"). Under
  the title, optional one muted line of context ("Bookings for Jane Lee").
- **Tabs, directly under the head**: "Upcoming" (default, selected) and "Past". Add a
  third only if the business really needs it ("Waiting for approval" when bookings need
  confirming). Show a count on Upcoming ("Upcoming 3"). Canceled items live in Past with a
  "Canceled" label, not in their own tab. Tabs are links or real tabs that keep their
  choice in the URL (`?tab=past`), so Back and refresh keep the view.
- **The list, grouped by day**: small group headings ("Today", "Tomorrow", "Thu 12 Nov",
  then dates with year in Past when not the current year). Upcoming is soonest first;
  Past is most recent first.
- **Each item, one row (64-88px) or a flat card with 16-20px padding**, 8-12px between
  items, hairline border or a tinted surface, radius 8-12px:
  - Left: the TIME as the strongest line ("10:00 - 11:30", tabular figures), the date if
    not already in the group heading.
  - Middle: what was booked ("Meeting room 2") as a link to its page, then one muted line
    of facts (place, number of people, price or "Free", booking reference).
  - A status label only when it is not the normal state: "Now" (in progress), "Waiting
    for approval", "Canceled", "Missed". One to three words, sentence case, text plus a
    tint, never colour alone. A confirmed upcoming booking needs no badge.
  - Right: the actions. One visible secondary button for the most common one ("Cancel" or
    "Change"), more in a "..." menu (add to calendar, copy details, book again). Past
    items get only "Book again" or "Details".
- **Clicking an item** opens its detail (a page or a side panel about 400-480px): all
  facts, the rules ("Free cancellation until 2 hours before"), and the same actions as
  full-width buttons. On a small site a detail is optional: the row can hold everything.
- **Page foot**: under Past, "Show more" (load 20 at a time) rather than numbered pages.
  One muted line with the rules that apply ("You can cancel up to 2 hours before the
  start.") and a contact link.

## First screen
- Upcoming opens by default and the next booking is the first thing seen. If it is today,
  it may be shown slightly larger at the top ("Next: today 14:00, Room 2") with its
  actions; everything else stays in the plain list.
- No dashboard tiles, no stats, no greeting banner, no promo. The list IS the page.

## Cancel and change
- **Cancel opens a small confirm dialog** (about 400-480px): title "Cancel this
  booking?", body restating what will be canceled in one line ("Meeting room 2, Thu 12
  Nov, 10:00 - 11:30") and what happens next ("The room becomes free for others." /
  refund line if money is involved). Buttons on the right: "Keep booking" (secondary) and
  "Cancel booking" (danger style), the danger button on the far right. Focus starts on
  the safe button. An optional reason field only if the business uses it.
- While canceling, the danger button shows a spinner and is disabled; the dialog cannot
  be closed twice. After success: the dialog closes, the row leaves Upcoming (a short
  fade and collapse), a small polite message confirms ("Booking canceled."), and focus
  moves to the next row or the tab. The item now appears in Past as "Canceled".
- **Rules shown before the click, not after**: if canceling is no longer allowed, keep
  the button visible but disabled with a short reason under it or in a tooltip ("Can't
  cancel within 2 hours of the start. Contact us."). Never hide it silently.
- **Change** goes to the booking page with the current choice preselected, or opens the
  same picker; never asks the person to cancel and rebook by hand unless the business
  forbids changes.
- Past and canceled items never show Cancel or Change.

## States
- **Loading**: 3-4 skeleton rows in the list shape (no spinner in an empty page); the
  head and tabs render at once.
- **Empty Upcoming**: one short line and the main action, centred in the list area: "No
  upcoming bookings." + "Book a room". No large illustration.
- **Empty Past**: "Your past bookings will show up here." No button needed.
- **Error loading**: an inline banner in the list area: what failed and "Try again".
  Errors from cancel appear inside the dialog, which stays open, never as a vanishing
  toast.
- **Approval or payment pending**: the row shows the status and what the person must do
  ("Waiting for approval", "Pay to confirm" with a button).
- **Session expired**: send to log in and return to the same tab afterwards.
- **Changed elsewhere**: if the booking was canceled by the business, say so in Past
  ("Canceled by <business name>"), with the reason if given.

## Phones
- One column, 16px side padding. The head stacks: title, then the primary button full
  width (or a compact button at the right of the title).
- Tabs stay at the top as a segmented control; they may stick under the header.
- Each item becomes a card: time and date on top, what was booked, facts, status, and
  the action buttons in a row at the bottom (at least 44px tall). The "..." menu opens
  as a bottom sheet. The confirm dialog becomes a bottom sheet with full-width buttons,
  the safe button on top or as the larger target.

## Look (style comes from the owner; these are the conventions to keep)
- Calm, neutral surfaces; the brand colour on the primary button, the selected tab and
  links. Status tints are small and muted; the danger colour appears only in the cancel
  dialog's button.
- Time and dates in tabular figures; body 14-16px; group headings 12-13px muted, upper or
  sentence case.
- Hairline dividers or light cards; almost no shadows (only on menus and dialogs).

## Motion
- Tab switch: the list cross-fades (150-200ms), no sliding pages.
- Canceled row: fade out and collapse height (about 250ms), the rows below move up.
- Dialog and sheets: fade and scale from 0.98 or slide up (200ms), easing
  `cubic-bezier(0.22, 1, 0.36, 1)`. Hover: a slight tint on the row, no lift on every row.
- With reduced motion: no collapse or scale, simple fades only.

## Accessibility
- One `h1` (the page title); group headings are `h2`; each item is a list item with its
  link and buttons. Tabs follow the tab pattern (arrow keys) or are plain links with
  `aria-current="page"`.
- Buttons name their item: "Cancel booking, Meeting room 2, 12 November 10:00" (visually
  "Cancel"). The "..." button is labelled "More actions for ...".
- The dialog traps focus, is named by its title, closes with Escape, and returns focus to
  a sensible place (the next row) after the item is removed.
- A polite live region announces "Booking canceled" and errors.
- Dates are written out for screen readers (`<time datetime>`); status never relies on
  colour; contrast 4.5:1 for text, 3:1 for borders and icons.

## Looks cheap: avoid
A wide admin table with every column for a personal list, a stats dashboard above three
bookings, mixing past and upcoming in one unsorted list, a red "Cancel" button on every
row, cancel without confirmation or with a browser `confirm()` box, a cancel button that
silently disappears when rules forbid it, success and error toasts that vanish before
they are read, big empty-state illustrations, badges on every row saying "Confirmed",
numbered pagination for 30 items, and dates without weekday or with ambiguous formats
(03/04).
