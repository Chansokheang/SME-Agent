import type { Icon } from "@phosphor-icons/react";

/** The one empty state for a stage's panel: a soft dashed card with an icon, a title and a line of text. */
export default function EmptyCard({ icon: IconComponent, title, text }: { icon: Icon; title: string; text?: string }) {
  return (
    <div className="grid h-full min-h-[420px] place-items-center rounded-3xl border border-dashed border-line-strong bg-gradient-to-br from-surface-2 to-surface text-center">
      <div className="max-w-xs px-6">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface text-accent shadow-sm">
          <IconComponent size={28} weight="duotone" />
        </span>
        <p className="mt-4 font-display text-lg font-bold">{title}</p>
        {text && <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>}
      </div>
    </div>
  );
}
