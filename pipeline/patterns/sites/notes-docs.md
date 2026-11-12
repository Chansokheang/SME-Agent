# Site guide: NOTES-DOCS (team and private notes in folders, linked to work)

Studied: Notion, Apple Notes, Obsidian, Confluence, Craft, Bear

People come to a notes site to find something they or a teammate wrote, and to write or
update a note quickly. The leading products put the tree of places (shared vs private,
then folders) on the left, the most recently edited notes first, a search that is one key
away, and an editor that saves as you type. A note is a clean page with a big title and a
narrow reading column, and links to other notes and tasks show both ways. Sources:
`out/research/notes-docs-research.md` (researched Nov 2026).

## What the first screen shows
- **On wide screens, three panes** (the Apple Notes model, best for many short notes):
  1. Sidebar (240-280px): the places and folders.
  2. Note list (300-360px): notes in the chosen folder, newest edited first.
  3. The open note (the rest, text in a centred 680-760px column).
  On medium screens the note list and the note share the space (list, then note on click).
- **Default selection**: "All notes" or the last folder used, with the most recently
  edited note open (or nothing open and a quiet "Select a note or create one").
- **A "New note" button** at the top of the note list (and Ctrl/Cmd+Alt+N); it creates the
  note in the current folder and puts the cursor in the title.
- **No dashboard**, no "getting started" checklist on the main screen.

## The main flow, step by step
1. **Find**: open the folder or press Ctrl/Cmd+K; the search box shows recent notes
   straight away, then matches in titles and text as you type, with the matching words
   highlighted.
2. **Read**: the note opens to the right; the title, then a muted line "Edited 2 h ago by
   Kim · Team notes / Meetings", then the text.
3. **Write**: click anywhere and type; formatting via toolbar, "/" menu and Markdown
   shortcuts (see `pages/editor.md`). A small status says "Saving..." then "Saved".
4. **Link**: type "@" or "[[" to link a task or another note; it becomes a chip with the
   task's checkbox or the note's title. The linked task shows this note under "Linked
   notes", and the note shows "Linked from" (backlinks) at the bottom.
5. **Organise**: drag a note onto a folder, or "..." > "Move to..." with a folder picker;
   pin important notes to the top of their folder.

## Navigation and structure
- **Sidebar order**: Search; "All notes" / Recent; Pinned or Favourites (only when there
  are some); **Team notes** (shared with everyone) with its folders; **My notes** (only
  me, with a small lock icon and the words "Only you") with its folders; Trash at the
  bottom. Folders show a count, expand with a chevron, and have "+" and "..." on hover
  (rename, new subfolder, delete).
- **Pages**: Notes (folder + list), Note (its own URL), Search results, Trash. Settings
  live with the rest of the site.
- **Privacy is visible**: a note in My notes says so near its title; moving a note from
  private to team (or back) asks once: "Move to Team notes? Everyone in the team will be
  able to see and edit it."
- **Phones**: one pane at a time: folders -> list -> note, with a back arrow; a "New note"
  button bottom-right; the editor toolbar sits above the keyboard.

## The key components
- **Folder row**: chevron, folder icon, name, count; the current folder highlighted with a
  tint, not a bold border.
- **Note row** in the list (64-80px): title (semibold, one line), a muted date ("10:42",
  "Yesterday", "3 Nov") and the first line of the text (one or two lines, muted); a pin
  icon when pinned; optionally the author avatar for team notes. Group headers by date
  (Today, Previous 7 days, Previous 30 days, then months) when sorted by date.
- **Sort and view**: a small menu at the top of the list: Date edited (default), Date
  created, Title; list or compact.
- **Note header**: big title (28-32px), optional icon, meta line, then a row of actions on
  the right of the top bar: Share/visibility, Pin, "..." (Move, Duplicate, Copy link,
  Export, Delete).
- **Backlinks and linked tasks**: at the end of the note (or a collapsible "2 links" under
  the title): each linked task with its checkbox, status and due date; each linking note
  with title and folder.
- **Search panel**: a centred dialog (560-640px) with input, results grouped by type
  (Notes, Tasks, Projects), keyboard arrows and Enter.

## States and messages
- **Empty folder**: "No notes in Meetings yet" and "New note".
- **Empty My notes**: "Your private notes live here. Only you can see them."
- **Saving**: "Saving..." / "Saved" as small muted text in the top bar; on failure "Not
  saved. Retrying..." in warning colour and the text stays in the editor (also kept in the
  browser so a reload doesn't lose it).
- **Someone else editing**: their avatar in the top bar; if no live co-editing, a banner
  "Kim is editing this note" and conflicts never silently overwrite.
- **Deleted**: "Note moved to Trash - Undo"; Trash keeps notes 30 days, with Restore and
  Delete forever.
- **No search results**: "No notes or tasks match 'invoice'" and a hint to check spelling
  or search all folders.
- **Linked task deleted**: the chip shows struck through, "Deleted task".

## What the leaders get right
- No Save button, ever; the save status is visible but quiet.
- Recently edited first: what you want is almost always near the top.
- Private and shared are separate places with clear words, not a hidden permission field.
- Links go both ways, so notes and tasks find each other.
- The writing column is narrow and calm, whatever the screen width.

## Common mistakes to avoid
- A rich-text toolbar of 25 icons above every note.
- Notes as cards in a masonry grid with coloured backgrounds (feels like sticky notes,
  scans badly).
- Folders nested five deep for a team of five.
- Full-width text lines on a wide monitor.
- Silent overwrites when two people edit; losing text on a network blip.

## Style: what this kind usually looks like, and where there is room to be different
- Paper-like: white or warm off-white page, tinted sidebar, almost no borders; text
  16-17px with line-height 1.6-1.7; headings only slightly larger than body.
- Colour is used sparingly: the accent for links, selection and the active folder.
- A serif for the note body or titles is a well-accepted way to give it a writing feel;
  a clean sans for the interface.
- Room to be different: the reading typeface, the paper tone, folder icons, the empty
  states' voice. Keep the panes, the order of places and the always-on autosave.
