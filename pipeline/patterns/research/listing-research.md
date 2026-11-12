# Research notes: LISTING pages (an overview of many items to browse and pick from)

## Scope
- Products studied: Airbnb (search results), Skedda (grid / list views of spaces),
  Robin (map + spaces list), Google Calendar (room schedules), OpenTable / Resy
  (venues with time-slot buttons; current OpenTable behaviour is contested), Linear and
  GitHub (dense lists; Primer guidance on empty and loading states).
- Research bodies: Baymard Institute (split view, product lists), Nielsen Norman Group
  (filters).
- As of: November 2026.
- Method: public research articles, help centres, design-system docs. Baymard's detailed
  list-layout data is paywalled and was not used beyond free excerpts.

## Sources
- [BAYMARD-SPLIT] Baymard, "Accommodations: use a split view":
  https://baymard.com/blog/accommodations-split-view
- [BAYMARD-PLP] Baymard, product lists research (free excerpts):
  https://baymard.com/research/ecommerce-product-lists , https://baymard.com/blog/product-listing-page-plp-ux
- [NNG-FILTERS] Nielsen Norman Group, "Filters vs. facets":
  https://www.nngroup.com/articles/filters-vs-facets/
- [PRIMER-EMPTY] GitHub Primer, Empty states: https://primer.style/product/ui-patterns/empty-states/
- [PRIMER-LOAD] GitHub Primer, Loading: https://primer.style/product/ui-patterns/loading/
- [SKEDDA-BOOK] Skedda help, "Creating bookings as a regular user":
  https://support.skedda.com/en/articles/105724-creating-bookings-as-a-regular-user
- [SKEDDA-CAL] Skedda, Booking Calendar: https://www.skedda.com/home/booking-calendar
- [ROBIN-UM] University of Michigan, Robin user guide:
  https://prod.lsa.umich.edu/technology-services/robin-user-guide/booking-a-room.html
- [LINEAR-DISPLAY] Linear docs, Display options: https://linear.app/docs/display-options
- [OT-CONTESTED] Third-party notes reporting OpenTable search results no longer show
  inline time buttons (May 2026, unverified):
  https://browse.sh/skills/opentable.com/check-availability-f2fwrm
- [AIRBNB-NOTES] Baymard Airbnb search page examples (images only, analysis paywalled):
  https://baymard.com/ecommerce-design-examples/33-search-results-page/19297-airbnb

## Findings

### Shape of a listing
- Leading listings put a short control bar (date / search / a few filters) above a
  collection of cards or rows. The collection starts within the first screen (inferred
  from Airbnb, Skedda, Robin, Linear).
- Filter bars: a horizontal filter and sort bar worked better than a vertical sidebar,
  which crowded out listing details (src: [BAYMARD-SPLIT]).
- Filters must match the dimensions users care about. Simple filters beat faceted
  navigation unless the set is large (src: [NNG-FILTERS]).
- Filtering removes irrelevant items, and sorting orders the relevant ones. Both are
  needed (src: [BAYMARD-PLP]).
- Linear separates filters (which items) from display options (how each item shows,
  grouping, ordering), which sit at the top right (src: [LINEAR-DISPLAY]).

### Cards vs rows vs grid
- Grid of cards with large images suits visually chosen items. Lists suit scanning
  specs and many items (src: [BAYMARD-PLP] secondary summaries, not Baymard's paywalled
  data; flagged as convention).
- Key decision facts (price for stays) must be on the card, with no click needed
  (src: [BAYMARD-SPLIT]).
- Airbnb results: rectangular cards with image, price, rating and key facts, with a map
  beside them (src: [AIRBNB-NOTES] plus search summary; inferred layout).
- Split view (list + map on the same page) beats a hidden map toggle for location-driven
  choices. Toggles lost filters on return (src: [BAYMARD-SPLIT]). This only matters when
  location matters (inferred). For items in one building, skip the map.

### Availability inside a listing (booking kinds)
- Skedda's Grid view shows all spaces against time at once, and its List view shows
  bookings as a list (src: [SKEDDA-CAL], [SKEDDA-BOOK]). Free time is coloured as open,
  and unavailable time is greyed with a reason on click (src: [SKEDDA-BOOK]).
- Robin lists spaces beside a map coloured by availability for the chosen date/time.
  Clicking a time slot for a room opens booking (src: [ROBIN-UM]).
- Restaurant platforms (Resy, OpenTable) historically showed a row of time-slot buttons
  under each venue in results. One third-party source reports OpenTable removed inline
  buttons in 2026 in favour of a "find next available" link (src: [OT-CONTESTED];
  unverified). The pattern of "a few next free times on each card" remains a well-known
  convention (inferred).

### States
- Empty state: title, short explanation, one action. Be specific, not "There was a
  problem" (src: [PRIMER-EMPTY]).
- No results after filtering is different from "nothing exists yet". Offer to clear
  filters (inferred).
- Loading: none under 1 s, skeletons for large areas, load collections incrementally,
  avoid layout shift (src: [PRIMER-LOAD]).

### Where products differ (and the better choice for a small business)
- Small sets (under ~12 items): show everything, no pagination, no filters or just one
  (inferred).
- Large sets: filters bar + sort + pagination or "Show more". Infinite scroll hurts
  reaching the footer and returning to position (inferred convention).
- Visual items (rooms, stays, products): cards with photo. Records (issues, orders):
  rows (inferred).
