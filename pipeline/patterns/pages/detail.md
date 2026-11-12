# Page guide: DETAIL (one item: a task, issue, request or record)

Studied: Linear, Asana, Jira, GitHub, Trello, Todoist

How the leading work tools show one item (Linear's issue view and peek, Asana's task pane,
Jira's issue view, GitHub's issue page, Trello's card, Todoist's task view). People know
this layout: a big editable title, the description, a compact set of properties, and the
conversation underneath. Follow it, then make it the owner's own through STYLE. Sources:
`out/research/detail-research.md` (researched Nov 2026). Never copy a product's name,
logo, wording or exact look.

## Two ways to open the same item
- **As a side panel** over or beside the list or board it was opened from (the usual
  way): right side, **480-560px** wide (resizable between about 400px and 60% of the
  screen), full height under the top bar. The list stays visible and keeps its scroll and
  selection; the open row is highlighted. Opening changes the URL so it can be shared.
- **As a full page** at its own URL (a shared link, a reload, or the panel's "Open full
  page" button): the same content with properties moved to a right column.
- Close with Esc, the X, or by clicking the open row again. Up/Down (or J/K) in the list
  switch the panel to the next item without closing it.

## Layout of the panel (top to bottom)
1. **Toolbar (44-48px, sticky)**: on the left, the place it belongs to as a small
   breadcrumb ("Website relaunch / Board") and, for tasks, a **"Mark complete"** button
   with a check icon (it turns into "Completed" with a filled check). On the right, icon
   buttons: copy link, open full page / expand, "..." (Duplicate, Move to..., Delete), and
   close (X). Each icon has a tooltip with its shortcut.
2. **Title**: 20-24px, semibold, editable in place (click to type, Enter or click away
   saves, Esc reverts), wraps to several lines, never truncated.
3. **Properties**, a compact two-column list (label 100-120px muted on the left, value on
   the right, rows 32-36px). The most important first: **Assignee, Due date, Priority,
   Status**, then Project, Labels, and any custom fields. Each value is a button that
   opens a small popover picker (search + list, or a date picker with shortcuts). Empty
   values say what they are in muted text ("No assignee", "No due date") so they can be
   clicked. Rarely used fields hide behind "Show more fields".
4. **Description**: rich text with the same editor as notes but lighter (formatting via
   selection toolbar and "/" menu). Placeholder "Add a description..." when empty. Saves as
   you type; no Save button.
5. **Sub-items and links**: subtasks as a mini task list with checkboxes and "Add
   subtask"; linked notes or related items as small rows with icon and title, plus "Link
   a note". Each section collapses and shows a count.
6. **Activity and comments**: a heading "Activity" with a "Comments only / All" toggle.
   Changes in one muted line each ("Kim changed due date to Fri · 2h"), comments as avatar,
   name, time, and text. Long histories collapse to "Show 12 earlier updates".
7. **Comment composer, sticky at the bottom of the panel**: a field "Leave a comment..."
   that grows up to about 6 lines, @mentions, attach, and a "Comment" button (Ctrl/Cmd+
   Enter). Under or beside it, the followers as a row of small faces with "Follow / 
   Following".

## Layout of the full page (desktop)
- Centred main column of 680-760px for title, description, sub-items and activity.
- **Right properties column 240-300px**, sticky, same order as above, labels above
  values or beside them, separated from the main column by space or a hairline.
- Toolbar and breadcrumb across the top; Previous / Next arrows when opened from a list.

## First screen and states
- **Loading**: the panel opens instantly with the title (already known from the list) and
  skeleton lines for the rest; never a blank panel with a spinner.
- **Saving a field**: the value changes immediately; on failure it reverts with an inline
  message "Couldn't save the due date. Try again". No toasts for every save.
- **Completed**: title muted (not struck through in the panel), a "Completed 3 Nov by Kim"
  line, and the button offers "Mark incomplete".
- **Overdue**: the due date in red with "Overdue" or "2 days ago"; due soon in a warning
  tone.
- **Deleted**: "Task deleted - Undo" and the panel closes; opening a deleted item's link
  shows "This task was deleted" with a link back to the list.
- **No access / not found**: a short message in the panel, never a raw error page.
- **Changed by someone else while open**: fields update live with a brief highlight; if
  they edited the description you are editing, show "Kim updated the description - View"
  instead of overwriting.
- **Unsent comment**: kept if the panel is closed and reopened; closing with an unsent
  comment asks "Discard comment?".

## Phones
The panel becomes a full-screen page sliding in from the right (or a tall bottom sheet)
with a back arrow in place of X. Properties stay as the two-column list under the title;
the comment composer docks above the keyboard (use `100dvh` and safe-area padding).
Pickers open as bottom sheets. Mark complete stays in the top bar.

## Motion
- Panel slides in from the right with a slight fade (200-250ms,
  `cubic-bezier(0.22, 1, 0.36, 1)`); switching items cross-fades the content only (120ms),
  the panel itself does not move.
- Popovers scale from 98% and fade (150ms). Completing fills the check (200ms).
- A new comment rises in (fade + 6-8px, 200ms). Live changes flash the field background
  for about 700ms.
- With reduced motion: fades only.

## Accessibility
- The side panel is a `region` (or non-modal `dialog`) labelled with the item title;
  focus moves to the title when it opens and back to the row when it closes. A full-screen
  phone version is a modal dialog that traps focus.
- Every property value is a real button whose name includes the label and value ("Due
  date: Friday 13 November"); pickers are listboxes or grids with arrow keys.
- The Mark complete button exposes its state (`aria-pressed` or changing label).
- Activity is a list; new comments from others are announced politely, once.
- Ctrl/Cmd+Enter submits the comment; Enter adds a line; ignore Enter while an input
  method is composing.
- Text 4.5:1, borders and icons 3:1; muted labels must still pass.

## Looks cheap: avoid
A modal in the middle of the screen with Edit and Save buttons; every field as a full
labelled form input; properties scattered across the page; the comment box scrolled off
the bottom; a 900px-wide panel that hides the list; giant coloured status badges; an
activity log that shows every keystroke; confirmation dialogs for each field change; and
errors that appear as toasts far from the field.
