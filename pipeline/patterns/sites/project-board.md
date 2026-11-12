# Site guide: PROJECT-BOARD (team projects as lists and kanban boards)

Studied: Trello, Linear, Asana, Jira, GitHub Projects, Todoist

People come to a project site to see where the work stands and to move it forward: what is
waiting, what is in progress, who has it, what is done. The leading products show a
project's tasks first, in a choice of two views of the SAME data (a sortable list and a
kanban board), and open any task in a panel on top of the view so nobody loses their place.
The projects overview is a short, scannable list with progress, not a dashboard. Sources:
`out/research/project-board-research.md` (researched Nov 2026).

## What the first screen shows
- **Projects page**: a page title "Projects", a "New project" button at the right, then a
  list (or a grid of compact cards when there are fewer than about 8) with, per project:
  colour dot or small icon, name, a progress bar or ring with "12 / 30", the lead or member
  avatars (stacked, max 3 and "+2"), the nearest due date, and a status word (On track,
  At risk, Done). Archived projects sit behind a "Show archived" toggle.
- **A project page** opens on the view the user last used (default: List for small
  projects, Board when the team works in stages). Header: project name (editable in place),
  a short description line, member avatars, and a segmented switch "List | Board".
- **Above the tasks**: Filter (assignee, priority, due), Group / Display options, and a
  primary "Add task" button. Nothing else.

## The main flow, step by step
1. **Create a project**: "New project" opens a small dialog: name, colour, optional
   description and members. Create takes you into the empty project with the add field
   focused.
2. **Add tasks**: in List, an "Add task" row at the end of each group; in Board, "+ Add
   task" at the bottom of each column (and a "+" in the column header to add at the top).
   Title only, Enter to save, the field stays open for the next one.
3. **Assign and date**: from the row's hover actions, the card's "..." menu, or the
   details panel.
4. **Move forward**: drag the card to the next column, or open "..." > "Move to", or set
   Status in the details panel. The card animates to its new place.
5. **Discuss**: open the task, comment at the bottom of the panel; @mentions notify.
6. **Finish**: cards in Done show a check and fade slightly; Done is collapsible and can
   be cleared ("Archive done tasks") after a while.

## Navigation and structure
- **Left sidebar**: the personal views (Today, My tasks), then a "Projects" group listing
  each project with its dot (favourite ones first), "+" on hover to create; then Notes,
  Search, Notifications. Members and settings at the bottom for admins.
- **Project tabs** are the views (List, Board) and, if needed, Overview (description,
  members, progress). Each view has its own URL so it can be shared and reloaded.
- **Task URLs**: opening a task changes the URL (`/tasks/123` or `?task=123`) so it can be
  linked; Back closes the panel.
- **Phones**: the list view is the default; the board becomes one column at a time with
  swipe or a column picker tabs row at the top ("To do 4 | In progress 2 | Done 9").
  Moving uses the "Move to" menu, not dragging.

## The key components
- **List view**: grouped by status (or by section), each group collapsible with a count.
  Columns: checkbox, title, assignee, due date, priority, maybe labels; click a column
  header to sort; when sorted, dragging to reorder is turned off and a "Sorted by Due date
  x" chip says so.
- **Board view**: columns 272-320px wide, 8-12px gaps, headers with name, count and "...";
  cards stacked with 8px gaps; the board scrolls sideways, each column scrolls down on its
  own. See `pages/board.md`.
- **Card**: title (up to 3 lines), then a small footer row: due date, priority mark,
  comment count, subtask count "2/5", assignee avatar at the right. Labels as small
  coloured pills above the title. No description on the card.
- **Progress**: done tasks / all tasks as a thin bar or ring, with the numbers beside it.
- **Filter bar**: active filters shown as removable chips ("Assignee: Me x"), "Clear".
- **Details panel**: right side, 480-560px, see `pages/detail.md`.

## States and messages
- **No projects yet**: "Create your first project to organise your team's tasks" and the
  New project button. One sentence, maybe a simple outline drawing, no stock art.
- **Empty column**: a dashed or tinted area with "No tasks" and the add button; stays a
  valid drop target.
- **Filtered to nothing**: "No tasks match these filters" and a "Clear filters" button.
- **Loading**: skeleton columns with 2-3 grey card shapes each.
- **Drag saved**: no message; the card just stays. **Drag failed**: the card goes back to
  where it was and a small message "Couldn't move the task. Try again".
- **Someone else changed it**: the card moves live with a brief highlight; if the user had
  it open, "Kim changed the status to Done" appears inline in the panel.
- **Column over its limit** (if limits are used): count turns warning-coloured
  ("5 / 4"); never block the move.
- **Archived / deleted project**: read-only banner with "Restore".

## What the leaders get right
- List and board are views of the same tasks; switching keeps filters.
- The card is short; the panel holds the detail.
- Status changes have three ways in: drag, menu, keyboard.
- Counts on every column and group, so the state of the project reads at a glance.
- Live updates with a soft highlight, so the board is always true.

## Common mistakes to avoid
- Rotated, shadow-heavy cards and bright full-colour columns: the board looks like a toy.
- Descriptions and every field on the card front, so a column holds three cards.
- Drag as the only way to move a task (fails on keyboard, screen readers and phones).
- A "Save" button after moving cards.
- Columns that each squeeze to fit the screen width instead of scrolling sideways.
- A project overview stuffed with charts no small team reads.

## Style: what this kind usually looks like, and where there is room to be different
- Neutral, light canvas; columns as a very light tinted background (or no background with
  just headers); white cards with a hairline border or a 1px shadow; radius 6-10px.
- Colour carries meaning only: project dots, label pills, priority marks, overdue red,
  done green. Status colours are muted, not saturated.
- 13-14px card text, 12px meta; avatars 20-24px.
- Room to be different: the project colour palette, the card shape (radius, border vs
  shadow), column headers (dot + name vs bold label), the avatar style and the empty-state
  tone. Keep the column layout, counts and panel behaviour.
