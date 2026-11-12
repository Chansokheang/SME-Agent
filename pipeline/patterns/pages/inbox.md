# Page guide: INBOX (notifications and activity that need my attention)

Studied: Linear, GitHub, Notion, Asana, ClickUp, Slack, Jira

How the leading work tools lay out the place where a person sees what was assigned to
them, who mentioned or replied to them and what changed on things they follow, and
clears it (Linear Inbox, GitHub Notifications, Notion Inbox, Asana Inbox, ClickUp Inbox,
Slack Activity, the Jira / Atlassian notification drawer). People already know this page
from those tools: a list of grouped events, unread ones marked, a reading pane, and quick
"done" actions with keyboard shortcuts. Follow it, then make it the owner's own through
STYLE. Sources: `out/research/inbox-research.md` (researched Nov 2026). Never copy a
product's name, logo, wording or exact look.

## What this page is for
Triage, not reading history. Every row should answer: who did what, to which thing, does it
need me, and where does it lead. The goal the leaders share is "act or archive" until the
list is empty. An activity log of the whole team is a different page.

## Layout (desktop)
- **App shell as on every page**: the left sidebar (about 240-260px) has an "Inbox" item
  near the top with an unread count ("3", capped at "99+"). Optionally a bell in the top
  bar that shows the same count; one of the two, not both, on a small site.
- **Two panes on wide screens (1100px and up)**:
  - **List pane, left, 360-420px**, its own scroll.
  - **Reading pane, right, the rest**: the task (or note) the selected notification is
    about, with the triggering comment or change highlighted and scrolled into view. It
    is the same detail view the site uses elsewhere (a task side panel), so people can
    reply, change status or reassign without leaving the inbox.
  - With nothing selected the reading pane shows a quiet line: "Select a notification to
    see it here", or auto-selects the first unread row.
- **Narrower desktops (768-1100px)**: a single centred list column (max about 720px);
  clicking a row opens the task as a side panel over the right part of the page (about
  480-560px wide), list still visible behind it.
- **List pane header** (sticky, about 48-56px):
  - Title "Inbox" left.
  - Two tabs underneath or beside it: **"For me"** (assigned to me, mentions, replies on
    my comments, comments on my tasks, due-date reminders) and **"Following"** (changes
    on tasks I created or follow). Only "For me" feeds the sidebar count. A small site
    may ship with a single list and a filter instead; never more than 3 tabs.
  - On the right: an **"Unread only" toggle**, a filter menu (type: Assigned, Mentions,
    Comments, Due dates; and Project), and a "..." menu with **Mark all as read** and
    **Clear all read**. A link to notification settings sits at the bottom of that menu.
- **Date group headers** inside the list: Today, Yesterday, This week, Older. Small
  (12-13px), muted, sticky while their group scrolls.

## The row (the key component)
One row per THING (task or note), not per event. Height 56-72px, padding 12px 16px,
full-width click target.
- **Left, 8px unread dot** in the accent colour, in its own fixed column so text never
  shifts. That is the ONLY unread cue besides slightly stronger title weight. No tinted
  background, no left border on top of the dot.
- **Avatar, 24-32px**, of the person who acted (a small system icon for reminders and
  due-date alerts, never a bot face).
- **Line 1**: the event, in plain words, actor name bold: "Mina assigned you", "Jun
  commented", "Sara mentioned you", "Due today". When several events are bundled:
  "Mina and 2 others commented" or "3 updates".
- **Line 2**: the task title (one line, ellipsis), then the project name muted.
- **Optional line 3**: a one-line snippet of the comment text, muted, only for comments
  and mentions.
- **Right**: relative time ("5m", "2h", "Yesterday", "Mar 4"), full date on hover. Under
  it a small reason chip when the tab mixes reasons ("Assigned", "Mention", "Due").
- **Hover / focus actions** replace the time on the right: **Mark read/unread**,
  **Clear** (check icon, "Done"), and **Snooze** if the site supports it. Icon buttons
  28-32px, each with a tooltip that includes its shortcut.
- **Selected row**: neutral tinted background and the reading pane follows it.
- Clicking a row marks it read. Opening the inbox does NOT mark everything read; it only
  resets the "new since last visit" count if the site keeps one.

## Actions and their meanings
- **Read / Unread**: a toggle. Unread items come back by marking unread.
- **Clear** (also called Done or Archive): removes the row from the inbox. Cleared items
  are kept and reachable through a "Cleared" view in the filter menu for about 90 days.
  Clearing an unread row also marks it read.
- **Snooze** (optional): "Later today", "Tomorrow", "Next week", "Pick a date". The row
  disappears and returns at the top at that time. Snoozed items listed under a "Snoozed"
  view.
- **Bulk**: hovering the avatar shows a checkbox; selecting one shows a bar at the top of
  the list: "3 selected · Mark read · Clear · Cancel". Shift+click selects a range.
- **Mark all as read** and **Clear all read** in the header menu, followed by a 5 second
  undo toast at the bottom ("12 notifications cleared. Undo").
- **Act in place**: in the reading pane, replying to the comment, ticking the task done or
  changing its status should also offer to clear the notification (or clear it
  automatically, then select the next row).
- **Stop notifications for this task**: "Unfollow" in the reading pane's menu. Mentions
  still arrive afterwards.

## Grouping rules
- Bundle all unread events on the same task into one row, showing the newest event and
  "+N"; the row's time is the newest event's time and it moves to the top.
