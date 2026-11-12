# Page guide: LISTING (an overview of many items to browse, compare and pick from)

Studied: Airbnb, Skedda, Robin, OpenTable, Linear, GitHub

This guide covers how the leading products lay out a page that shows many things of one
kind so someone can pick one: rooms or desks with their free times, stays, products,
classes, services. Airbnb, Skedda, Robin, OpenTable, and dense lists like Linear and
GitHub share a shape: a slim control bar on top, then a collection where each item
carries the facts needed to decide without opening it, and one clear way into the item or
straight to the action. Baymard's and Nielsen Norman Group's research backs the details.
Sources: `out/research/listing-research.md` (researched Nov 2026). Never copy a product's
name, logo, wording or exact look.

## Layout (desktop)
- **Page header** (inside the content width, about 1120-1280px, 24-32px side padding):
  a title of what is listed ("Rooms", "Classes this week"). An optional one-line subtitle
  says what the visitor can do ("Pick a room to see the week and book.").
- **Control bar**, one horizontal row directly under the header, sticky under the site
  header when scrolling long lists:
  - Left: the most important control for this kind. For anything bookable, the date
    (a "Today" button, prev / next arrows, a date picker showing "Today, Tue 12 Nov").
    For a catalogue, the search field.
  - Then 0-4 filter chips (capacity, equipment, category, price), each a dropdown.
    Applied ones show their value ("Seats: 6+"), with a "Clear" link once any is set.
  - Right: sort ("Sort: Soonest free") and, only if both are useful, a grid / list switch.
  - Filters go in this horizontal bar, NOT in a tall left sidebar, unless there are more
    than about 6 filter dimensions. A result count goes at the start of the collection
    ("3 rooms").
- **Collection**: choose the form by the kind.
  - **Cards in a grid** for visually chosen items (rooms, stays, products): 3 columns at
    1200px, 2 at tablet, 1 on phones, 24px gaps. 
  - **Rows in a list** for items chosen by facts or time (classes, appointments,
    records): full width, 64-88px tall, 1px dividers.
  - **A resource-by-time strip** for bookable resources when the set is small (up to
    about 10): one row per resource, opening hours across the top, booked blocks filled,
    free gaps open and clickable, and a "now" line. It answers "what is free today" for
    everything at a glance, the way Skedda's grid and Google Calendar's room schedules do.
    It can sit above the cards or replace them.
- **Map** only when location decides the choice (stays, venues across a city). Then use a
  split view: list left (about 55-60%), map right, sticky, pins in sync with cards on
  hover. For items in one building, no map.

## What each item shows
- **Card** (top to bottom): an image at 4:3 or 3:2 (a real photo, or a calm tinted tile
  with the item's initial or number if there is no photo), radius 12px. Name (16-18px,
  semibold). One line of key facts ("Seats 6 · Screen · Whiteboard"). The deciding fact
  for this kind:
  - **Bookable resource**: a status line ("Free now" / "Busy until 15:00" / "Fully
    booked today"), then the next 3-5 free times today as small slot chips ("10:00",
    "11:30", "14:00", "+4 more"). Tapping a chip goes straight to booking with that time
    filled in. Tapping the card goes to the item's page.
  - **Product / stay**: price (and rating if real).
  - **Class / event**: date, time and places left ("4 places left").
- **Row**: the same facts left to right: name and one-line facts, the deciding fact,
  status badge, and on the right one action ("Book", "View").
- The whole card is one link to the detail page (the name is the real link). Slot chips
  and secondary buttons inside it are separate targets, at least 32px tall and 8px apart.
- Show the deciding fact on the card. Never make people open each item to learn whether
  it is free or what it costs.

## First screen
- The header, the control bar and the first row of items must all be visible without
  scrolling on a 1280x800 laptop. No hero banner above the collection on an app-like site.
