"use client";

import { Sparkle } from "@phosphor-icons/react";

/**
 * The right-hand panel before a stage's conversation begins: the stage's starting form (where to
 * start, what to upload) gets the big area, and the chat keeps only a short greeting.
 */
export default function StartPanel({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  /** Room for a two-column start form. */
  wide?: boolean;
}) {
  return (
    <section className="flex h-full min-h-0 w-full flex-col border-line bg-surface lg:border-l">
      <header className="px-6 pb-3 pt-5">
        <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      </header>
      <div className="@container relative min-h-0 flex-1 overflow-y-auto px-6 pb-10">
        <div className={`mx-auto w-full pt-4 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>{children}</div>
      </div>
    </section>
  );
}

/** What the chat shows before the conversation starts: a short hello that points at the panel. */
export function ChatGreeting({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-sky-400 text-white shadow-[0_4px_12px_-4px_rgba(34,102,212,0.6)]">
        <Sparkle size={13} weight="fill" />
      </span>
      <div className="min-w-0 flex-1 space-y-2 pt-0.5 text-sm leading-relaxed">
        <p className="font-semibold">{title}</p>
        <div className="space-y-2 text-muted">{children}</div>
      </div>
    </div>
  );
}
