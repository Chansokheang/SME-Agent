# Research notes: DETAIL pages (one item: a task, issue, record or order)

Scope: Linear (issue view and peek), Asana (task pane), Jira (issue view), GitHub (issue
page), Trello (card back), Todoist (task view). GitHub and Todoist from general product
knowledge only. Researched November 2026.

## Sources
- [ASANA-PANE] Asana, "The task pane, redesigned": https://asana.com/inside-asana/task-pane-redesign
- [ASANA-COMMENTS] Asana help, "Task comments and attachments": https://help.asana.com/s/article/task-comments-and-attachments
- [ASANA-FIELDS] Asana help, "Task fields": https://help.asana.com/s/article/task-fields
- [LIN-PEEK] Linear docs, "Peek preview": https://linear.app/docs/peek
- [LIN-PROPS] Linear docs, "Issue properties": https://linear.app/docs/issue-property
- [LIN-CHANGELOG-26] Linear changelog, July 2026 (sidebar properties): https://linear.app/changelog/2026-07-23-agent-assisted-editing
- [JIRA-ISSUEVIEW] Atlassian community, "Making the new issue view work for you": https://community.atlassian.com/t5/Jira-Software-articles/Making-the-new-issue-view-work-for-you/ba-p/2223109
- [JIRA-PANEL-REQ] Jira feature request, collapse the right panel: https://jira.atlassian.com/browse/JRACLOUD-76253
- [TRELLO-DUE] Trello support, due dates: https://support.atlassian.com/trello/docs/due-soon

## Findings

### Two-part layout: content and properties
- Jira: summary, description and activity on the left; field panels (Details, More fields)
  in a right column; the right column is resizable (src: [JIRA-ISSUEVIEW]). Users ask to
  collapse it entirely, and say it is too wide (src: [JIRA-PANEL-REQ]).
- Linear: content left, a properties sidebar right (status, priority, assignee, labels,
  project, dates); in 2026 properties were integrated more closely with the main content
  (src: [LIN-CHANGELOG-26], [LIN-PROPS]).
- Asana, in a narrower pane: assignee and due date at the TOP, always visible, as the most
  critical info; the other fields in a compact list below (src: [ASANA-PANE]).
- Conclusion: in a narrow panel, properties go in a compact two-column list under the
  title; on a full page, they move to a right column of about 240-300px (inferred).

### Opening as a panel, keeping the list
- Peek: Space shows a preview of the description, assignee, status, priority, labels,
  dates over the list (src: [LIN-PEEK]).
- Asana opens details in a pane next to the list, resizable, with a full-screen button in
  the toolbar (src: [ASANA-COMMENTS], [ASANA-PANE]).

### Top toolbar
- Asana's pane toolbar: Mark complete, like, attach, add subtask, copy link, full screen,
  "..." (src: [ASANA-COMMENTS]). The main action (complete) is a labelled button, the rest
  icons (inferred from description).

### Activity and comments
- Activity feed (timestamped changes) above the comment field; comments can be pinned
  (src: [ASANA-COMMENTS]). Linear collapses long histories (src: Linear changelog
  2025-04-03, https://linear.app/changelog/2025-04-03-collapsed-issue-history).
- The comment composer stays visible while you scroll (sticky at the bottom), and the
  pane grows as content is added; the empty state is small (src: [ASANA-PANE]).
- Followers/collaborators shown as a row of faces at the bottom, near the composer
  (src: [ASANA-PANE]).

### Inline editing
- Fields are edited in place (click the value, choose from a popover); no "Edit" mode or
  Save button in Linear, Asana, Jira (inferred, widely known).
- Due-date colouring: grey normally, yellow due soon, red overdue, green done
  (src: [TRELLO-DUE]).
- Keyboard shortcut hints in tooltips quadrupled use of some shortcuts (src: [ASANA-PANE]).

## Conventions, not specs
Panel width 480-640px, title 20-24px, property rows 32-36px: observed conventions (inferred).
