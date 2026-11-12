# Research notes: BOOKING sites (rooms, desks, appointments, classes)

## Scope
- Products studied: Skedda, Robin, OfficeRnD Flex, Cal.com, Calendly, Google Calendar
  (room resources). Resy and OpenTable were considered for "slot buttons per venue" in
  listings, but the evidence on OpenTable's current results page is contested (see below).
- As of: November 2026.
- Method: public help centres, product pages, developer docs and UX research write-ups.
  Robin's and OfficeRnD's own help articles returned HTTP 403 to automated reads, so
  Robin is covered through a university's public user guide and OfficeRnD through search
  summaries of its help centre. Nothing was signed into.

## Sources
- [SKEDDA-BOOK] Skedda help, "Creating bookings as a regular user":
  https://support.skedda.com/en/articles/105724-creating-bookings-as-a-regular-user
- [SKEDDA-CAL] Skedda product page, Booking Calendar: https://www.skedda.com/home/booking-calendar
- [SKEDDA-EMP] Skedda employee user guide: https://support.skedda.com/en/articles/5351844-skedda-employee-user-guide
- [SKEDDA-RULES] Skedda help on booking windows / conditions / duration guard:
  https://support.skedda.com/en/articles/112700-booking-conditions,
  https://support.skedda.com/en/articles/11688847-min-max-booking-duration-guard
- [ROBIN-UM] University of Michigan LSA, Robin user guide "Booking a room":
  https://prod.lsa.umich.edu/technology-services/robin-user-guide/booking-a-room.html
- [ROBIN-PROD] Robin room scheduling product page: https://robinpowered.com/platform/room-scheduling
- [ORND-HELP] OfficeRnD help centre, Calendar and Bookings collection (via search summaries):
  https://help.officernd.com/en/collections/610722-calendar-and-bookings,
  https://help.officernd.com/en/articles/248612-set-up-booking-privacy
- [CAL-BOOKER] Cal.com docs, Booker atom: https://cal.com/docs/atoms/booker.md
- [CAL-LAYOUTS] Cal.com blog, multiple booking layouts:
  https://cal.com/blog/enhanced-flexibility-take-advantage-of-cal-com-s-multiple-booking-layouts
- [CALENDLY-UI] Calendly blog, new scheduling page UI: https://calendly.com/blog/new-scheduling-page-ui
- [GCAL-ROOMS] Google Calendar help "Find times to meet":
  https://support.google.com/calendar/answer/6294878 and Stony Brook IT, "Booking a
  Room/Resource in Google Calendar": https://it.stonybrook.edu/help/kb/booking-a-roomresource-in-google-calendar
- [SAASUI] SaaS UI, "Calendar and scheduling UX patterns":
  https://www.saasui.design/blog/saas-calendar-scheduling-ux-patterns
- [OT-CONTESTED] Third-party automation notes on OpenTable results (unverified):
  https://browse.sh/skills/opentable.com/check-availability-f2fwrm

## Findings

### What people come to do
- Members book a known resource for a time; the core question is "what is free, when".
  Every product puts an availability view (grid, map or calendar) first, not marketing
  content (src: [SKEDDA-BOOK], [ROBIN-UM], [CAL-BOOKER]).
- Robin's web flow starts from Map with date/time and filters set at the top, and a
  Spaces list beside the map (src: [ROBIN-UM]). Skedda opens on a scheduler with Day,
  Month, Grid, List and Map views (src: [SKEDDA-BOOK]).
- For a small venue with a handful of rooms, a map adds little; a rooms-by-time grid or
  per-room cards carry the same information (inferred).

### Availability display
- Skedda: open time is shown in green, unavailable time greyed out; clicking a grey area
  explains why (outside hours, rule or policy) (src: [SKEDDA-BOOK]). Exact colours are a
  Skedda choice; the pattern is "free looks inviting and clickable, blocked looks muted,
  and blocked explains itself".