- Default to the most useful state: today for bookables, the most relevant sort
  (soonest free, or the owner's display order), and no filters applied.
- With very few items (2-6), show them all at once in a single row or two. No pagination,
  no sort, and maybe no filters at all. Don't build controls for a set that fits on one
  screen.
- An optional "your next" line above the collection for signed-in users ("Your next
  booking: Room 2, today 14:00") links to their account page.

## States
- **Loading**: skeleton cards or rows in the final shape and count (use the last known
  count, or 6). Header and control bar render immediately. No indicator for waits under
  1 second, and no layout shift when real items arrive.
- **Changing date or filters**: keep the old items visible but dimmed (opacity about 0.6)
  for the split second of reloading, then swap. Don't blank the page.
- **Nothing exists yet** (first run, usually only admins see this): a title, one line,
  and the action "Add your first room" for admins. Members see "No rooms are open for
  booking yet."
- **No results for filters**: in place of the collection, "No rooms with 10+ seats. Try
  fewer filters." plus "Clear filters". Keep the control bar so they can adjust.
- **Nothing free today** (bookables): the cards stay, each saying "Fully booked today" with
  "Next free: Wed 09:00". A banner above offers "See tomorrow".
- **Past time** on today's strip is shaded and not clickable. The "now" line moves.
- **Closed day**: one message over the collection ("Closed on Sundays. See Monday"), not
  a page of fully booked cards.
- **Error loading**: an inline message where the collection would be, with Retry. Never
  an empty page.

## Phones
- Single column. The control bar becomes one row: the date (or search) control full width,
  and a "Filters" button with a count badge ("Filters · 2") opening a bottom sheet with
  "Show 3 rooms" as its button. Sort goes inside that sheet.
- Cards go full width, with the image at 16:9 or a compact horizontal variant (thumbnail
  96px left, text right).
- Slot chips scroll sideways in one row inside the card, with the next chip half visible so
  it is clear there are more.
- The resource-by-time strip becomes a list of resources, each with its own sideways-
  scrolling row of free slots. Never a wide grid the page has to pan.
- A map, if used, becomes a "Map" toggle button floating at the bottom centre. The list
  and filters persist when switching back.

## Look (style comes from the owner; these are the conventions to keep)
- The items are the colour on the page. Surfaces neutral, cards with a hairline border
  or a very soft shadow (one or the other), radii 12-16px on cards and 8px or fully round
  on chips.
- The brand colour marks what can be acted on: free slot chips (outlined or tinted),
  selected filters, and links. Busy and past states are neutral grey with text, never
  red.
- Tabular figures for times and prices. Consistent time format across the site.
- Photos real and consistent in ratio and treatment. If a few items lack photos, use the
  tile fallback for all, rather than mixing.

## Motion
- Cards ease in on first load (fade + 8px rise, 300-400ms, 30-50ms stagger, at most the
  first 8). Re-filtering does not re-animate the whole grid. Items crossfade (150-200ms).
- Hover on a card: a slight lift (translateY -2px) or shadow deepen, 200ms, and the image
  may scale to 1.02-1.03 inside its frame. Slot chips darken or fill on hover.
- Filter sheet slides up (250ms), dropdowns fade (120ms). Easing `cubic-bezier(0.22, 1,
  0.36, 1)`. With reduced motion, no lift or scale, simple fades only.

## Accessibility
- The collection is a list (`<ul>` of `<li>`), and each card has a heading (h2/h3) with the
  name as the link. Slot chips are real buttons or links named in full ("Book Room 2 at
  10:00").
- The result count and "no results" message are announced through a polite live region
  when filters change. Focus stays on the control that was used.
- The resource-by-time strip has a text equivalent: each row's free times as a list for
  screen readers, or the strip as a table with proper headers.
- Free / busy is never colour alone: always a word ("Free", "Busy until 15:00") or a
  pattern. Contrast at least 4.5:1 for text, 3:1 for chip borders.
- Targets at least 44px on touch (chips can be 32px tall if 8px apart and in a row that is
  44px overall).

## Looks cheap: avoid
A hero banner pushing the items below the fold. A tall filter sidebar for three filters.
Cards that hide the deciding fact (free times, price) until clicked. Mixed photo ratios
and stock images. Red "Booked" stamps everywhere. Pagination for six items. Infinite
scroll that makes the footer unreachable. Blank white while loading. Filters that reset
when going back. A grid / list switch when only one layout is useful. Tiny slot chips
packed edge to edge. Re-animating every card on each filter change.
