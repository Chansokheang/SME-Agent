# Research notes: PROJECT-BOARD sites (team projects as lists and kanban boards)

Scope: Trello, Linear, Asana, Jira, GitHub Projects, Todoist (Boards). Researched November 2026.

## Sources
- [LIN-BOARD] Linear docs, "Board layout": https://linear.app/docs/board-layout
- [LIN-PEEK] Linear docs, "Peek preview": https://linear.app/docs/peek
- [LIN-PROPS] Linear docs, "Issue properties": https://linear.app/docs/issue-property
- [GH-BOARD] GitHub docs, "Customizing the board layout": https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout
- [TD-BOARDS] Todoist help, boards and sections: https://get.todoist.help/hc/en-us/articles/360013988740 and https://todoist.com/inspiration/kanban-board
- [TRELLO-DUE] Trello support, "Add due dates and start dates to cards": https://support.atlassian.com/trello/docs/due-soon
- [TRELLO-CHECKLIST] Atlassian community, checklists on card fronts: https://community.atlassian.com/forums/Trello-articles/Checklists-Now-appearing-on-the-front-of-your-cards/bc-p/3233089
- [TRELLO-FRONT] Atlassian community, card-front visibility: https://community.atlassian.com/t5/Trello-questions/Customize-visibility-of-information-on-the-front-of-the-card/qaq-p/1632328
- [JIRA-WIP] Atlassian community, column constraints and quick filters: https://community.atlassian.com/t5/Jira-questions/Possible-to-make-column-constraints-apply-to-quick-filters/qaq-p/384925
- [ASANA-PANE] Asana, "The task pane, redesigned": https://asana.com/inside-asana/task-pane-redesign
- [ADS-DND] Atlassian Design System, drag-and-drop design guidelines: https://atlassian.design/components/pragmatic-drag-and-drop/design-guidelines

## Findings

### One data set, several views
- Board and list are two layouts of the same items; Linear toggles them with Cmd/Ctrl+B and
  both share the same manual order (src: [LIN-BOARD]). Todoist switches any project between
  list and board from a view menu at the top right (src: [TD-BOARDS]).
- GitHub Projects lets you sort a board, but then manual reordering within a column is off
  (src: [GH-BOARD]).

### Columns and swimlanes
- Columns default to status, ordered first to last (src: [LIN-BOARD]); Todoist uses
  sections as columns with a "No section" column for the rest (src: [TD-BOARDS]).
- Dragging a card to another column changes its field value (src: [GH-BOARD]).
- Optional swimlanes (a second grouping as rows, e.g. by assignee), collapsible
  (src: [LIN-BOARD], [GH-BOARD]).
- Counts (and sums) at the top of each column; optional column limits that are shown and
  highlighted when exceeded but never block (src: [GH-BOARD]). Jira's limits apply to the
  whole column regardless of filters, which users find confusing (src: [JIRA-WIP]).
- Empty columns can be hidden; hidden columns still accept drops (src: [LIN-BOARD]).

### Cards
- Cards don't show descriptions; they show a few properties and you open or peek for the
  rest (src: [LIN-BOARD], [LIN-PEEK]).
- Trello's card front shows labels (colour only until clicked), due-date badge (grey,
  yellow when due within 24h, red overdue, green when completed), members, checklist count
  (src: [TRELLO-DUE], [TRELLO-CHECKLIST], [TRELLO-FRONT]).
- Subtasks are not shown on Todoist board cards (src: [TD-BOARDS]).

### Project pages and projects list
- A project has a header with name, a view switch (List / Board, sometimes Calendar,
  Timeline), filter and display options (src: [LIN-BOARD], [TD-BOARDS]).
- Projects list with progress, lead and status is a Linear/Asana convention (inferred from
  product knowledge; not fetched).

### Drag and drop
- Drop line 2px in the gap between cards; for an empty column, tint the background instead
  (src: [ADS-DND]). Optimistic update, 700ms flash on the moved item (src: [ADS-DND]).
- Every drag needs a keyboard alternative: put "Move to..." in the card's "..." menu
  (src: [ADS-DND]). Linear also changes status by shortcut, which puts the card at the top
  of the target column (src: [LIN-BOARD]).

### Details and comments
- Details open on top of the board (peek / side pane) so the board stays in view
  (src: [LIN-PEEK], [ASANA-PANE]).

## Conventions, not specs
Column width 272-320px, card padding 8-12px, card gap 8px: observed conventions (inferred).
