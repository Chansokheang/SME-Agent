# Research notes: ACCOUNT pages ("My bookings", "My orders", "My trips")

Scope: the page where a signed-in person sees THEIR OWN records (bookings, reservations,
orders) split into upcoming and past, opens one, and changes or cancels it. Products
studied: Cal.com (Bookings), Calendly (Meetings / Calendar page), Airbnb (Trips), Shopify
customer accounts (Orders), Robin (Schedule / profile reservations), Nexudus member portal
(My bookings), Booking.com (Bookings & Trips). Design-system guidance: Atlassian (modal
dialog), Shopify customer-account UX guidelines. Researched November 2026.

## Sources
- [CAL-TABS] Cal.com help, manage a booking / past bookings filtering: https://cal.com/help/bookings/manage-a-booking , https://cal.com/help/bookings/past-bookings-filtering
- [CAL-API] Cal.com API v2, get all bookings (status values, sort order): https://cal.com/docs/api-reference/v2/bookings/get-all-bookings
- [CAL-BLOG] Cal.com blog, walkthrough of the booking dashboard: https://cal.com/blog/a-complete-walkthrough-of-cal-com-s-booking-dashboard-its-key-features
- [CALENDLY-MANAGE] Calendly help, how to manage your meetings: https://calendly.com/help/how-to-manage-your-meetings
- [CALENDLY-SEARCH] Calendly help and community results on Upcoming / Past / Date range tabs and no reschedule for past events: https://calendly.com/help/introducing-the-new-meetings-page , https://community.calendly.com/how-do-i-40/accidentally-rescheduled-a-past-and-ran-event-can-i-undo-5570
- [AIRBNB-CANCEL] Airbnb help, cancel your reservation (guest): https://www.airbnb.com/help/article/169
- [AIRBNB-FIND] Airbnb help, find reservation details (upcoming, past, canceled): https://www.airbnb.com/help/article/3115
- [SHOPIFY-UX] Shopify dev, customer accounts UX guidelines: https://shopify.dev/docs/apps/build/customer-accounts/ux
- [SHOPIFY-CHANGELOG] Shopify changelog, customer accounts design uplift (June 2026): https://changelog.shopify.com/posts/customer-accounts-get-a-design-uplift
- [ROBIN] Robin support: check in to your desk, cancel a room booking: https://support.robinpowered.com/hc/en-us/articles/4405812722829-How-to-check-into-your-desk , https://support.robinpowered.com/hc/en-us/articles/37309210686861-How-to-cancel-a-room-booking-web-dashboard
- [NEXUDUS] Nexudus member portal, My bookings: https://learn.nexudus.com/member-portal/dashboard/my-bookings
- [CLUBHOUSE] Clubhouse Online, manage my bookings (cancel deadlines): https://support.clubhouseonline-e3.com/Support/Websites_Nav/Knowledgebase_Nav/Book_Mod/ManageMyBookings.aspx
- [BOOKINGCOM] Booking.com customer service and third-party guides on "Bookings & Trips": https://booking.com/customer-service.html
- [ATL-MODAL] Atlassian Design System, modal dialog usage: https://atlassian.design/components/modal-dialog/usage

Sources that could not be read: Skedda help (no public article found), Wix "My Bookings"
article (404), Polaris delete pattern (moved). Patterns were confirmed from the others.

## Findings

### Structure: upcoming first, past second
- Every product separates upcoming from past. Cal.com uses tabs Upcoming, Unconfirmed,
  Recurring, Past, Canceled (src: [CAL-TABS], [CAL-BLOG]). Calendly defaults to Upcoming
  with Past and Date range tabs, and in a newer version a single timeline grouped by date
  that scrolls from past to upcoming (src: [CALENDLY-SEARCH], [CALENDLY-MANAGE]). Airbnb
  Trips holds upcoming, past and canceled reservations (src: [AIRBNB-FIND]). Booking.com
  shows past and future reservations in "Bookings & Trips" (src: [BOOKINGCOM]).