- Skedda's Grid view shows all spaces against time across days at once
  (src: [SKEDDA-CAL]); spaces as rows, time as columns, is the classic resource
  scheduler layout (inferred, also used by Google Calendar's room schedule view).
- Robin colours the map by availability and lets you click a room's time slot to open the
  booking composer (src: [ROBIN-UM]).
- Cal.com's booker highlights only dates that have free slots ("datePickerDatesActive")
  and lists the free times for the chosen date (src: [CAL-BOOKER]).
- Calendly shows monthly and daily availability on one screen: a month grid, and the
  chosen day's times beside it, which replaced a 7-day circle view and cut clicks
  (src: [CALENDLY-UI]).
- Cal.com offers three layouts: month (default), week and column; the column view is
  described by a third party as the most mobile-friendly (src: [CAL-LAYOUTS], [CAL-BOOKER]).
- Show only slots that are truly free; never expose a slot that will then fail
  (src: [SAASUI]).

### The booking step
- Skedda: click a free area (or a "+" button) to open a "New Booking" window with date,
  time, space(s), title, optional repeat, and the member's details prefilled when signed in;
  cancellation/change rules are shown at the bottom of that window (src: [SKEDDA-BOOK]).
- Robin: pick room -> "New Event" or click a slot -> composer (guests, details) -> "Book
  Now"; the booking then appears in the room's schedule and in "My Meetings"
  (src: [ROBIN-UM]).
- Cal.com booker states: loading -> selecting_date -> selecting_time -> booking ->
  success / error, with a confirm step that has Confirm and Back buttons (src: [CAL-BOOKER]).
- Calendly combines date and time choice on one page; a separate details step follows
  (src: [CALENDLY-UI]; the details step is widely observed, inferred).
- Form length: every extra field costs bookings; collect only what the venue uses
  (src: [SAASUI]-linked critiques; inferred).

### Rules, limits and conflicts
- Skedda booking windows: how far ahead and how last-minute members may book, per space
  and per user tag; "0 days in advance" means today only (src: [SKEDDA-RULES]).
- Min/max duration per space, e.g. 2h minimum / 4h maximum; buffer time between
  bookings (src: [SKEDDA-RULES]).
- When editing or cancelling is not allowed, Skedda shows a "?" that explains why
  (lock-in policy, paid booking) (src: [SKEDDA-BOOK]).
- OfficeRnD: admin "blocks" stop members booking a room/time; rooms can be limited to
  active members, specific members or admins only; an optional check-in policy
  auto-cancels unchecked bookings (src: [ORND-HELP]).
- Google Calendar rooms decline automatically when already booked (src: [GCAL-ROOMS]).
- Warn about a clash when the time is picked, not after submit (src: [SAASUI]). A
  "slot no longer available" error at confirm is a real, frustrating failure reported by
  Calendly users (src: Calendly community, via search; inferred as a must-handle state).

### After booking
- Confirmation email on create and on change (src: [SKEDDA-BOOK]).
- A clear confirmation with a path to reschedule or cancel (src: [SAASUI]).
- A "my bookings" list exists in every product (Robin "My Meetings", Skedda list view,
  OfficeRnD member portal) (src: [ROBIN-UM], [SKEDDA-BOOK], [ORND-HELP]).
- Skedda: edit by double-click or menu, drag/resize to change time; cancel from a
  menu; "end early" for a booking in progress; duplicate (src: [SKEDDA-BOOK]).

### Time zones
- Detect and label the zone wherever a time appears (src: [SAASUI]); Cal.com puts a
  time-zone selector in the event panel (src: [CAL-BOOKER]). For a single physical venue,
  showing the venue's local time only, with no selector, is simpler (inferred).

### Where products differ (and the better choice for a small business)
- Map-first (Robin, OfficeRnD floor plan) vs grid-first (Skedda) vs calendar-first
  (Cal.com, Calendly). Under ~10 rooms: grid or room cards with today's free hours; map
  only for large floors (inferred).
- Booking in a modal over the grid (Skedda, Robin composer) vs on a room page (Cal.com
  booker as its own page). A room page with week grid + inline form is easiest to link
  and to use on phones (inferred).
- Drag-to-create (Skedda) is fast on desktop but hard on touch; always offer a tap-a-slot
  path too (inferred).

### Conventions, not specs
- 30-minute slot granularity, 1-hour default length, "today" as the default date and
  green/grey free/blocked semantics are conventions across products, not standards.
