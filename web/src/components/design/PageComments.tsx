"use client";

import { ArrowUp, CaretRight, ChatCenteredText, Trash, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { PickEvent, PickTarget } from "@/components/design/ScaledFrame";

export interface SectionComment {
  n: number;
  pageSlug: string;
  pageName: string;
  selector: string;
  label: string;
  /** What the comment is about: "Button", "Card", "Section"... */
  kind?: string;
  text: string;
}

/** "the card "아메리카노"" — how a comment's target reads in the message to Claude. */
export function targetPhrase(c: { kind?: string; label: string }) {
  return `the ${(c.kind ?? "section").toLowerCase()}${c.label ? ` "${c.label}"` : ""}`;
}

/** Turns collected comments into one message for Claude: each with the page, the part and its CSS path. */
export function commentsMessage(comments: SectionComment[]) {
  const lines = comments.map(
    (c) =>
      `${c.n}. ${c.pageName} page (docs/03-design/pages/${c.pageSlug}.html), ${targetPhrase(c)} ` +
      `(CSS path: \`${c.selector}\`): ${c.text}`,
  );
  return (
    `Please make these changes to the design. Change only the sections mentioned and keep everything else as it is:\n\n` +
    lines.join("\n")
  );
}

/**
 * What the comment is about: the clicked part, or a bigger part around it (its card, the section).
 * One click widens or narrows the target; the preview outlines the chosen one.
 */
export function TargetChips({
  chain,
  value,
  onChange,
}: {
  chain: PickTarget[];
  value: PickTarget;
  onChange: (target: PickTarget) => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1" role="radiogroup" aria-label="What this comment is about">
      {chain.map((t, i) => {
        const active = t.selector === value.selector;
        return (
          <span key={t.selector} className="flex min-w-0 items-center gap-1">
            {i > 0 && <CaretRight size={10} className="shrink-0 text-faint" />}
            <button
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(t)}
              title={t.label}
              className={`flex min-w-0 max-w-[13rem] items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition ${
                active ? "bg-accent text-white" : "bg-surface-2 text-muted hover:bg-accent-soft hover:text-accent-ink"
              }`}
            >
              <span className="shrink-0 font-semibold">{t.kind}</span>
              {t.label && <span className="truncate opacity-80">· {t.label}</span>}
            </button>
          </span>
        );
      })}
    </div>
  );
}

/** Small comment box shown where the owner clicked in the preview. */
export function CommentPopover({
  pick,
  target,
  onTarget,
  boxWidth,
  boxHeight,
  onAdd,
  onCancel,
}: {
  pick: PickEvent;
  target: PickTarget;
  onTarget: (target: PickTarget) => void;
  boxWidth: number;
  boxHeight: number;
  onAdd: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  const width = 320;
  const height = 214;
  const left = Math.max(8, Math.min(pick.x - 20, boxWidth - width - 8));
  // Open below the click, or above it when there isn't room below.
  const top = pick.y + 14 + height <= boxHeight ? pick.y + 14 : Math.max(8, pick.y - height - 10);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="absolute z-30 rounded-2xl border border-line bg-surface p-3 shadow-[0_24px_60px_-20px_rgba(14,42,87,0.45)]"
      style={{ left, top, width }}
      role="dialog"
      aria-label="Comment on this part"
    >
      <div className="flex items-start justify-between gap-2">
        <TargetChips chain={pick.chain} value={target} onChange={onTarget} />
        <button onClick={onCancel} aria-label="Cancel" className="mt-0.5 shrink-0 text-faint hover:text-ink">
          <X size={14} />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onAdd(text.trim());
        }}
        className="mt-2"
      >
        <label htmlFor="section-comment" className="sr-only">
          What should change here?
        </label>
        <textarea
          id="section-comment"
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (text.trim()) onAdd(text.trim());
            }
            if (e.key === "Escape") onCancel();
          }}
          rows={3}
          placeholder="What should change here? e.g. make this photo bigger"
          className="w-full resize-none rounded-xl border border-line-strong px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft"
        />
        <div className="mt-2 flex justify-end">
          <button
            disabled={!text.trim()}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:bg-line-strong"
          >
            Add comment
          </button>
        </div>
      </form>
    </motion.div>
  );
}

/** Pending comments for all pages, sent to Claude together in one message. */
export function CommentTray({
  comments,
  running,
  onRemove,
  onSend,
}: {
  comments: SectionComment[];
  running: boolean;
  onRemove: (n: number) => void;
  onSend: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {comments.length > 0 && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: 8 }}
          className="rounded-2xl border border-line bg-surface p-3"
        >
          <ul className="max-h-36 space-y-1.5 overflow-y-auto">
            {comments.map((c) => (
              <li key={c.n} className="flex items-start gap-2.5 text-sm">
                <span className="grid size-5 shrink-0 place-items-center rounded-full rounded-bl-sm bg-accent text-[10px] font-bold text-white">
                  {c.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-xs text-faint">
                    {c.pageName}
                    {c.kind ? ` · ${c.kind}` : ""}
                    {c.label ? `: ${c.label}` : ""}
                  </span>
                  <span className="block leading-snug">{c.text}</span>
                </span>
                <button
                  onClick={() => onRemove(c.n)}
                  aria-label={`Remove comment ${c.n}`}
                  className="text-faint hover:text-danger"
                >
                  <Trash size={14} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-line pt-2.5">
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <ChatCenteredText size={14} className="text-accent" />
              {running ? "Gagesite is working. Send when it finishes." : "Gagesite changes only these sections."}
            </p>
            <button
              onClick={onSend}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:bg-line-strong"
            >
              Send {comments.length} change{comments.length === 1 ? "" : "s"}
              <ArrowUp size={14} weight="bold" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
