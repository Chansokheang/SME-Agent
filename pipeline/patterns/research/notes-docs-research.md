# Research notes: NOTES-DOCS sites (team notes in folders, linked to work)

Scope: Notion, Apple Notes, Obsidian, Confluence, Craft, Bear (Craft and Bear from general
product knowledge only, no source fetched). Researched November 2026.

## Sources
- [NOTION-SIDEBAR] Notion help, "Navigate with the sidebar": https://www.notion.com/help/navigate-with-the-sidebar
- [NOTION-EDIT] Notion help, "Writing and editing basics": https://www.notion.com/help/writing-and-editing-basics
- [NOTION-LINKS] Notion help, "Create links and backlinks": https://www.notion.com/help/create-links-and-backlinks
- [APPLE-NOTES] Apple iPad User Guide, "Search and organise notes": https://support.apple.com/guide/ipad/search-and-organize-notes-ipadc44c8c4a/14.0/ipados
- [MACMOST-NOTES] MacMost, "10 ways to organize your notes": https://macmost.com/10-ways-to-organize-your-notes.html
- [OBS-BACKLINKS] Obsidian help, "Backlinks": https://help.obsidian.md/Plugins/Backlinks
- [CONF-PUBLISH] Confluence support, "Create, edit and publish a page": https://support.atlassian.com/confluence-cloud/docs/create-edit-and-publish-a-page/
- [CONF-WIDTH] Atlassian community, page width (Narrow / Wide / Max): https://community.atlassian.com/forums/Confluence-articles/New-feature-Compact-Mode-and-Max-Width-to-support-information/ba-p/3190468

## Findings

### Structure: shared vs private, folders or a page tree
- Notion's sidebar splits Teamspaces (shared), Shared (with specific people) and Private
  (only me); Favorites appear once you star something (src: [NOTION-SIDEBAR]).
- Pages nest without depth limit, with a toggle per level, "+" and "..." on hover
  (sort, move, delete) (src: [NOTION-SIDEBAR]).
- Apple Notes: notes live in exactly one folder; folders can nest; shared folders let
  everyone create and edit, with a view-only option (src: [MACMOST-NOTES], [APPLE-NOTES]).
- Trash at the bottom of the sidebar; deleted pages kept 30 days (src: [NOTION-SIDEBAR]).
- Sidebar resizable and collapsible with Cmd/Ctrl+\ (src: [NOTION-SIDEBAR]).

### The note list
- Apple Notes: three panes on wide screens (folders, note list, note); list sorted by Date
  Edited by default, optional grouping by date (Today, Previous 7 days...), pinned notes
  always first, list or gallery view (src: [APPLE-NOTES], [MACMOST-NOTES]).
- Rows show title, date and the first line of text (inferred, product knowledge).

### Finding
- Search from the sidebar or Cmd/Ctrl+K, which also shows recently visited pages
  (src: [NOTION-SIDEBAR]).

### Linking notes and work
- Link a page by @ mention or typing [[ and picking from a menu (src: [NOTION-LINKS]).
- Backlinks: listed under the page title with a count that expands, created automatically
  from mentions (src: [NOTION-LINKS]). Obsidian shows "Linked mentions" and "Unlinked
  mentions" with a one-click Link button (src: [OBS-BACKLINKS]).
- Linear-style task mentions render as chips with status (inferred).

### Editing and publishing
- Notion and Apple Notes save continuously; there is no Save button (inferred, widely
  known). Confluence pages have drafts and a Publish button, while its "live docs" publish
  instantly (src: [CONF-PUBLISH]). For small-team notes, live editing without publish is
  the expected model (inferred).
- Width choices: Notion "Full width" toggle (src: [NOTION-EDIT]); Confluence Narrow / Wide
  / Max (src: [CONF-WIDTH]). Default is a narrow reading column.

## Where they differ, and the choice for a small business
- Folders (Apple Notes, Bear tags) vs nested pages (Notion, Confluence). For a team with
  a few dozen notes, one level of folders inside Team / Private is easier; allow nesting
  of folders but not pages-inside-pages (inferred).
- Three-pane (Apple Notes) vs tree-and-page (Notion). Three-pane suits short notes;
  tree-and-page suits longer docs. Use a note list in the middle on wide screens, collapsing
  to two panes at medium widths (inferred).
