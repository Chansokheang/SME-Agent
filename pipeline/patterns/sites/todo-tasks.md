# Site guide: TODO-TASKS (personal and small-team to-do lists with due dates)

Studied: Todoist, Things 3, Microsoft To Do, Asana, Linear, TickTick

People come to a to-do site for two things, many times a day: to see what they must do now,
and to get a new task out of their head in a few seconds. The leading products open
straight onto a date-based list ("Today", "My Day", "My Issues"), put overdue work at the
top with a one-click way to reschedule it, and keep an add-task field one key away.
Everything else (projects, filters, settings) lives in a quiet sidebar. There is no
dashboard, no chart and no welcome page in front of the list. Sources:
`out/research/todo-tasks-research.md` (researched Nov 2026).

## What the first screen shows
- **The Today list is the home page.** Title "Today" with the date in small muted text
  beside it ("Mon 9 Nov"), and a count of open tasks.
- **Overdue first**, as its own section with a red-tinted heading "Overdue" and, at the
  right of that heading, a text button "Reschedule" that moves all of them at once to a
  date chosen in a small picker (Today, Tomorrow, Next week, Pick a date).
- **Then "Today"**, in the order the user arranged by dragging, or by priority then time.
- **An add row at the end of each section**: a "+" and the words "Add task", which turns
  into an inline editor in place. The same editor opens from a "New task" button in the
  sidebar and from the key Q or N anywhere.
- **When everything is done**: a calm, small empty state ("All clear for today") with a
  link to Upcoming, never a big illustration or confetti.

## The main flow, step by step
1. **Capture**: press Q (or click Add task), type "Send invoice to Kim tomorrow", Enter.
   The date phrase is recognised and highlighted in the field, then turned into a date chip.
   Project defaults to the list you are in; priority and assignee are small buttons under
   the title. The editor stays open for the next task; Esc closes it.
2. **See**: the task appears in the right section instantly (optimistic), with a brief
   highlight.
3. **Do**: click the round checkbox. It fills, the title strikes through, and after about
   a second the row collapses out of the list. A small "Task completed - Undo" bar appears
   at the bottom for about 5 seconds.
4. **Change**: click the row (not the checkbox) to open the task details in a side panel
   (see `pages/detail.md`); the list stays visible and stays where it was scrolled.
5. **Reschedule**: hover a row and use the date button, or drag it onto another day in
   Upcoming, or select several rows and set a date for all.

## Navigation and structure
- **Left sidebar, about 240-280px**: the user (avatar and name, opens the account menu) at
  the top; then the fixed views with counts: Today, Upcoming (or My tasks), Inbox if
  personal tasks exist, Notifications; then a "Projects" heading with the team's projects
  (a coloured dot each, "+" on hover); then notes or other areas; Search near the top
  (also Ctrl/Cmd+K). Collapsible with a toggle.
- **Pages a team to-do site needs**: Today, My tasks / Upcoming (grouped Overdue, Today,
  Tomorrow, the next days of the week, Later, No date), each Project (list and board),
  Task details (as a panel and as its own URL), Search, Notifications, Settings, Members.
- **Top of the content**: page title on the left; on the right, only view controls
  (Group, Sort, Filter, Show completed) and, for projects, a List / Board switch.
- **Phones**: the sidebar becomes a drawer; a round floating "+" button bottom-right opens
  the add sheet with the keyboard up; task details open full screen; swipe a row to
  complete (one side) or reschedule (the other) is a widely known gesture.

## The key components
- **Task row** (36-44px tall): round checkbox (18-20px), title (one line, truncates), then
  on the same line or a second muted line: due date (red if overdue, accent if today),
  project name with its dot (only in cross-project lists), assignee avatar (20px, only if
  someone else), comment count, a priority mark. Hover shows a drag handle on the left and
  quick actions on the right (date, assign, "...").
- **Priority**: 3-4 levels shown as a small coloured mark or the checkbox ring colour.
  "Urgent/High/Medium/Low" or "P1-P4", never big filled badges on every row.
- **Section headers**: small, semibold, with count, collapsible with a chevron.
- **Date picker**: shortcuts first (Today, Tomorrow, This weekend, Next week, No date),
  then a small month calendar, then optional time. Typing a phrase also works.
- **Quick add editor**: title field, description revealed on demand, chips for date,
  priority, project, assignee, and "Add task" / "Cancel" buttons right-aligned.
- **Bulk bar**: when rows are selected (checkbox-free selection with Shift/Cmd click or
  the X key), a floating bar shows "3 selected" with Date, Assign, Move, Complete, Delete.

## States and messages
- **Empty list**: one sentence and the add row ("Nothing due today. Add a task or plan
  your week in Upcoming").
- **Empty project**: "No tasks yet" and the add row focused.
- **Loading**: 5-8 skeleton rows in the list shape, never a full-page spinner.
- **Saving**: no spinner on each change; changes apply instantly. If saving fails, the
  row shows a small warning and a "Retry" link, and the change is not silently lost.
- **Completed**: hidden by default with a "Show completed (12)" toggle at the end.
- **Overdue**: the date in red text ("Yesterday", "3 Nov"), never the whole row red.
- **Deleted**: removed with an Undo bar; a real "Trash" or archive is optional.
- **Offline / connection lost**: a slim banner "You are offline. Changes will sync".

## What the leaders get right
- Dates written the human way: "Today", "Tomorrow", "Fri", "12 Nov", "Last Mon".
- One key to add, Enter to save, the editor staying open for the next task.
- Completion feels good (fill, strike, collapse) and is always undoable.
- Grouping is computed from due dates, so the list is never out of date.
- Details open beside the list, so people never lose their place.

## Common mistakes to avoid
- A dashboard of charts and "productivity score" on the home page.
- A modal form with eight fields to create a task.
- Sections the user must maintain by hand ("Do today", "Do later") that go stale.
- Confirming every completion or deletion with a dialog instead of offering Undo.
- Colouring every row by priority so the list looks like a traffic light.
- Hiding the due date behind a hover or a click.

## Style: what this kind usually looks like, and where there is room to be different
- Light, calm, mostly white or near-white with a tinted sidebar; one accent colour for the
  add button, today's date and focus; red only for overdue; the checkbox is the hero.
- Dense but airy: 14-15px text, generous line spacing, hairline dividers or none.
- A designed dark mode is expected.
- Room to be different: the typeface (a warm humanist sans or even a soft serif for titles),
  the accent colour, the completion animation, and the empty-state voice. Keep the layout.
