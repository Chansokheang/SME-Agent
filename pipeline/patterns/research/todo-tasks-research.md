# Research notes: TODO-TASKS sites (personal and small-team to-do apps)

Scope: Todoist, Things 3, Microsoft To Do, Asana (My Tasks), Linear (My Issues), TickTick
(TickTick from general product knowledge only, no source fetched). Researched November 2026.

## Sources
- [TD-TODAY] Todoist help, "Plan your day with the Today view": https://todoist.com/help/articles/360000030999
- [TD-UPCOMING] Todoist help, "Plan your week with the Upcoming view": https://todoist.com/help/articles/360000031019
- [TD-QUICKADD] Todoist help, "Use Task Quick Add": https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz
- [THINGS-LISTS] Things support, the default lists (Inbox, Today, Upcoming, Anytime, Someday, Logbook): https://culturedcode.com/things/support/articles/4001304/
- [MSTODO-MYDAY] Microsoft support, "My Day and suggestions": https://support.microsoft.com/en-us/ToDo/my-day-and-suggestions
- [MSTODO-PLAN] Microsoft support, "Plan and connect with Microsoft To Do": https://support.microsoft.com/en-us/todo/plan-and-connect-with-microsoft-to-do
- [ASANA-MYTASKS] Asana help, "Maximize productivity with My tasks": https://help.asana.com/s/article/maximize-productivity-with-my-tasks
- [ASANA-FORUM] Asana forum, default My Tasks sections: https://forum.asana.com/t/default-my-tasks-list-view-to-group-by-due-date/1079401
- [ASANA-PANE] Asana, "The task pane, redesigned": https://asana.com/inside-asana/task-pane-redesign
- [LIN-MYISSUES] Linear docs, "My Issues": https://linear.app/docs/my-issues

## Findings

### Home is a date-based list, not a dashboard
- Every leader opens on a "today" list: Todoist Today, Things Today, Microsoft To Do My Day,
  Asana My Tasks, Linear My Issues (src: [TD-TODAY], [THINGS-LISTS], [MSTODO-MYDAY],
  [ASANA-MYTASKS], [LIN-MYISSUES]). None opens on charts.
- Overdue tasks sit at the top of the list with a one-click "Reschedule" for all of them
  (src: [TD-UPCOMING]). Things shows today's tasks plus a quieter "This Evening" section at
  the bottom (src: [THINGS-LISTS]).
- Upcoming is grouped by day: the next seven days as separate sections, then later dates;
  tasks can be dragged onto another day to reschedule (src: [THINGS-LISTS], [TD-UPCOMING]).
- Microsoft To Do separates "My Day" (what I choose to do today) from "Planned" (what is due
  by date: today, tomorrow, later) (src: [MSTODO-PLAN]). Small teams usually need only the
  due-date version (inferred).
- Linear's Assigned tab orders groups by urgency and puts started work first within each
  group (src: [LIN-MYISSUES]). Asana auto-files new assignments into "Recently assigned"
  (src: [ASANA-MYTASKS]); users complain fixed sections drift out of date and ask for
  grouping by due date instead (src: [ASANA-FORUM]). Conclusion: group by computed due date
  (Overdue / Today / Upcoming / No date), never by sections users must maintain (inferred).

### Capture must be instant
- Quick Add opens with a single key (Q), parses natural-language dates ("tomorrow 4pm") and
  inline tokens: # project, p1-p3 priority, + assignee; recognised tokens are highlighted as
  you type (src: [TD-QUICKADD]).
- Description is hidden by default behind a "+" or down arrow, so the fast path is one line
  (src: [TD-QUICKADD]).
- An "Add task" row at the end of each list or section is common to Todoist, Things, To Do
  (inferred from product knowledge).

### Task rows and details
- A row is: round checkbox, title, then small metadata (due date, project, assignee avatar,
  priority). Priority is shown as a coloured checkbox ring in Todoist (inferred, product
  knowledge); keep priority a small mark, not a big badge.
- Completed tasks leave the list (Things moves them to a Logbook archive kept indefinitely;
  src: [THINGS-LISTS]).
- Details open in a side pane without leaving the list; Asana puts assignee and due date at
  the top of the pane and keeps the comment box on screen (src: [ASANA-PANE]).

### Numbers that are conventions, not specs
Sidebar 240-280px, row height 36-44px, pane 420-560px: observed conventions across these
apps (inferred), not published values.

## Where the leaders differ, and the choice for a small business
- Manual "pick for today" (My Day, Things Today) vs due-date driven (Todoist, Asana): a team
  tool should be due-date driven, optionally with a personal "star for today" later.
- Natural-language parsing is a power feature; a small site can parse only dates and use
  plain pickers for project, priority and assignee (inferred).
