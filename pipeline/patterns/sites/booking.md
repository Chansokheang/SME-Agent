# Site guide: BOOKING (booking rooms, desks, appointments, classes)

Studied: Skedda, Robin, OfficeRnD, Cal.com, Calendly, Google Calendar

People come to a booking site with one question: "is the thing I want free when I need
it, and can I have it?" The leading products answer it on the first screen. Skedda opens
on a scheduler of spaces against time, Robin on a map of rooms with date and time set at the
top, Cal.com and Calendly on a calendar where only bookable dates are lit. None of them
open on a hero or a feature list. The site's job is to get people from "what's free" to
"booked" in about three taps, keep the rules visible before they bite, and show people their
own bookings in one place. Sources: `out/research/booking-research.md` (researched Nov 2026).
Never copy a product's name, logo, wording or exact look.

## What the first screen shows
- **Availability, now.** The default date is today, and the default view answers "what is
  free today" for every resource at once: a rooms-by-hours strip or grid, or one card per
  room with today's free hours as chips. For a big floor, a map does the same job. For a
  handful of rooms, a map adds nothing.
- **A date control at the top**: Today, previous/next day arrows, and a date picker. If
  there are filters (capacity, equipment), they sit in one horizontal bar next to it,
  never in a tall sidebar.
- **One obvious way to book from here**: tap a free slot, or a "Book" button on the room.
  The booking flow starts with the room and time already filled in.
- **The member's next booking**, if they have one, as a small line or card ("Next: Room 2,
  today 14:00-15:00"), linking to My bookings.
- Signed-out visitors on a members-only site see only the sign-in page, not a teaser.

## The main flow, step by step
1. **Choose**: pick a room (from the overview or its page) and a day. The date defaults
   to today. Days outside the booking window are disabled, with the reason on hover or
   tap ("Bookings open 14 days ahead").
2. **See free times**: the room's day or week as a time grid (30-minute rows are the
   convention) or a column of slot buttons. Free slots look clickable, taken ones are
   muted, and blocked ones (outside hours, too soon, admin block) are muted too and
   explain themselves when tapped.
3. **Pick**: tapping a free slot selects a start time. Then choose the length (a few duration
   choices such as 30 min / 1 h / 2 h, limited by the room's maximum and the next
   booking), or tap a second slot to set the end. Drag-to-select is a desktop bonus, never
   the only way.
