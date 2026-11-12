# Research notes: BOARD pages (kanban: cards in columns, moved by dragging)

Scope: Trello, Linear, GitHub Projects, Jira, Todoist, Asana, plus the Atlassian Design
System drag-and-drop guidelines. Researched November 2026.

## Sources
- [LIN-BOARD] Linear docs, "Board layout": https://linear.app/docs/board-layout
- [GH-BOARD] GitHub docs, "Customizing the board layout": https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout
- [TD-BOARDS] Todoist help, boards and sections: https://get.todoist.help/hc/en-us/articles/360013988740
- [TRELLO-DUE] Trello support, due dates and badge colours: https://support.atlassian.com/trello/docs/due-soon
- [TRELLO-CHECKLIST] Atlassian community, checklists on card fronts: https://community.atlassian.com/forums/Trello-articles/Checklists-Now-appearing-on-the-front-of-your-cards/bc-p/3233089
- [JIRA-WIP] Atlassian community, column constraints: https://community.atlassian.com/t5/Jira-questions/Possible-to-make-column-constraints-apply-to-quick-filters/qaq-p/384925
- [ADS-DND] Atlassian Design System, drag-and-drop design guidelines: https://atlassian.design/components/pragmatic-drag-and-drop/design-guidelines
- [DNDKIT-A11Y] dnd kit accessibility docs (not readable in this session; keyboard
  pattern described from general knowledge): https://dndkit.com/

## Findings

### Columns
- Columns come from a status (or single-choice) field, in order; dragging between columns
  changes the field (src: [GH-BOARD], [LIN-BOARD]).
- Counts (and sums) in the column header (src: [GH-BOARD]).
- Limits shown as "n / limit", highlighted when exceeded, never blocking (src: [GH-BOARD]).
  Jira's limits ignore active filters, which confuses users (src: [JIRA-WIP]).
- Hide empty columns option; hidden columns still accept drops (src: [LIN-BOARD]).
- Add a column by hovering between two columns (Todoist) or with a button after the last
  column (GitHub) (src: [TD-BOARDS], [GH-BOARD]).
- Swimlanes: optional second grouping as collapsible rows (src: [LIN-BOARD], [GH-BOARD]).

### Cards
- No description on the card; a few properties; hover + Space to peek (src: [LIN-BOARD]).
- Due badge: grey, yellow within 24h, red overdue, green done (src: [TRELLO-DUE]).
- Checklist progress on the front, expandable (src: [TRELLO-CHECKLIST]).
- Fields shown on cards are a view setting (src: [GH-BOARD]).

### Ordering
- Mouse drop places the card exactly; status change by shortcut puts it at the top of the
  new column (src: [LIN-BOARD]).
- When the board is sorted, manual ordering within a column is disabled; moving between
  columns still works (src: [GH-BOARD]).
- Multi-select (X, Shift+click) and move several (src: [LIN-BOARD]).

### Drag-and-drop details
- Drop indicator: 2px line in the middle of the gap between cards, accent/selected colour;
  for an empty column use a background tint instead of a line (src: [ADS-DND]).
- Preview offset slightly from the pointer, NOT rotated (Trello is the exception);
  cards drag from the grab point; original stays at 40% opacity; multi-drag shows a stack
  with a count (src: [ADS-DND]).
- Whole card can be the drag source when it has no other controls; handles need a 24px
  touch target (src: [ADS-DND]).
- Optimistic update on drop, save in the background, flash the moved card about 700ms
  (src: [ADS-DND]).
- Every drag outcome needs a keyboard alternative, preferably "Move" actions in the card's
  "..." menu (src: [ADS-DND]).
- Keyboard drag convention (Space to lift, arrows to move, Space to drop, Esc to cancel,
  with live-region announcements such as "Picked up card X. Position 2 of 5 in To do")
  is the common library pattern (inferred; dnd kit and react-beautiful-dnd lineage).

## Conventions, not specs
Column 272-320px, card gap 8px, column gap 12-16px, auto-scroll near edges: observed
conventions (inferred).