- The default view is always Upcoming (src: [CALENDLY-SEARCH], [CAL-TABS]).
- Upcoming is sorted soonest first; Past is sorted most recent first; Canceled most
  recent first (src: [CAL-API]: upcoming lists forward from about one hour before now,
  past lists backward from now).
- Cal.com keeps a booking in Upcoming until about an hour after its start, so a meeting in
  progress does not jump to Past (src: [CAL-API]). (inferred) For room bookings, keep an
  in-progress booking in Upcoming with a "Now" label until it ends.
- Past is limited by default: Cal.com applies a "Last 7 days" filter to the Past tab only
  (src: [CAL-TABS]). (inferred) A small site can simply show the last 20-50 and a "Show
  more" button.
- Lists are grouped by date (src: [NEXUDUS], [CALENDLY-MANAGE]). (inferred) Group headings
  like "Today", "Tomorrow", "Thu 12 Nov" read better than a flat table for a member.
- Canceled bookings: Cal.com and Airbnb keep them visible (a tab or within history)
  (src: [CAL-TABS], [AIRBNB-FIND]). (inferred) On a small site, show them in Past with a
  "Canceled" label rather than a separate tab; three tabs is the most a member needs.

### Each item
- Nexudus rows show resource name, optional thumbnail, area within the resource, location,
  start and end time, price, and a status (Confirmed, Cancelled, Awaiting confirmation,
  Awaiting payment) (src: [NEXUDUS]).
- Shopify: status names one to three words, sentence case (src: [SHOPIFY-UX]); order list
  uses one card per row on mobile in a responsive grid (src: [SHOPIFY-UX]); order actions
  appear both on the list and on the order page (src: [SHOPIFY-CHANGELOG]).
- (inferred) Common item anatomy: date and time as the strongest line, then the thing
  booked (room, table, stay), then secondary facts (location, people, price), status
  label, and actions at the right end (desktop) or bottom (mobile).

### Actions and their rules
- Cancel and Reschedule are offered on upcoming items only; past items have no reschedule
  (src: [CALENDLY-SEARCH]). Cancelled bookings cannot be modified (src: [NEXUDUS]).
- Cancel options disappear once a cancellation deadline passes (src: [CLUBHOUSE]).
  (inferred) Better: keep the button visible but disabled with the reason ("Can't cancel
  within 2 hours of the start"), so people are not left wondering.
- Airbnb cancel flow: open the reservation, "Cancel reservation", choose a reason, write a
  message, confirm; refund amount can be checked before confirming (src: [AIRBNB-CANCEL]).
  (inferred) For a free member booking, a single confirm dialog is enough; a reason is
  optional.
- Calendly: cancelling notifies the other party and removes the meeting from the schedule
  (src: [CALENDLY-MANAGE]).
- Robin distinguishes "Cancel desk" from "I'm not coming in" and has check-in with
  automatic release when nobody checks in (src: [ROBIN]). Rooms: only the organiser or an
  admin may change a booking (src: [ROBIN]).
- "Book again" / "Make a booking" button on the page (src: [NEXUDUS]).

### Confirmations and feedback
- Modal title states the action; the primary button repeats the action verb ("Cancel
  booking"), primary on the right, focus returns to the trigger on close; use modals
  sparingly; don't open a dialog from a dialog (src: [ATL-MODAL]).
- Do not use toasts for errors; errors explain what went wrong and how to fix it, in a
  banner (src: [SHOPIFY-UX]).
- (inferred) Success after cancel: the item moves out of Upcoming with a short inline
  confirmation or a polite toast ("Booking canceled. The room is free again."); errors
  stay inline.

### Layout
- Shopify customer accounts: 12-column grid, one content column on mobile and tablet
  (375 / 750), two content columns from about 1000 wide; detail page split 7/5 columns
  (src: [SHOPIFY-UX]). These are Shopify conventions, not a general standard.
- (inferred) A list page of personal records works best as a single centred column of
  about 720-880px: it is read top to bottom, not scanned like an admin table.

### Numbers that are conventions, not specs
Column width 720-880px, row height 64-88px, three tabs maximum, "last 20 then Show more",
and cancel cut-off wording are synthesised conventions (inferred). Shopify breakpoints are
Shopify's own.