4. **Confirm**: a short form next to the grid (desktop) or in a bottom sheet (phone),
   with a summary at the top ("Room 2 · Tue 12 Nov · 14:00-15:00"), then only the fields
   the venue needs (often just a title or purpose, optional). The member's name and email
   come from their account. The rules show next to the button ("Free to cancel until the
   start time"). One primary button: "Book Room 2" or "Confirm booking".
5. **Done**: an unmistakable success state in place: "Booked: Room 2, Tue 12 Nov,
   14:00-15:00", with "Add to calendar", "View my bookings" and "Cancel this booking". The
   slot on the grid changes to "Yours" immediately. A confirmation email follows.
6. **Change or cancel later** from My bookings, or from the slot itself, with a
   confirmation that names the booking.

## Navigation and structure
- **Pages a booking site has**: Sign in · Overview / resources (home) · Resource detail
  (its schedule and the booking form) · My bookings (upcoming, past) · Admin: all
  bookings, manage resources, manage members or customers · Privacy / terms. Optional:
  account settings (name, password), help / house rules.
- **Header** (56-64px): the venue's name or logo on the left. Then 2-3 links: the
  overview ("Rooms"), "My bookings", and "Admin" only for admins. The account menu is on
  the right (name, Change password, Sign out). No marketing navigation once signed in.
- **Admins** get their own section, either a header link that opens an admin area with a
  left sidebar (Bookings, Rooms, Members) or tabs. Members never see admin links.
- **Mobile**: the header collapses to logo + account, with a bottom bar or a menu for the
  2-3 main pages. The overview becomes a vertical list of rooms, each with a sideways-
  scrolling row of today's free slots. The time grid becomes one day at a time, swiped or
  stepped.
- URLs that can be shared: `/rooms/2?date=2026-11-12` opens that room on that day.

## The key components
- **Resource card / row**: name, a photo or plain tile (optional), capacity ("Seats 6"),
  2-4 equipment tags (Screen, Whiteboard), and today's availability as an hours strip or
  slot chips. "Free now" / "Busy until 15:00" is the most useful single line.
- **Availability strip** (overview): opening hours across, one row per resource, booked
  blocks filled, free gaps empty or outlined, and a thin "now" line. Tapping a gap opens
  booking with that time filled in.
- **Week grid** (detail): days as columns (7, or 5 for weekdays), time as rows (30
  minutes each, the venue's opening hours only), today highlighted, the current time line
  shown. Booked blocks show "Booked" (other members' details hidden, or only their names if
  the venue allows) and "Yours" for the member's own. Past times are shaded and not
  clickable.
- **Slot buttons** (phone, or day view): equal-width pills with the start time ("09:00",
  "09:30"...) in a 2-4 column grid. The selected one is filled. Taken ones are absent or
  struck through, never just slightly paler.
- **Date control**: Today button, arrows, a month picker that lights only bookable
  dates (the Cal.com / Calendly convention).
- **Duration picker**: 3-4 segmented options, capped by the room's maximum and by the next
  booking. Options that would overlap are disabled, with the reason.
- **Booking summary**: one line, resource · date · start-end, repeated in the form, the
  success state, the email and My bookings, always in the same format.
- **Booking list item**: date block, time range, resource, status (Upcoming / Today / Past
  / Cancelled), and a Cancel action on upcoming ones.

## States and messages
- **Loading**: a skeleton of the grid or cards. Nothing for waits under a second.
- **Nothing free today**: say so, and offer the next free time: "No free slots today.
  Next free: tomorrow 09:00." with a button.
- **Fully booked or closed day**: show the closed state ("Closed on Sundays") rather than
  an empty grid.
- **Slot taken while booking** (someone else got it first): keep the form open, mark the
  slot as taken, and suggest the nearest free times. Never fail silently or reset the form.
- **Rule limits**, shown before the button and in plain words: "Up to 2 hours per
  booking", "You can book up to 14 days ahead", "You already have 3 upcoming bookings (the
  maximum)". If a rule blocks an action, the disabled control says why.
- **Cancel**: a confirm dialog naming the booking ("Cancel Room 2, Tue 12 Nov,
  14:00-15:00?"), with buttons "Keep booking" and "Cancel booking". Afterwards the slot
  frees immediately and an undo toast shows for about 5 seconds if the rules allow it.
- **Too late to cancel or edit**: the action is disabled and explains why ("Bookings can't
  be cancelled after they start").
- **Errors**: inline, next to what failed, with Retry. The member's choices are kept.
- **Success**: in place, as described in the flow. A toast alone is not enough.
- **Hidden or deactivated resource**: it disappears from member views. Its existing
  bookings stay visible to the people who made them and to admins, marked "Room no longer
  available".

## What the leaders get right / the common mistakes to avoid
Right:
- Availability is the home page. The default date is today. The booking form arrives with
  the room and time already filled.
- Free and blocked look clearly different, and blocked time explains itself (Skedda's tap-
  for-reason pattern).
- Only bookable dates and slots are offered, so the member never meets a dead end at the
  last step.
- One summary format everywhere, and a clear way to cancel from the confirmation itself.
- Rules (window, maximum length, cancellation) are shown where the choice is made.
Mistakes:
- A month calendar as the first screen when people book for today or this week.
- Making members fill in name and email they already gave when they signed up.
- Drag-only selection, tiny slot targets, and grids that need side-scrolling on phones.
- Showing slots that then fail with "not available" at confirm.
- Hiding the rules until an error. Red error toasts that wipe the form.
- Using colour alone (green / red) for free / booked.
- Generic stock photos of meeting rooms in place of real ones, or a hero banner pushing the
  availability below the fold.

## Style: what this kind usually looks like, and where there is room to be different
- The leaders are calm and utilitarian: white or near-white surfaces, one accent colour
  for "free / selectable / yours", neutral greys for booked and past time, 8-12px
  radii, hairline grid lines, and a clear sans-serif with tabular figures for times.
- Times always in one format (24-hour or 12-hour by locale), and the time zone stated
  only if visitors may be elsewhere.
- Room to be different: real photography of the rooms, a warmer palette or a brand serif
  for headings, and friendly microcopy ("Room 2 is yours from 14:00"). A hospitality or
  coworking brand can feel more like a place than a tool, but only in the chrome (header,
  cards, photography). The grid itself stays plain and legible.
