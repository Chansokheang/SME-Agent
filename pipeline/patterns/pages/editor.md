# Page guide: EDITOR (writing a rich-text note or document)

Studied: Notion, Confluence, Craft, Apple Notes, Google Docs

How the leading writing tools lay out a document being written (Notion, Confluence pages
and live docs, Craft, Apple Notes, Google Docs, and the open block editors built in their
image: BlockNote, Tiptap templates). People already know this page: a big title, a calm
narrow column of text, formatting that appears when needed, "/" to insert, and saving
that just happens. Follow it, then make it the owner's own through STYLE. Sources:
`out/research/editor-research.md` (researched Nov 2026). Never copy a product's name,
logo, wording or exact look.

## Layout (desktop)
- **Top bar, slim (44-48px)**: on the left, the sidebar toggle and a breadcrumb of where
  the note lives ("Team notes / Meetings / Weekly 9 Nov"); on the right, the save status
  ("Saving..." / "Saved", muted 12px), the avatars of others viewing, a visibility or
  Share button ("Team" or "Only you"), and "..." (Full width, Move to..., Duplicate, Copy
  link, Export, Version history, Delete). No permanent formatting toolbar here.
- **The page**: a centred column of **680-760px** (Full width option: up to about
  1100px), padding 24px on phones, 48-96px top space on desktop.
  1. Optional small icon or emoji-free symbol and a cover, added from faint "Add icon"
     controls that appear only on hover above the title.
  2. **Title**: 32-40px, bold or semibold, placeholder "Untitled". Enter moves to the body.
  3. **Meta line** (muted 13px): "Edited 5 min ago by Kim", folder, and "2 linked tasks"
     which jumps to the links section.
  4. **Body**: 16px (15-17px), line-height 1.6-1.7, paragraph spacing about 0.75em;
     headings only a step or two larger (H1 about 1.5em, H2 1.25em, H3 1.1em).
  5. **Links section at the end**: "Linked tasks" (each with checkbox, title, status, due
     date) and "Linked from" (notes that link here). Collapsed counts if long.
- **Sidebar** of folders on the left (as in `sites/notes-docs.md`), collapsible with
  Ctrl/Cmd+\ so the writer can focus.

## Writing controls
- **Placeholder on an empty line**: "Type '/' for commands" in muted text, only on the
  focused empty line.
- **"/" menu**: a floating list (260-320px wide, max about 10 visible) under the cursor
  with groups: Text, Heading 1-3, Bulleted list, Numbered list, To-do, Quote, Divider,
  Code, Image, Table, Link to task, Link to note. Each item has an icon, a name and its
  Markdown shortcut in muted text. Typing filters; arrows and Enter choose; Esc closes.
- **Selection toolbar**: selecting text shows a small floating bar just above the
  selection: Turn into (Text/Heading/List), Bold, Italic, Underline, Strike, Code, Link,
  Highlight colour, Comment. 32px buttons, tooltips with shortcuts.
- **Markdown shortcuts while typing**: "# " heading, "- " or "* " bullet, "1. " numbered,
  "[] " to-do, "> " quote, "```" code, "---" divider, **bold**, *italic*, `code`.
- **Block handle**: hovering a block shows, in the left margin, a "+" (insert below) and a
  six-dot drag handle. Dragging moves the block with a 2px drop line; clicking the handle
  opens Turn into, Duplicate, Move up/down, Copy link to block, Delete.
- **Links and mentions**: "@" or "[[" opens a search popup for tasks, notes and people.
  A task becomes an inline chip with its checkbox and title (checking it completes the
  task); a note becomes a link with a small page icon; a person becomes a highlighted
  name and gets a notification. Pasting a URL on a selection makes a link; pasting on an
  empty line offers "Link" or "Embed / preview".
- **Images and files**: paste, drop, or "/" > Image. A placeholder with progress while
  uploading; images fit the column, with a caption line and alignment options on hover.
- **Tables**: simple, column-width handles, add row/column with "+" on edges; scroll
  sideways inside the column on small screens.
- **Undo/redo**: Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z; whole-block operations undo as one step.

## Saving and versions
- **No Save button.** Changes save 0.5-2s after typing pauses and on blur; the status in
  the top bar goes "Saving..." -> "Saved" (and "Saved" fades to a muted "Edited just now").
- Unsaved changes are also kept in the browser, so a crash or offline period never loses
  text; "Offline - changes will save when you reconnect".
- Leaving the page while saving waits or warns ("Changes are still saving").
- **Version history** in "...": a list of earlier versions by time and author with a
  preview and "Restore".
- **Two people at once**: live cursors and coloured names when real-time editing is
  supported; otherwise lock-free with a banner "Kim is also editing" and never a silent
  overwrite (show "This note changed. Reload to see the latest" with the user's text kept).

## First screen and states
- **New note**: the cursor is in the empty title; the body placeholder shows below. A new
  note left empty and closed is discarded, not saved as "Untitled".
- **Loading**: title and 4-6 skeleton lines in the column shape.
- **Read-only** (no edit rights or in Trash): a slim banner at the top ("This note is in
  Trash" with Restore / "You can view this note") and no editing affordances.
- **Not found / deleted**: a short message and a link to Notes.
- **Saving failed**: status turns warning-coloured "Not saved - Retrying", with "Retry
  now"; the text stays.
- **Very long notes**: a small "Contents" outline from the headings may float to the right
  on wide screens (only when there are 3+ headings).

## Phones
- Full-width column with 16-20px side padding; title 26-28px.
- A **formatting bar docked above the keyboard** (scrolls sideways): "/" insert, Bold,
  Italic, List, To-do, Heading, Link, Image, Undo, Hide keyboard. The selection toolbar is
  replaced by this bar.
- Block handles appear on tap-and-hold of a block, not on hover.
- Use `100dvh` and safe-area padding so the bar and cursor are never hidden.

## Motion
- Menus and toolbars fade and scale from 98% (120-150ms); they never slide across the text.
- Block drag: the block lifts slightly, the drop line moves smoothly (100ms), the block
  settles (150ms) with `cubic-bezier(0.22, 1, 0.36, 1)`.
- Save status changes with a quiet fade. Nothing animates inside the text while typing.
- With reduced motion: fades only.

## Accessibility
- The body is a labelled editable region (`role="textbox"`, `aria-multiline="true"`,
  labelled "Note body"); headings, lists and links use real semantic elements.
- The "/" and "@" menus are combobox listboxes with `aria-activedescendant`; the selection
  toolbar is a `toolbar` reachable with a shortcut (e.g. Alt+F10) and arrow keys.
- Every block action (move, delete, turn into) is available from the keyboard, not only
  by dragging; Ctrl/Cmd+Shift+Up/Down moves a block.
- Enter is ignored while an input method is composing (Korean, Japanese, Chinese), and
  Markdown shortcuts never fire mid-composition.
- Save status changes are announced politely only on failure and on recovery.
- Contrast: body text 4.5:1 (7:1 preferred for long reading), placeholders still readable
  (at least 4.5:1 is ideal; muted but clear).

## Looks cheap: avoid
A fixed toolbar of 20+ icons like a word processor; full-width text lines on a wide
screen; a Save button or "Draft saved" toasts every few seconds; tiny 13px body text;
headings three times the body size; coloured backgrounds behind every block; drag
handles visible on every line at all times; a modal for inserting links; losing text on
a network blip; and a generic "Start writing your amazing content!" placeholder.
