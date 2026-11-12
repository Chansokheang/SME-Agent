# Page guide: CHAT (a conversation with an assistant)

Studied: ChatGPT, Gemini, Claude, Perplexity, Le Chat, Microsoft Copilot

How the leading chat apps lay out a conversation (ChatGPT, Gemini, Claude, Perplexity,
Le Chat, Copilot, and the open kits built on them: Vercel's chatbot template / AI
Elements, assistant-ui). People already know this layout: follow it, then make it the
owner's own through STYLE (colours, type, shape, imagery), never by inventing a new
layout. Sources: `pipeline/patterns/research/chat-research.md` (researched Nov 2026).
Never copy a product's name, logo, wording or exact look.

## Layout (desktop)
- **Sidebar, left, about 260px**, a slightly tinted neutral separated by tone, not a heavy
  border. Top: a "New chat" button (and search when there is history). Middle: past
  conversations grouped by date (Today, Yesterday, Previous 7 days, Older), one line each,
  the open one highlighted, a "..." menu on hover (rename, delete). Bottom: the account.
  It collapses to a slim rail or off-canvas (a toggle in the top bar; Ctrl/Cmd+B).
- **Top bar, slim**: the sidebar toggle, the conversation title, and on the right only what
  the plan needs (model or document scope picker, share). No marketing navigation.
- **Thread, a centred reading column of about 720-768px**, 16px side padding on phones,
  24px on desktop, 24-28px between turns.
  - **Your messages**: right-aligned in a neutral grey bubble (radius about 20px, at most
    70-80% of the column, padding 10px 16px). No avatar.
  - **Assistant answers**: plain prose across the column, NO bubble, NO avatar. Markdown:
    headings only slightly larger than body, real lists, tables that scroll sideways
    inside themselves, code blocks with a language label and a copy button.
- **Composer, docked at the bottom of the thread column**: a large rounded box (radius
  24-28px, hairline border, faint shadow at most) that grows with the text up to about
  200px, then scrolls inside. Left: attach / tools. Right: a round 32-36px send button in
  the foreground colour that turns into a Stop button while an answer is being written.
  Under it, one small centred line, e.g. "Answers come from your documents. Check
  anything important." (12px, muted).

## First screen (no messages yet)
- A short greeting (one line, maybe a second) and the composer centred slightly above the
  middle of the page; after the first message the composer moves to the bottom dock.
- 3-5 quiet suggested questions written for THIS business and its documents, as a short
  list or small chips (never a big grid of cards with icons), hidden once typing starts.
- No hero, no logo splash, no feature list. The tool IS the page.

## States
- **Waiting / working**: a shimmering status line ("Reading your documents...",
  "Writing...") in place of bouncing dots; optional collapsible "Checked 4 passages" row.
- **Streaming**: the answer grows in place with a soft caret at the end; the Stop button
  stops it and keeps what was written.
- **Errors**: inline, where the answer would be, with a Retry button; the user's message
  and draft are never lost. Never a generic toast.
- **No answer in the documents**: say so plainly and suggest what to upload or ask instead.
- **Regenerate and edit** keep earlier versions with a "< 2/2 >" switcher; editing an
  earlier question turns it into an editor in place.
- **Long conversations**: a small round "scroll to bottom" button above the composer,
  shown only when not at the bottom. Auto-scroll follows the answer only while the
  reader is at the bottom; the moment they scroll up, it stops.

## Sources and citations (essential for an assistant that answers from documents)
Four layers, all real and clickable:
1. **Inline chip** at the end of the sentence it supports: "Handbook · p.4", "+2" when
   several sources back it.
2. **Hover / tap card**: the document name, page or section, and the QUOTED passage, with
   a 1/N stepper when several.
3. **"N sources" row** under the answer, listing each document.
4. **Source panel** (right side on desktop, a sheet on phones) showing the passage in its
   document with the cited text HIGHLIGHTED, while the answer stays visible. The leading
   apps rarely highlight the exact passage: doing it is how this assistant earns trust.
Never show a citation that opens nothing or a source the answer didn't use.

## Message actions
Copy, thumbs up / down, regenerate, and "..." (share, edit, delete) as small icon buttons
under each answer: hidden while it is being written, always visible on the latest answer,
on hover or keyboard focus for older ones, always visible on touch screens. Each has a
label and tooltip.

## Phones
The sidebar becomes a drawer (about 288px) from a menu button. The page uses `100dvh` and
safe-area padding so the keyboard never hides the composer; the composer stays docked and
the thread scrolls above it. Source panel and citation cards open as bottom sheets.

## Look (style comes from the owner; these are the conventions to keep)
- Near-monochrome surfaces; the owner's brand colour in small places only (links, focus
  ring, active item, the send button may stay ink-coloured). A designed dark mode.
- Message text 15-16px, line-height about 1.6; a readable UI sans. A serif for answers is
  a valid choice for a "reading" feel.
- Radii: large on the composer and your bubbles, 8-12px on cards, code blocks and popovers.
- Almost no shadows: only on floating things (popovers, the scroll-to-bottom button).

## Motion (gpt-taste's hover physics, placed for a conversation)
- Hover physics on buttons, suggestions and source cards (small lift or scale, 200ms).
- Your new message rises in (fade + 8-10px, about 250ms); answers grow by streaming, not by
  an entrance animation. Greeting and suggestions ease in on first load (400-500ms,
  small stagger). Actions fade in (150ms). The scroll-to-bottom button scales in (200ms).
- The composer grows smoothly, and slides from the centre to the dock after the first
  message (about 250ms). The sidebar slides (about 200ms).
- Easing `cubic-bezier(0.22, 1, 0.36, 1)`. No bounce, no typewriter letters, no confetti,
  and nothing pins, scrubs or fades the thread while someone reads.
- With reduced motion: no transforms or shimmer, keep simple fades.

## Accessibility
- Enter sends, Shift+Enter adds a line, and Enter is ignored while an input method is
  composing (`e.nativeEvent.isComposing`): essential for Korean, Japanese and Chinese.
- The thread is `role="log"`; each message an `article` labelled "You said" / "Assistant
  said". One polite live region announces "Answering..." and "Answer ready", never every
  streamed word; the answer being written has `aria-busy="true"`.
- Focus returns to the composer after sending, after Stop and on a new chat. Stop is
  reachable by keyboard. Every icon button has a label; citation chips are real buttons
  named "Source: Handbook, page 4".
- Contrast: text at least 4.5:1, icons and borders at least 3:1 (faint action icons fail).

## Looks cheap: avoid
Bubbles and avatars on both sides (messenger look), gradient or purple glow bubbles and
sparkle icons, a robot avatar on every answer, typewriter or bouncing dots, a tiny input
that doesn't grow or has no Stop, full-width lines on wide screens, a grid of 6-8 generic
suggestion cards with emoji, citations that don't open, toolbars on every message while it
streams, yanking the reader to the bottom, toast errors that lose the message, and the
untouched default "How can I help you today?" with four cards.
