# Page guide: BOARD (cards in columns, moved by dragging)

Studied: Trello, Linear, GitHub Projects, Jira, Todoist, Asana

How the leading tools lay out a kanban board (Trello, Linear's board layout, GitHub
Projects, Jira boards, Todoist Boards, Asana's board view), with the drag-and-drop rules
from the Atlassian Design System. People already know this layout: columns left to right
in the order work flows, short cards, counts in the headers. Follow it, then make it the
owner's own through STYLE. Sources: `out/research/board-research.md` (researched Nov
2026). Never copy a product's name, logo, wording or exact look.

## Layout (desktop)
- **Page header (sticky)**: the project or board name on the left with a List | Board
  switch; on the right, Filter, Display (which fields show on cards, group by, hide empty
  columns), member avatars, and a primary "Add task" button.
- **Active filters** as removable chips in a slim row under the header ("Assignee: Me x",
  "Clear all"), only when there are some.
- **The board area** fills the rest of the screen and **scrolls sideways**; each column
  scrolls down on its own; the page itself never scrolls vertically.
  - Padding 16-24px around the board, **12-16px between columns**.
  - **Columns 272-320px wide**, fixed width (never squeezed to fit). A very light tinted
    background with 8-12px radius, or no background with just the header.
  - Typical columns: To do, In progress, Done (owner can rename, add, reorder).
- **Column header (40-44px)**: a small status dot or icon, the name (semibold), the count
  in muted text ("4"; "5 / 4" in warning colour when a limit is set and passed), then on
  the right a "+" (add at top) and "..." (rename, set limit, collapse, hide, delete).
- **Cards**, stacked with 8px gaps, padding 10-12px, radius 6-10px, white on the tinted
  column, hairline border or a 1px shadow:
  1. Labels as small pills (optional, max 3, then "+2").
  2. Title, 13-14px, up to 3 lines then truncate.
  3. A footer row of 12px muted meta: due date (red if overdue, warning if due within a
     day, green check if done), priority mark, subtask progress "2/5", comment count,
     and the assignee avatar (20-24px) at the right.
  No description, no buttons, no form fields on the card.
- **"+ Add task"** as a quiet text button at the bottom of each column; it becomes an
  inline card-shaped field (title only), Enter adds and keeps it open, Esc closes.
- **After the last column**: "+ Add column" as a ghost column (only for people allowed to
  change the board).
- **Done column**: shows the most recent 10-20, then "Show 32 more"; optional "Archive
  done tasks" in its menu. Collapsible to a slim vertical strip with name and count.

## Opening a card
Click (or Enter on a focused card) opens the task in the right-side panel described in
`pages/detail.md`; the board stays visible, slightly narrowed or under the panel, and the
open card is highlighted. Hover + Space can show a quick preview.

## Dragging
- The whole card is the drag source (cursor: grab on hover). Pressing starts the drag
  after a 4-6px move (or a 200-250ms long press on touch), so clicks still open the card.
- **The card being dragged**: a copy follows the pointer at the grab point, a little
  raised (stronger shadow), NOT rotated; the original place shows a placeholder of the
  same height (or the original card at about 40% opacity).
- **Where it will land**: a 2px accent line in the middle of the gap between two cards; in
  an empty column, the whole column tints instead. Only show a target where the drop will
  work.
- The board auto-scrolls sideways near the left and right edges, and a column auto-scrolls
  near its top and bottom.
- **On drop**: the card settles into place (150-200ms), the change applies immediately and
  saves in the background; the card's background flashes softly for about 700ms. If saving
  fails, the card goes back and a short message says "Couldn't move the task. Try again".
- **Several cards**: select with Shift/Cmd+click; dragging shows a small stack with a count.
- **When sorted** (by due date, priority): cards can move between columns but not reorder
  within one; a chip "Sorted by Due date" with an x explains why.
- Columns can be reordered by dragging their header (owners only).

## Moving without dragging (required)
- Each card has "..." (on hover, focus, and always on touch) with "Move to" > the columns,
  "Move to top", "Move to bottom", plus Assign, Set due date, Delete.
- Keyboard: arrow keys move focus between cards and columns; Space lifts a card, arrows
  move it (Left/Right between columns, Up/Down within), Space drops, Esc cancels. A
  shortcut (e.g. S for status) opens the column picker.

## States
- **Loading**: column headers plus 2-3 grey card shapes each; real data replaces them in
  place.
- **Empty board**: the default columns appear with "+ Add task" in the first one focused
  and one line of help: "Add tasks and drag them across as work moves forward".
- **Empty column**: a dashed or lightly tinted area "No tasks", still a drop target.
- **Filtered to nothing**: columns stay; one message above "No tasks match these filters"
  with "Clear filters".
- **Live updates**: a card moved by a teammate glides to its new place and flashes; a new
  card fades in. Never reload the whole board.
- **Over a limit**: header count in warning colour; never block the drop.
- **Many cards**: virtualise long columns; keep each column's scroll position when the
  panel opens and closes.

## Phones and narrow screens
- Below about 768px the board shows **one column at a time, full width**, with a tabs row
  at the top ("To do 4 | In progress 2 | Done 9") and sideways swipe between columns
  (scroll snapping).
- Moving is done through the card's "Move to" menu or a long press that opens the same
  menu; long-press dragging across columns is optional, never the only way.
- The "+" floating button adds to the visible column. The task panel opens full screen.
- Tablets: show 2-3 columns with sideways scroll and snap.

## Motion
- Lift on drag start: shadow grows, scale 1.02 at most (150ms). Settle on drop with
  `cubic-bezier(0.22, 1, 0.36, 1)`, 150-200ms. Other cards slide apart smoothly to make
  room (150ms).
- Card hover: border or shadow strengthens slightly (150ms); no jumping.
- Column collapse/expand: width animates (200ms).
- With reduced motion: no sliding or scaling; cards jump to their new places with a fade.

## Accessibility
- Each column is a labelled `region` (or `group`) "In progress, 2 tasks"; cards are list
  items with a button or link name that includes the title and key facts ("Send invoice,
  due Friday, assigned to Kim").
- A polite live region announces drag steps: "Picked up Send invoice. In To do, position 2
  of 5." / "Moved to In progress, position 1 of 3." / "Move cancelled." / "Dropped in
  Done."
- Focus stays on the moved card after a move. Visible focus ring on cards and columns.
- Colour is never the only signal: overdue shows a date word, labels have text available,
  status columns have names.
- Touch targets at least 24px (44px on phones for "..." and "+").
- Contrast: card text 4.5:1 on the card, card edges 3:1 against the column, or use spacing
  and shadow so cards stay distinguishable.

## Looks cheap: avoid
Rotated or wobbling cards, heavy drop shadows, bright saturated columns, cards that show
the whole description, buttons on every card, columns that shrink to fit the window, a
"Save board" button, dragging as the only way to move, toasts for every move, full-page
spinners on each change, confetti when something reaches Done, and more than about 7
columns for a small team.
