# Research notes: EDITOR pages (writing a rich-text note or document)

Scope: Notion, Confluence, Craft, Apple Notes, Google Docs, plus open-source block editors
that copy them (BlockNote, Tiptap). Craft, Google Docs and Tiptap from general product
knowledge; BlockNote's docs page was readable only in part. Researched November 2026.

## Sources
- [NOTION-EDIT] Notion help, "Writing and editing basics": https://www.notion.com/help/writing-and-editing-basics
- [NOTION-LINKS] Notion help, "Create links and backlinks": https://www.notion.com/help/create-links-and-backlinks
- [NOTION-SIDEBAR] Notion help, "Navigate with the sidebar": https://www.notion.com/help/navigate-with-the-sidebar
- [CONF-PUBLISH] Confluence support, "Create, edit and publish a page": https://support.atlassian.com/confluence-cloud/docs/create-edit-and-publish-a-page/
- [CONF-WIDTH] Atlassian community, page width Narrow / Wide / Max: https://community.atlassian.com/forums/Confluence-articles/New-feature-Compact-Mode-and-Max-Width-to-support-information/ba-p/3190468
- [CONF-LIVE] k15t, "Rethinking Confluence with live pages": https://k15t.com/rock-the-docs/news/2024/11/51-rethinking-confluence-with-live-pages
- [BLOCKNOTE] BlockNote docs (ready-made animated UI with built-in menus and toolbars): https://www.blocknotejs.org/docs
- [OBS-BACKLINKS] Obsidian help, "Backlinks": https://help.obsidian.md/Plugins/Backlinks

## Findings

### Inserting and formatting
- "/" opens a menu of blocks and actions, filtered as you type ("/bullet"); Esc closes
  (src: [NOTION-EDIT]).
- Selecting text shows a floating formatting toolbar (src: [NOTION-EDIT]).
- Markdown shortcuts: **bold**, *italic*, `code`, ~strike~; "- " bullet, "[] " to-do,
  "# " heading at line start (src: [NOTION-EDIT]).
- Block editors ship the same trio: formatting toolbar, slash menu, side menu with "+"
  and drag handle (src: [BLOCKNOTE], partly; details inferred from the library's demo).

### Blocks
- A drag handle appears in the left margin on hover; drag to move a block, click for Turn
  into, Duplicate, Move to, Delete, Comment (src: [NOTION-EDIT]).

### Links and mentions
- "@" mentions people (and notifies them) and pages; "[[" or "+" links a page from a menu
  (src: [NOTION-LINKS]).
- Pasted URLs can become compact mentions with icon and title and a hover preview
  (src: [NOTION-LINKS]).
- Backlinks listed under the title with a count (src: [NOTION-LINKS]); Obsidian lists
  linked and unlinked mentions with a one-click Link (src: [OBS-BACKLINKS]).

### Saving and publishing
- Confluence pages: draft then "Publish" top-right; Confluence live docs: no drafts,
  changes visible instantly (src: [CONF-PUBLISH], [CONF-LIVE]). The trend is toward
  live, continuously saved documents (src: [CONF-LIVE]).
- Notion, Apple Notes, Google Docs save continuously with a status indicator (inferred,
  widely known).

### Width
- Default is a fixed narrow column; a Full width toggle in the page menu (src:
  [NOTION-EDIT]); Confluence offers Narrow, Wide, Max (src: [CONF-WIDTH]). Users complain
  when the narrow column cannot be widened (src: [CONF-WIDTH]).

### Trash and recovery
- Deleted pages go to Trash for 30 days (src: [NOTION-SIDEBAR]).

## Conventions, not specs
Body text 16px, line-height 1.6-1.7, column 680-760px, title 32-40px: observed conventions
(inferred). Autosave debounce of 0.5-2s is an implementation convention (inferred).
