# Research notes: INBOX pages (notifications and activity that need my attention)

Scope: the in-app inbox / notification centre of team work tools, where a person sees what
was assigned to them, who mentioned them and what changed on things they follow, and
triages it. Products studied: Linear (Inbox), GitHub (Notifications), Notion (Inbox),
Asana (Inbox), ClickUp (Inbox), Slack (Activity), Jira / Atlassian Cloud (notification
drawer). Plus practitioner guidance on notification-centre UX. Researched November 2026,
from public help centres and articles only.

## Sources
- [LINEAR-INBOX] Linear Docs, Inbox: https://linear.app/docs/inbox
- [GH-INBOX] GitHub Docs, Managing notifications from your inbox: https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox
- [GH-ABOUT] GitHub Docs, About notifications: https://docs.github.com/en/subscriptions-and-notifications/concepts/about-notifications
- [NOTION-INBOX] Notion Help, Inbox & notifications: https://www.notion.com/help/updates-and-notifications
- [ASANA-HELP] Asana Help, Stay informed with your Asana Inbox (via search summary): https://help.asana.com/s/article/stay-informed-with-your-asana-inbox
- [ASANA-TIPS] Asana blog, 5 tips to manage your Asana Inbox: https://asana.com/inside-asana/asana-tips-inbox
- [CLICKUP-HELP] ClickUp Help, Intro to Inbox (via search summary; the page itself returned 403): https://help.clickup.com/hc/en-us/articles/12724229385623-Intro-to-Inbox
- [SLACK-ACT] Slack Help, Get your work done from the Activity view: https://slack.com/help/articles/19693583638803
- [ATL-NOTIF] Atlassian Support, Overview of in-app notifications in Atlassian Cloud products: https://support.atlassian.com/atlassian-cloud/kb/overview-of-in-app-notifications-in-atlassian-cloud-products/
- [JIRA-COMM] Atlassian Community, "Cannot mark notifications as read" thread: https://community.atlassian.com/forums/Jira-questions/Cannot-mark-notifications-as-read/qaq-p/2835246
- [SAASUI] saasui.design, SaaS notification center UX patterns: https://www.saasui.design/blog/saas-notification-center-ux-patterns
- [COURIER] Courier, Notification center best practices: https://www.courier.com/guides/how-to-build-a-notification-center/chapter-3-best-practices-for-notification-centers
- [FIORI] SAP Fiori design system, Notification center usage (page blocked, known from search snippet only): https://www.sap.com/design-system/fiori-design-web/v1-148/ui-elements/notification-center/usage

Not readable: SAP Fiori usage page (403), ClickUp help article (403). Their content is only
taken from search-result summaries and marked as such.

## 1. Where the inbox lives
- Linear: a top item in the sidebar, keyboard `G` then `I`; full page; clicking a
  notification opens the issue in a dedicated inbox view where you can act on the inbox and
  edit the issue (src: [LINEAR-INBOX]). Widely seen as a two-pane layout: list left, the
  issue on the right (inferred from product screenshots and the "dedicated Inbox view").
- GitHub: an inbox icon in the top-right of every page leads to a full notifications page
  with a left sidebar of filters, Saved and Done (src: [GH-INBOX]).
- Notion: at the top of the sidebar, opens as a panel next to the page; can be locked open
  ("Lock inbox pane open") (src: [NOTION-INBOX]).
- Jira / Atlassian: a bell icon opening a drawer; the number on the bell is an "unseen"
  count that clears when the drawer opens (src: [ATL-NOTIF]).
- Slack: an "Activity" item in the main navigation with a number badge (src: [SLACK-ACT]).
- Pattern: two surfaces coexist. A small badge/bell in the shell for "something new", and a
  full inbox page (or a lockable panel) for triage. A small team tool should have a sidebar
  item "Inbox" with a count, and a full page (inferred).

## 2. Splitting what matters from the rest
- Linear: two tabs, Priority (things that need you, chosen by default rules, editable) and
  Other (src: [LINEAR-INBOX]).
- ClickUp: Primary, Other, Later (snoozed), Cleared; counts shown under tab names except
  Cleared; "importance" is configurable per activity type (src: [CLICKUP-HELP]).
- Jira: Direct (you are reporter, assignee or mentioned) vs Watching; only Direct raises
  the bell count by default (src: [ATL-NOTIF]).
- GitHub: default filters Assigned, Participating, Mentioned, Review requested; up to 15
  custom filters (src: [GH-INBOX]). Each item carries a reason label such as mention,
  assigned, review requested, subscribed (src: [GH-ABOUT]).
- Asana: filters All, Assigned to me, @Mentioned, Assigned by me (src: [ASANA-TIPS]);
  only shows actions done by others (src: [ASANA-HELP]).
- Notion: read-state filter (Unread and read, Unread only, Archived, All workspace updates)
  and a type filter (Access, Discussions, Mentions, Automations, Updates, Workspace)
  (src: [NOTION-INBOX]).
- Slack: filter chips Unreads, DMs, Mentions, Threads, Reactions, Invitations, Apps,
  Reminders, Cleared; custom views as tabs (src: [SLACK-ACT]).
- Shared pattern: "about me directly" (assigned, mentioned, replied to my comment) is
  separated from "things I follow". Small sites need at most 2 tabs plus an Unread toggle
  (inferred). Practitioners recommend an "everything" view and a "just what involves me"
  view (src: [SAASUI]).