- In the reading pane, the bundled events are listed at the top ("3 new: Mina commented,
  Jun changed due date to Fri, Mina commented"), each linking to its spot in the activity.
- A bundle is read and cleared as ONE item and counts as one in the badge.
- Never bundle across different tasks ("5 tasks updated"): the reader can't act on that.

## First screen
- The tab "For me" with "Unread only" off, newest first; unread rows at the top of each
  date group or simply newest first (choose one and keep it).
- The first unread row selected in the reading pane on wide screens.
- Nothing else: no stats, no welcome banner, no "tips" card. The list IS the page.

## States
- **Empty (all cleared)**: centred in the list pane, a small quiet line icon, "You're all
  caught up", and one muted line under it: "New assignments, mentions and comments will
  appear here." Optional link "See cleared". Calm, no confetti.
- **First run (never had a notification)**: same position, explain what lands here and
  link to notification settings.
- **Filtered to nothing**: "No unread notifications" / "Nothing matches these filters"
  with a "Clear filters" button. Never the "caught up" message when filters hide items.
- **Loading**: 6-8 skeleton rows with the dot, avatar and two line blocks; no spinner in
  the middle of an empty page, no flash of the empty state.
- **Error**: inline in the list pane: "Couldn't load notifications." with a Retry button.
  Never shown as "all caught up".
- **New items arriving while open**: do not push the list down under the reader. Show a
  small pill at the top of the list "2 new" that loads them when clicked; update the
  sidebar count right away.
- **The task was deleted or access removed**: the row stays, greyed, with "This task was
  deleted" and only the Clear action.
- **Many items**: load 50 at a time with infinite scroll or "Load more" at the bottom;
  keep about 90 days of history.

## Phones (under 768px)
- One column, full width. The header becomes: title, a tab switcher (segmented control or
  a dropdown), and a filter icon that opens a bottom sheet with the filters and "Mark all
  as read".
- Tapping a row opens the task full screen with a back arrow; returning keeps the scroll
  position and the row now read.
- Swipe left on a row to Clear (with the coloured action revealed behind it and an undo
  toast), swipe right to toggle read. Swipes are a shortcut only: the same actions are in a
  long-press menu and in the task screen's menu.
- Rows 64-72px tall, touch targets at least 44px, avatar 32px.
- The bottom navigation (if the site has one) shows the inbox count on its Inbox item.

## Keyboard (desktop)
Leaders all offer single-key triage; the common set is:
- `J` / `K` or arrows: move between rows (the reading pane follows).
- `Enter`: open / focus the reading pane; `Esc`: back to the list.
- `E` or `Backspace`: clear; `U`: toggle read; `H`: snooze (if offered).
- `Shift+U` (or `Alt+U`): mark all read, with undo.
- `G` then `I`: go to the inbox from anywhere.
- Shortcuts are disabled while typing in a reply field. A "?" help sheet lists them.

## Look (style comes from the owner; these are the conventions to keep)
- Near-monochrome list; the owner's accent only on the unread dot, the selected tab
  underline, the count badge and links.
- Body 14px in rows (line 1 and 2), 12-13px for time, project and snippet. Read rows keep
  the same colours but normal weight; do not grey read rows to unreadable.
- Thin dividers between rows OR spacing, not both with cards. Rows are not cards.
- Radius 6-8px on the selected / hover row background and on chips.
- No shadows except on menus, the bulk bar and the undo toast.

## Motion
- A cleared row collapses its height and fades (about 200ms), the next row moves up, and
  the selection moves to the next row; never jump the scroll position.
- The "2 new" pill slides down from the list header (200ms). New rows fade in once loaded.
- Hover actions fade in (120-150ms). The reading pane swaps content with a quick fade
  (150ms), no sliding between items.
- The mobile swipe follows the finger and snaps back if not past the threshold.
- Easing `cubic-bezier(0.22, 1, 0.36, 1)`. With reduced motion: no collapse animation,
  instant removal, simple fades only.

## Accessibility
- The list is a `list` (or `listbox` in a two-pane layout with arrow-key navigation);
  each row has an accessible name that starts with "Unread," when unread, e.g. "Unread,
  Mina commented on Prepare March invoice, Finance, 2 hours ago".
- The sidebar count is part of the link name: "Inbox, 3 unread".
- One polite live region announces "2 new notifications" and the result of bulk actions
  ("12 cleared"); individual arrivals are not announced one by one.
- Hover actions are also reachable by keyboard focus on the row (`Tab` into them) and by
  the shortcuts; on touch they are in the long-press menu.
- After clearing, focus moves to the next row (or the empty-state message), never to the
  page top.
- Unread is never shown by colour alone: the dot plus the bolder title, and the "Unread"
  text for screen readers.
- Contrast: text 4.5:1 including muted snippets and times; the dot and icons 3:1.

## Looks cheap: avoid
A raw newest-first log with one row per event (ten rows for one busy task), a badge that
never reaches zero because "following" updates feed it, opening the page marking
everything read, "mark all read" that comes back after a refresh, four unread cues at
once (dot, tint, border, bold), rows as heavy cards with shadows, rows that only say
"Task updated" without who or what, a notification that opens a page where the change
can't be found, robot avatars for system events, toasts for every incoming
notification, no way to see cleared items, and a cheerful illustration-heavy empty state
that takes the whole screen.
