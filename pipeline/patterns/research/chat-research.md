# Chat / AI-assistant page patterns: research notes (as of Nov 2026)

Scope: shared UI patterns across ChatGPT, Gemini app, Claude.ai, Perplexity, Mistral Le Chat and Microsoft Copilot, plus open-source chat kits (Vercel chatbot template / AI Elements, assistant-ui, LibreChat, Open WebUI, shadcn). Only public sources were used. Nothing was logged into.

Legend:
- **(src: ...)** marks where a claim comes from.
- **(inferred)** marks my synthesis or general observation, not something read in a source.
- "Majority" means at least 4 of the 6 leading apps, or the kits copying them.

Source-quality caveat: OpenAI, Anthropic and Perplexity publish few UI specs. Exact pixel values come from (a) open-source clones and templates that copy the live apps (the assistant-ui "ChatGPT clone" and the Vercel chatbot template) and (b) third-party UX teardowns (aiuxplayground.com / ai-design-patterns.pages.dev). Treat the numbers as conventions, not official specs.

Key sources (short names used below):
- [VC] Vercel chatbot template source, github.com/vercel/chatbot (components/chat/*.tsx, components/ai-elements/*.tsx). Read directly.
- [AIE] AI Elements component list, elements.ai-sdk.dev. The page says AI Elements is "moving to shadcn/ui", with deprecation at the end of Nov 2026.
- [AUI-T] assistant-ui Thread element, assistant-ui.com/elements/thread.md
- [AUI-GPT] assistant-ui ChatGPT clone, assistant-ui.com/examples/chatgpt.md
- [AUI-SCROLL] assistant-ui.com/elements/scroll-anchor.md
- [AUI-DOC] assistant-ui.com/elements/document-reference.md
- [AUI-RC] assistant-ui.com/elements/retrieval-chunks.md
- [TD-PPLX] ai-design-patterns.pages.dev/teardowns/perplexity/citations
- [TD-GPT-CIT] aiuxplayground.com/teardowns/chatgpt/citations
- [TD-GPT-OUT] aiuxplayground.com/teardowns/chatgpt/output
- [TD-CLAUDE] aiuxplayground.com/teardowns/claude/output
- [TD-CMP] aiuxplayground.com/teardowns/compare/output-artifacts-refinement
- [G-SRC] support.google.com/gemini/answer/14143489 (Gemini sources and double-check)
- [SER-GPT] seroundtable.com/chatgpt-search-38337.html (ChatGPT search launch) and seroundtable.com/openai-chatgpt-sources-less-visible-41864.html (Sources button moved into the "..." menu, Aug 2026)
- [SHADCN-SB] ui.shadcn.com/docs/components/sidebar
- [LC] LibreChat user guide (mintlify.com/danny-avila/librechat/user-guide/conversations); [OWUI] docs.openwebui.com/features/chat-conversations/chat-features/history-search
- [A11Y] azukiazusa.dev/en/blog/accessible-streaming-chat-ui, tianpan.co/blog/2026-04-17-ai-accessibility-streaming-screen-readers
- [KB] dev.to/franciscomoretti/fix-mobile-keyboard-overlap-with-visualviewport-3a4a, plus the iOS PWA composer thread (yomotherboard.com/?p=499353)
- [MS365] microsoft.com/en-us/microsoft-365/blog/2026/05/28/introducing-a-new-design-for-microsoft-365-copilot; engadget.com/2183246/microsoft-debuts-a-more-buttoned-up-look-for-copilot
- [GEM-UI] androidcentral.com (Gemini "My Stuff" refresh), 9to5google.com/2025/01/21/gemini-homepage-redesign-2025/
- [MISTRAL] help.mistral.ai/en/articles/268662-le-chat-capabilities-overview; Nov 2024 Le Chat launch coverage (siliconangle, digitaltrends)

---

## 1. Desktop layout anatomy

Overall shell (majority): a two-column app with a **left sidebar** and a **main column**. The main column holds a slim top bar, a centred scrolling thread, and a composer docked at the bottom. An optional **right-hand panel** opens on demand for sources, canvas/artifacts or reasoning activity. The chat column stays visible beside it.
(src: TD-GPT-CIT, TD-PPLX, TD-CMP, G-SRC; Claude artifacts split pane per TD-CLAUDE)

### Sidebar
- **Contents, top to bottom (majority):**
  1. New chat button (pencil/plus icon with the label "New chat").
  2. Search chats.
  3. Primary sections, which vary by product: ChatGPT Library/Projects/GPTs; Claude Projects/Artifacts/Starred; Gemini Gems/"My Stuff"/Chats; Copilot agents/conversations.
  4. Chat history list.
  5. Account/profile at the bottom (avatar, name, plan; opens a settings menu).
  (src: ChatGPT release notes per search summary (help.openai.com/en/articles/6825453); Claude guides (support.claude.com collection 9811072, guideflow tutorials); GEM-UI; MS365. Bottom account placement is (inferred) from common observation.)
- **Pinned/Starred section** above the history: ChatGPT has a shared collapsible "Pinned" section (popularai.org write-up); Claude has "Starred" (guideflow).
- **History grouping by date buckets:** "Today / Yesterday / Previous 7 Days / Previous 30 Days / Earlier" or month names. (src: LC; OWUI says "Today, Yesterday, Previous 7 Days, etc."; the Vercel template uses today/yesterday/last week/last month/older buckets per the HF mirror of sidebar-history.tsx.) ChatGPT itself has moved toward an ungrouped, recency-ordered list with infinite scroll; Gemini web also moved to infinite-scroll history (androidauthority Gemini web redesign) (inferred for ChatGPT). **Pattern to ship:** a recency-ordered list with small muted group labels.
- **History item:** a single line, truncated title, no preview text. A "..." menu on hover holds Rename / Pin (Star) / Share / Archive / Delete. The active item has a subtle filled background. (inferred; consistent with the star-from-context-menu flow in guideflow tutorials)
- **Width:** about 260px on ChatGPT (userscripts target the inline style "width: 260px"; gist alexchexes). shadcn default is 16rem (256px) desktop and 18rem mobile sheet (SHADCN-SB). ChatGPT added an **adjustable sidebar width** (community.openai.com post "adjustable sidebar width (all users)"). **Convention: 256-280px.**
- **Collapse behaviour:** a toggle icon in the sidebar header or top-left. Two styles exist: fully off-canvas (ChatGPT historically) or a collapsed icon rail (Claude, Gemini and the 2026 M365 Copilot "expands and contracts"; MS365). shadcn supports `collapsible="offcanvas" | "icon" | "none"` with a keyboard toggle on "b" (Cmd/Ctrl+B is inferred) (SHADCN-SB). Collapsed state persists across reloads (shadcn uses a cookie) (inferred from shadcn implementation).
- **Search:** opens a command-palette style modal over the app, with results across chats, projects and files and type filters on ChatGPT (ChatGPT release notes summary, help.openai.com 6825453).

### Top bar (main column)
- **Left:** model/mode picker as a text-plus-chevron dropdown ("ChatGPT 5 v"-style), not a heavy select. Gemini and Copilot instead moved mode/tool choice into the composer ("Tools" menu; Gemini pill prompt box with unified tools menu per GEM-UI coverage; M365 Copilot surfaces "tools and controls based on what you are trying to do", MS365). In the Vercel template the model selector lives **inside the composer footer** (VC multimodal-input.tsx: `ModelSelectorCompact` next to the attach button). Trend: the model picker migrates into the composer (inferred from these three).
- **Right:** Share (creates a public link to the conversation; ChatGPT share = public link, TD-CMP), "..." overflow (rename, archive, delete), and sometimes a temporary/incognito chat toggle (Claude "incognito chats" in the support collection).
- The top bar is borderless or uses a hairline divider and shares the page background. No heavy header (inferred).

### Message thread
- **Readable column:** centred, with a max width of about **48rem (768px) in ChatGPT and Claude** (inferred; not confirmed in any source). Kits: Vercel template `max-w-4xl` (896px) with `px-2 md:px-4` and `gap-5 md:gap-7` between messages (VC messages.tsx); assistant-ui example `--thread-max-width: 56rem` (AUI-T). **Ship 720-800px** for prose.
- **User message:** **right-aligned, filled bubble** in a neutral grey (ChatGPT #f4f4f4-style in light mode, inferred), large radius, max width about 70% of the column. AUI-GPT: `rounded-[22px]`, 70% max width. VC: `max-w-[min(80%,56ch)] rounded-2xl rounded-br-lg`, 14px horizontal and 8px vertical padding, 13px text.
- **Assistant message:** **no bubble**. It is full-width, left-aligned prose on the page background. ChatGPT and Claude show no avatar beside each reply (AUI-GPT "no avatar"). Some kits (VC) use a small 28px rounded-square icon at the top-left of assistant turns (VC message.tsx `size-7 rounded-lg bg-muted/60`). Majority: **no avatars and no assistant bubble**.
- Message entrance: user turns fade up (VC `animate-[fade-up_0.25s_cubic-bezier(0.22,1,0.36,1)]`, user only). Assistant turns simply grow as they stream.
- On send, ChatGPT and Claude scroll the **new user message toward the top** of the viewport and reserve space below it for the answer (inferred from observation). assistant-ui exposes this as `turnAnchor="top"` and keeps classic bottom-pinning as the default (AUI-SCROLL). The Vercel template adds "requiresScrollPadding" to the last message for the same effect (VC messages.tsx).

### Composer
- **Docked at the bottom** of the main column, the same width as the thread. It is a **large rounded "card"** (ChatGPT `rounded-[28px]`, AUI-GPT; Gemini "pill-shaped prompt box", GEM-UI). It has a hairline border in light mode, a raised surface in dark mode (#212121 on #000/#212121, AUI-GPT), and a soft shadow (inferred).
- **Internal layout:** textarea on top, and a toolbar row underneath with **left** = attach (+) and tools/model picker, **right** = mic/voice and the **circular send button** (36px, AUI-GPT; VC uses a 28px rounded-xl square). The send button is **disabled/grey when empty**, then filled with the foreground colour (black in light, white in dark) when there is text (AUI-GPT colours; VC `bg-foreground text-background` versus `bg-muted ... cursor-not-allowed`).
- **Send becomes Stop** while a response is generating (square icon) (AUI-T "Cancel replaces Send"; VC `StopButton`; AUI-GPT priority: cancel while running > stop dictation > send when text > dictate/voice when idle).
- **Auto-grow:** the textarea grows with content and then scrolls internally. AI Elements: `field-sizing-content max-h-48 min-h-16` (min 64px, **max 192px**) (VC components/ai-elements/prompt-input.tsx). Convention: about 1 line at rest in ChatGPT, max about 25-40% of viewport height (inferred).
- **Placeholder:** short and generic: "Ask anything" (ChatGPT; VC "Ask anything..."), "Ask Gemini", "How can I help you today?" (Claude) (VC read; others inferred from observation). Use a muted colour with low contrast against the surface (VC `placeholder:text-muted-foreground/35`); but see section 9 on contrast.
- **Attachments:** previews appear as small chips/thumbnails **above the textarea inside the composer**, with upload progress and a remove "x" (VC multimodal-input.tsx `PreviewAttachment` with `isUploading`). Drag-and-drop onto the page and paste-to-attach are supported (inferred).
- **Disclaimer line** under the composer, one line, small and muted, centred: "X can make mistakes. Check important info." (AUI-GPT: "notice ... warns that the assistant can make errors and asks users to verify important information"). Claude and Gemini use equivalent short lines (inferred).

---

## 2. Empty / first-run state

- **Composer position:** on a new chat, **ChatGPT renders the greeting heading and the composer together, slightly above the vertical centre**. After the first send, the composer animates to the bottom dock and the thread appears (AUI-GPT: "heading + composer rendered together above the viewport center"). Claude, Gemini and Perplexity use the same centred-hero composer (inferred, majority). The Vercel template keeps the composer docked and centres only the greeting in the empty area (VC messages.tsx). **Majority = centred composer that docks after the first message.**
- **Greeting:** one short line, sometimes personalised ("Good afternoon, <name>", Claude; "Hello, <name>", Gemini; "Where should we begin?" / "What can I help with?", ChatGPT). The sources give 24px weight 400 for ChatGPT's (AUI-GPT). VC uses 24px, rising to 30px on md, semibold, with a muted 14px subline; both fade up with a 10px rise over 0.5s, staggered 0.35s and 0.5s, ease [0.22,1,0.36,1] (VC greeting.tsx). Gemini adds subtle themed backgrounds in light and dark (GEM-UI). No big logo hero and no marketing copy (inferred).
- **Suggested prompts:** **about 3-5**, low-emphasis.
  - ChatGPT shows a row of small pill chips under the composer (e.g. "Create image", "Summarize text", "Help me write") (inferred).
  - Gemini moved suggestions from a central card grid to a **list format** (GEM-UI, androidcentral "suggested actions now appear in a list format rather than grouped in the middle").
  - Claude shows category chips under the composer that expand into prompt examples (inferred).
  - VC shows **4 suggestions as a 2-column grid of outline cards** on desktop and a horizontal scroll row on mobile. They stagger in at 60ms per item over 0.4s, and on hover they lift 2px and gain a shadow (VC suggested-actions.tsx, lib/constants.ts).
  - Clicking one sends it immediately in VC. In ChatGPT and Claude, chips often prefill or expand instead (inferred).
  - Suggestions hide once the user types (AUI-T: shown only when `composer.isEmpty`) and on any non-empty thread.
- For a **document-grounded assistant**, the suggestion slot is the right place for 3-4 example questions answerable from the owner's documents, and optionally a "Searching N documents" scope line (inferred recommendation).

---

## 3. States

- **Submitted / waiting (before the first token):** a "thinking" placeholder in the assistant slot. Today's convention is **shimmering text** (a gradient sweep across muted text such as "Thinking...", "Searching...", "Reading documents...") rather than three bouncing dots. VC `ThinkingMessage` uses `<Shimmer duration={1}>` with 13px, line-height 1.65 text. AI Elements ships a dedicated Shimmer component (AIE). assistant-ui RetrievalChunks shows a shimmering "Retrieving" label (AUI-RC).
- **Reasoning / thinking models:** a **collapsible "Thought for Ns" row** above the answer, collapsed by default once done. ChatGPT opens an "Activity" side panel with steps (TD-GPT-OUT). The AI Elements `Reasoning` component **auto-opens while streaming and collapses when done** (third-party AI Elements guide, smithery/skills summary). Perplexity collapses research steps (TD-CMP). Tool/search steps show as compact status rows ("Searched 12 sites") (inferred).
- **Streaming text:** text appears progressively in chunks, with markdown rendering live; block elements like lists and code form as they stream. ChatGPT historically showed a **blinking/solid dot cursor** at the end of streaming text; current apps mostly rely on the growing text plus a subtle fade-in of new chunks (inferred; no official doc). Streamdown (Vercel's streaming-markdown renderer, referenced by assistant-ui guides/streamdown.md) exists specifically to render incomplete markdown safely during streaming.
- **Stop generating:** the Send button becomes a Stop button in the same spot (see section 1). Partial text is kept, and the message stays as-is with actions available (inferred).
- **Errors:** shown **inline in the assistant slot**, not as a toast. Use a short message and a **Retry** button (VC renders tool errors as `rounded-lg border border-red-200 bg-red-50 p-4 text-red-500`, with dark variant `dark:bg-red-950/50`). Leading apps use neutral styling with a small warning icon plus "Something went wrong. Retry" (inferred). The user's message stays in the thread, so nothing is lost.
- **Regenerate / Try again:** creates an alternate answer and **keeps the original**. Navigate with a **"< 2/2 >" version stepper** in the action row (ChatGPT, TD-GPT-OUT; Claude "1/N", TD-CLAUDE; assistant-ui BranchPicker hidden when only one branch, AUI-T).
- **Edit a previous user message:** a pencil action on hover under the user bubble. The bubble turns **into an inline editor in place** with Cancel / Send (AUI-T: "Editing swaps the message in place for an edit composer. It does not open a dialog"; VC edit mode shows "Edit your message..." placeholder and a Cancel button). Submitting **forks the thread** (branch), and the stepper appears on the user message (TD-CLAUDE, TD-CMP).
- **Code blocks:** a dark or neutral panel with a **header bar containing the language label (left) and a Copy button (right)**. Copy swaps to a checkmark for about 2s (assistant-ui `isCopied` swaps the icon for a check, AUI-T). The header button is sticky on long blocks in ChatGPT (inferred). Content uses syntax highlighting (AI Elements Code Block; assistant-ui syntax-highlighter) and scrolls horizontally rather than wrapping (inferred). Some apps add "Edit/Run/Open in canvas" (Le Chat Canvas, ChatGPT Canvas, Claude artifacts) (MISTRAL, TD-CLAUDE).
- **Markdown:** full GFM support: headings (kept small, close to body size), bold lead-ins, numbered and bulleted lists, inline code, blockquotes, links, and **tables**. Tables get horizontal scroll inside the column, a header row with a subtle background, thin row dividers, and often a copy/download control (inferred). Gemini routes tables to Sheets via overflow export (TD-CMP).
- **Selection refinement:** selecting text in an answer offers "Ask ChatGPT" / Claude "Reply" (adds a quote chip to the composer) / Perplexity "Add to follow-up" + "Check sources" (TD-CMP, TD-CLAUDE).

---

## 4. Sources / citations (most important for a document-grounded assistant)

Four layers recur across Perplexity, ChatGPT search, Gemini and Claude web search:

1. **Inline markers at the end of the supported sentence or bullet.**
   - Perplexity and ChatGPT use **rounded "source chips"**: favicon or short publisher name, plus **"+N"** when several sources back one claim (TD-PPLX: "northjersey +3"; TD-GPT-CIT: favicon + truncated publisher name, "+N" badge).
   - Older styles use superscript numbers [1] [2] (Perplexity historically, many kits; AI Elements `InlineCitation` takes an index; assistant-ui inline-citation).
   - Claude web search uses inline clickable citations (macrumors/dataconomy launch coverage, Mar 2025).
   - Gemini shows a Sources button "at the bottom of the response or in-line throughout the response" (G-SRC).
   - **Majority today: chips with source names, not bare numbers.** For documents, the label should be a short document name (+ page), e.g. "Handbook p.4" (inferred adaptation).
2. **Popover/hover card anchored to the chip.** Clicking (Perplexity) or hovering/clicking (ChatGPT desktop) opens a card with favicon/domain, title, **excerpt/snippet**, and date. For multi-source chips a **"1/N" stepper with arrows** cycles through sources (TD-PPLX, TD-GPT-CIT). The card previews in place before the user leaves the page.
3. **Sources summary row under the answer:** a **favicon stack plus "N sources"** in the action bar (TD-PPLX "10 sources"; TD-GPT-CIT "Sources" with favicon stack). ChatGPT has been moving this button into the "..." More menu in some sessions since Aug 2026 (SER-GPT). Perplexity also has a Links tab per answer (TD-PPLX). AI Elements `Sources` is a **collapsible "Used N sources"** block with a trigger showing the count (AIE summary).
4. **Right-hand sources side panel:** clicking the sources row opens a **right sidebar listing every source as a card** (title, URL/domain, snippet, sometimes date/thumbnail). The answer stays visible and the panel has a header with the total and a close control (TD-PPLX, TD-GPT-CIT, SER-GPT launch "Sources button ... opens a sidebar", G-SRC "A side panel will open with the relevant links"). Gemini's links can point to **uploaded files** and Workspace docs, not only web pages (G-SRC).

**Opening the cited passage.** The leading consumer apps mostly stop at "preview card -> open URL in new tab". Teardowns criticise that (a) no clear "open" action exists on the card and (b) **the sidebar doesn't highlight the card matching the chip you clicked** (TD-GPT-CIT). Perplexity adds **passage-level "Check sources"** on selected text (TD-PPLX). Gemini's "Double-check" **highlights statements in green (supported) or orange (different/no evidence)** with links (G-SRC; colour detail from secondary guides).

**Document-RAG patterns from kits (closest to our product):**
- assistant-ui **DocumentReference** card (AUI-DOC): a file icon in a tinted square, document title, meta "12 pages · 2 cited", then **one button per cited passage showing a page label ("p. 4") above the quoted passage**. Clicking jumps the viewer to that page and highlights the active anchor(s), with `aria-current` on the active one.
- assistant-ui **RetrievalChunks** (AUI-RC): each retrieved passage shows the source doc, a locator ("§ 2", "L12"), a relevance meter, and a **2-line clamped snippet**. The status line reads "Retrieving" (shimmer), then "N passages above threshold".
- assistant-ui also ships a **confidence-marker** element for "sourced vs. inferred claims" (assistant-ui llms.txt index).

**Recommended synthesis for "answers only from owner's documents" (inferred):**
- Inline chip per claim: "[doc short name · p.X]". If several sources back the claim, show "+N".
- Click opens a popover with the doc title, page/section, and a **verbatim quoted passage with the matched span highlighted**, plus "Open document" and "1/N".
- Under the answer: "Answered from 3 documents" as a stacked file-icon row. Clicking opens a right panel with document cards. Clicking a card or "Open" shows a **document viewer scrolled to the passage with the highlight**, and the chip that was clicked is reflected as the active card.
- When no supporting passage is found, the assistant says so explicitly instead of answering (a trust signal; inferred).
- On mobile, the panel becomes a bottom sheet (TD-PPLX flags that the sidebar "needs a mobile fallback").

---

## 5. Message actions

- **Assistant message action row** (below the answer, left-aligned, small ghost icon buttons about 28-32px with tooltips): **Copy, Thumbs up, Thumbs down, Regenerate/Try again, Share/Read aloud, "..." more** (more holds View sources, Branch in new chat, Read aloud, export) (TD-GPT-OUT; Claude: copy, read aloud, thumbs, Try again per TD-CLAUDE; AUI-GPT: 32px controls, 8px radius, zero gap; Gemini adds "reshape" Longer/Shorter plus export to Docs/Gmail per TD-CMP).
- **Visibility:**
  - ChatGPT: **always visible on the latest answer**, **on hover for earlier answers** (AUI-T `autohide="not-last"`; AUI-GPT says always visible).
  - All products: **hidden while streaming** (AUI-T `hideWhenRunning`; TD-GPT-OUT "once the answer completes").
  - VC fades actions in on message hover (`opacity-0 ... group-hover/message:opacity-100`, 150ms).
  - **Majority: show on the last answer, hover-reveal on older ones, never during streaming.** On touch devices, always show (inferred).
- **User message actions:** Copy and Edit, appearing **on hover below or beside the bubble** (AUI-GPT; VC right-aligned under the user bubble).
- Copy feedback: the icon swaps to a check for about 1.5-2s (AUI-T). Thumbs down usually opens a small optional feedback form (inferred). Votes persist per message (VC /api/vote).
- Icon colour is muted (#5d5d5d light / #cdcdcd dark) with a 7% black / 15% white hover background (AUI-GPT).

---

## 6. Mobile

- **Sidebar becomes an off-canvas drawer** from the left, opened by a hamburger/"two-line" icon top-left, with a scrim and swipe-to-close (shadcn mobile sidebar renders as a Sheet, 18rem wide (SHADCN-SB); Gemini/ChatGPT mobile web same pattern (inferred)).
- The top bar keeps a menu icon (left), model/title (centre), and new chat (right) (inferred).
- **Composer pinned to the bottom**, full width with side padding, still a rounded pill. Suggestions become a **horizontal scroll row** (VC `overflow-x-auto` on small screens, grid from `sm`).
- **Keyboard handling:**
  - Use dynamic viewport units (`100dvh`) for the shell, not `100vh`/`h-screen`.
  - Add `interactive-widget=resizes-content` to the viewport meta for Chromium/Android.
  - On iOS, if needed, compute the visible bottom from `visualViewport.offsetTop + height`, since WebKit ignores interactive-widget (KB sources).
  - Avoid fixed `h-screen` containers that push the composer under the keyboard (KB).
- **Safe areas:** pad the composer with `env(safe-area-inset-bottom)` (with `viewport-fit=cover`). The inset can collapse while the keyboard is open, so test both states (KB).
- Use a font-size of at least **16px in the textarea** to stop iOS Safari from zooming on focus (inferred; well-known WebKit behaviour).
- Message actions are visible by default (no hover). The citation sidebar becomes a bottom sheet (TD-PPLX flags the mobile fallback).
- On mobile, Enter inserts a newline and the send button sends (inferred; common convention since there is no Shift key).

---

## 7. Motion and micro-interactions

Documented values come from VC (Vercel chatbot template). The rest is inferred convention.
- **Easing:** a soft expo-out `cubic-bezier(0.22, 1, 0.36, 1)` is used throughout VC.
- **Greeting:** fade + 10px rise, 500ms, staggered (350ms and 500ms delays) (VC greeting.tsx).
- **Suggestion cards:** fade + 16px rise, 400ms, 60ms stagger per card. Hover lift is -2px with a shadow over 200ms (VC suggested-actions.tsx).
- **User message entrance:** fade-up over 250ms (VC message.tsx). Assistant messages have no entrance animation; they grow via streaming.
- **Message actions:** opacity fade over 150ms on hover (VC message-actions.tsx).
- **Scroll-to-bottom button:** a small round pill centred at the bottom of the thread, above the composer, with a down-arrow icon. It **appears only when not at the bottom**, using a scale 0.9 to 1 plus opacity transition over 200ms, with a blurred translucent background (VC messages.tsx `transition-all duration-200`, `scale-90 opacity-0` when at bottom). Clicking smooth-scrolls. assistant-ui hides it while at the bottom; scrolling to the bottom refocuses the composer (AUI-T, AUI-SCROLL).
- **Auto-scroll:** follow the stream while pinned to the bottom. **Stop following as soon as the user scrolls up** and resume when they return to the bottom (AUI-SCROLL).
- **Thinking shimmer:** about a 1s sweep loop (VC `Shimmer duration={1}`).
- **Send button:** colour/opacity transition over 200ms plus a press `active:scale-95` (VC).
- **Composer:** grows smoothly per line (CSS `field-sizing: content` or JS autosize). On the first message, the hero composer moves from the centre to the bottom dock (AUI-GPT; the transition is inferred to be a short slide/fade, about 200-300ms).
- **Sidebar:** slides in about 200-300ms with ease-out, and the main column reflows (shadcn sidebar uses CSS width transitions, about 200ms linear; inferred from shadcn implementation).
- Gemini's 2026 Android redesign is reported as having "smoother animations" (GEM-UI coverage). Restraint is the rule: no bounces, no typewriter character-by-character effects, and no confetti (inferred; also flagged in the anti-pattern sources: "bounce easing" listed as an AI tell, tyloch-biz-hugo.pages.dev/posts/stop-ai-ui-looking-ai-generated).
- Respect `prefers-reduced-motion`: disable entrance transforms and shimmer, keep opacity (inferred best practice).

---

## 8. Typography, spacing, colour

- **Fonts:**
  - Sans-serif UI font almost everywhere: ChatGPT uses a Söhne-like grotesk, Gemini uses Google Sans, Copilot uses a custom/Segoe-family sans.
  - **Claude uses a serif for assistant prose** (a distinctive "reading" feel) with a sans UI (inferred from observation).
  - **Base message size: 16px, line-height about 1.5-1.75** (inferred for ChatGPT/Claude). Dense kits go smaller: VC uses 13px / 1.65 (VC message.tsx). For a public-facing SME assistant, prefer **15-16px / 1.6**.
  - Headings inside answers stay close to body size (about 1.1-1.25x), semibold. Avoid huge H1s inside replies (inferred).
- **Spacing:** about 20-28px between turns (VC `gap-5 md:gap-7`). Paragraph spacing is about 0.75em. Composer inner padding is about 12-16px. The thread has side padding of 16px on mobile (VC `px-4`).
- **Surfaces:**
  - **Neutral, near-monochrome.**
  - Light: white page (#fff), light-grey user bubble, white composer with a #e5e5e5 hairline border, text #0d0d0d, muted text #5d5d5d.
  - Dark: page #000/#212121 family, composer #212121 (on darker page) / slightly lighter grey, text #ececec, muted #afafaf (AUI-GPT).
  - The sidebar is a slightly tinted neutral (e.g. #f9f9f9 light / #171717 dark), separated by tone rather than heavy borders (inferred).
  - M365 Copilot's 2026 redesign is "largely black and white, text-forward" (MS365/engadget).
  - Claude uses warm off-whites/beiges with a terracotta accent (inferred).
- **Accent use:** minimal. The primary send button is often **foreground-coloured (black/white)** rather than brand-coloured (AUI-GPT). Brand colour appears in tiny places (logo, focus ring, toggles, links). Links are underlined or accent-coloured in answers.
- **Radii:** large on the composer (24-28px) and user bubbles (18-22px). Medium (8-12px) on cards, code blocks and popovers. Small (6-8px) on icon buttons (AUI-GPT, VC).
- **Shadows:** almost none. The composer may carry a faint shadow. Popovers and the scroll-to-bottom pill have a soft float shadow (VC `--shadow-float`).
- **Dark mode:** a first-class, system-following toggle in every leading app (Gemini adds light/dark backgrounds on the homepage, GEM-UI) (inferred for others).

---

## 9. Accessibility

- **Keyboard:**
  - **Enter sends, Shift+Enter inserts a newline**, and Enter is ignored during IME composition (`isComposing`). This is critical for Korean/Japanese/Chinese input (VC ai-elements/prompt-input.tsx: checks `e.nativeEvent.isComposing` and `e.shiftKey`).
  - ChatGPT shortcuts (third-party lists, verify in-app via Ctrl/Cmd+/): Ctrl/Cmd+Shift+O new chat, Shift+Esc focus composer, Ctrl/Cmd+Shift+; copy last code block, Ctrl+/ show shortcuts (hongkiat.com/blog/chatgpt-keyboard-shortcuts/, tomsguide).
  - Sidebar toggle Cmd/Ctrl+B (shadcn "b" constant; modifier inferred).
- **Focus management:**
  - Autofocus the composer on a new chat and after a response completes. Return focus to the composer after Stop and after jump-to-bottom (assistant-ui `autoFocus` on scroll-to-bottom, AUI-T).
  - When the edit-in-place editor opens, move focus into it, and return focus on Cancel (inferred).
  - Popovers and side panels trap and return focus and close on Esc (inferred).
- **Live regions:**
  - Don't pipe raw tokens into `aria-live`.
  - Keep a **polite** live region in the DOM from page load.
  - Set `aria-busy="true"` on the streaming message and announce a status ("Assistant is responding..." then "Response complete") or the finished message once.
  - Give the thinking state an accessible status text (A11Y sources).
  - Structure the transcript as `role="log"` (or a list) with each message as an `article` labelled by sender ("You said" / "Assistant said") (A11Y).
- **Controls:**
  - Every icon-only button needs an `aria-label` and tooltip (VC "Scroll to bottom", "Previous branch"/"Next branch").
  - **Stop generating** must be keyboard reachable (A11Y).
  - Citation chips should be real buttons/links with accessible names ("Source: Handbook, page 4") (inferred).
  - The active citation passage should use `aria-current` (AUI-DOC).
- **Contrast:** the trendy faint placeholders/action icons (e.g. VC `text-muted-foreground/35`, `/50`) can fail WCAG 1.4.3/1.4.11. Keep icons at least 3:1 and text at least 4.5:1 (inferred).
- Hover-only actions must also appear on keyboard focus (`:focus-within`) and be always visible on touch (inferred).
- Respect reduced motion (section 7).

---

## 10. What makes a chat UI feel cheap or "AI-template-like"

Gathered from the critique sources (tyloch-biz-hugo "stop AI UI looking AI-generated": purple gradients, side-tab accent borders, monotonous spacing, bounce easing; superdesign.dev and vp0.com on generic AI looks; noqta.tn "AI design slop"; dev.to "five chatbot UI mistakes that quietly break user trust"; askcodi "the AI UI problem") and from contrasting the kits with the leading apps (inferred where noted):
- **Both sides in coloured bubbles with avatars** (messenger/WhatsApp look), especially a brand-gradient user bubble and a robot/sparkle avatar on every assistant turn. Leading apps use plain assistant prose and neutral user bubbles (inferred from section 1).
- **Purple/blue gradients, glows, sparkles and glassmorphism** on the composer, background or send button (critique sources). Leading apps are near-monochrome (MS365/engadget "black and white, text-forward").
- **Typewriter character-by-character animation**, bouncing three-dot "typing" indicators, bounce easing (critique sources; inferred for typewriter).
- **A tiny fixed-height input** that doesn't grow, has no Stop state, or sends on Enter while an IME is composing (inferred; contrasts with VC/AUI behaviour).
- **Full-width text lines** on wide screens (no max-width column) and cramped line-height (inferred).
- **A big card grid of 6-8 generic suggestions** with emoji icons and marketing copy, or a giant logo hero (Gemini itself moved away from centre card grids to a list, GEM-UI) (inferred).
- **Fake or unverifiable citations:** numbers that don't open anything, sources without the passage, or links the answer didn't actually use. Teardowns flag even the leaders for not highlighting the matching source (TD-GPT-CIT). A Tow Center test found >60% of AI-search answers had incorrect citations (geotoolbox.ai/blog/chatgpt-citations); trust UX must be **local and verifiable** (TD-PPLX).
- **Always-visible heavy action toolbars** on every message, or actions shown mid-stream (contrast AUI-T `hideWhenRunning`, `autohide`).
- **Uncontrolled scrolling:** yanking the user to the bottom while they read earlier text, and no scroll-to-bottom button (AUI-SCROLL).
- **Errors as generic toasts** with lost input, and no inline Retry (inferred).
- **Over-styled markdown:** giant headings, rainbow syntax themes, unscrollable tables that break layout (inferred).
- **Unmanaged mobile:** composer hidden under the keyboard, `100vh` jumps, no safe-area padding (KB sources).
- **Template tells:** default shadcn look with no adjustments, an identical "How can I help you today?" plus 4 cards, a lorem disclaimer, and an unthemed dark mode (inferred).

---

## Quick reference: recommended defaults (synthesis, inferred from the above)

| Token | Value |
|---|---|
| Sidebar width | 260px (collapsible to off-canvas or 56-64px rail); mobile drawer 288px |
| Thread max width | 768px (prose), side padding 16px mobile / 24px desktop |
| Message font | 16px / 1.6 (15px acceptable on dense desktop) |
| Turn gap | 24-28px |
| User bubble | right, neutral grey, radius 20px, max 70-80%, padding 10px 16px |
| Assistant | no bubble, no avatar, full column width |
| Composer | radius 24-28px, hairline border, min 1-2 lines, max about 200px then scroll; send 32-36px circle |
| Disclaimer | 12px muted, centred under composer |
| Scroll-to-bottom | 32px circle/pill, appears when not at bottom, 200ms fade/scale |
| Easing | cubic-bezier(0.22, 1, 0.36, 1); 150-250ms UI, 400-500ms first-run entrance |
| Citations | inline chip "Doc · p.X" -> popover with quoted passage -> right panel/document viewer with highlight |