## 3. Row anatomy
- GitHub: reason label per row (src: [GH-ABOUT]); rows also show the repository, item
  type icon, title, time and participant avatars (inferred, common knowledge of the UI).
- Linear: row shows the issue plus configurable issue properties; unread first option
  (src: [LINEAR-INBOX]).
- Asana: a blue dot marks new notifications (src: [ASANA-TIPS]).
- Practitioner guidance: a row says what changed, who did it, whether it needs a response,
  and where it leads; one unread cue is enough (not dot + bold + tint + border together)
  (src: [SAASUI], search summary of [COURIER]).
- Synthesised anatomy: unread dot, actor avatar, one line "Mina assigned you" / "Mina
  commented", the object title (task name), context (project), a one-line snippet of the
  comment, relative time on the right (inferred).

## 4. Grouping
- Notion groups updates by page and by comment thread, collapsible with a caret
  (src: [NOTION-INBOX]).
- ClickUp groups Primary and Other notifications on the same task into one item
  (src: [CLICKUP-HELP]).
- Asana: "Expand" shows all likes, comments and updates for an item; collapsed shows only
  the latest (src: [ASANA-TIPS]).
- Linear: one notification per issue with a configurable grouping (src: [LINEAR-INBOX]).
- Practitioners: group by object, bundle bursts ("Ana and 4 others reacted"); a bundle is
  read as one item (src: [SAASUI]); Fiori groups similar events past a threshold with
  expand/collapse (src: [FIORI], search snippet).
- Shared pattern: ONE row per task (or note), showing the newest event and a count of
  others; date headers (Today, Yesterday, Earlier) above them (inferred).

## 5. Triage actions
- Linear: mark read/unread `U`, mark all read `Alt+U`, delete `Backspace`, delete all read
  `Shift+Backspace`, snooze `H` with natural language times, `J`/`K` to move, `Ctrl/Cmd+F`
  to search; unsubscribe from the issue; 2,000 open notifications kept (src: [LINEAR-INBOX]).
- GitHub: Done (removes, kept 3 months, viewable), Save (kept indefinitely), Unsubscribe,
  Read/Unread, bulk actions on selected rows, preview before acting (src: [GH-INBOX],
  [GH-ABOUT]).
- Notion: read/unread, archive, "Archive read" and "Archive all" buttons; reply to comment
  threads from the inbox (src: [NOTION-INBOX]).
- Asana: archive per item (hover icon), Archive all, Move to Inbox to restore, Bookmarks,
  create a follow-up task from a notification (src: [ASANA-HELP], [ASANA-TIPS]).
- Slack: reply in place (marks read), `R` mark read, `C` clear, checkboxes for bulk clear,
  Cleared view keeps them; hover "..." menu (src: [SLACK-ACT]).
- ClickUp: Clear, Snooze into Later; cleared kept 1 month (src: [CLICKUP-HELP]).
- Shared pattern: two states beyond read/unread: "Done/Archive/Clear" removes from the
  inbox but stays findable; "Snooze/Later" hides until a time. Bulk "mark all read" and
  "archive all read". Actions appear on hover and have single-key shortcuts.
- Recommendation for small sites: Read/Unread, Archive (called "Done" or "Clear"),
  Archive all read, optional Snooze; skip Save/Bookmark (inferred).

## 6. Read semantics and badges
- Jira separates the unseen count (cleared on opening the drawer) from read state
  (src: [ATL-NOTIF]). Community reports show "mark all as read" that does not stick is a
  real frustration (src: [JIRA-COMM]).
- Linear lets you choose what the badge counts (src: [LINEAR-INBOX]).
- Practitioners: cap the badge ("9+" is a convention, not a spec), only "you are needed"
  events raise it, clicking an item marks it read, mark-all-read should offer undo
  (src: [SAASUI]).

## 7. Mobile
- Notion: swipe right to mark read / reply, long swipe left to archive, long press for
  more (src: [NOTION-INBOX]).
- Slack: swipe left to clear (src: [SLACK-ACT]). ClickUp: swipe left to snooze; tab
  switcher as a dropdown (src: [CLICKUP-HELP]).
- Pattern: single column list, open item as a full screen, swipe for the one main action
  with buttons as an alternative (inferred).

## 8. Empty, loading, error
- Notion shows a short message when every type is filtered out rather than a bare empty
  list (src: [NOTION-INBOX]).
- Practitioners: calm "All caught up" message, first-run explanation, skeleton rows while
  loading, distinguish "nothing" from "failed to load" (src: [SAASUI]).
- Asana frames the inbox as "act or archive", aiming at inbox zero (src: [ASANA-TIPS]).

## 9. Retention numbers (product facts, not conventions)
- GitHub: 3 months for non-saved; saved indefinitely (src: [GH-ABOUT]).
- ClickUp: 3 months uncleared, 1 month cleared (src: [CLICKUP-HELP]).
- Asana: archive clears after 4 weeks (src: [ASANA-HELP], search summary).
- Linear: 2,000 open notifications (src: [LINEAR-INBOX]).
- For a small team site, about 90 days of history is a reasonable convention (inferred).

## Numbers in the guide that are conventions, not specs
List width 360-420px in two-pane layout, row height 56-72px, 9+ / 99+ badge cap, 5 second
undo toast, 90 day retention: all synthesised from common practice (inferred).
