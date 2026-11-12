"use client";

import { ArrowCounterClockwise, SealCheck } from "@phosphor-icons/react";

/** Pinned to the bottom of a stage's output panel: where the step stands, and the one action that moves it on. */
export default function ApprovalBar({
  approved,
  approvedAt,
  ready,
  openCount,
  running,
  busy,
  approveLabel,
  approvedLabel,
  readyHint,
  draftHint,
  onApprove,
  onReopen,
  message,
}: {
  approved: boolean;
  approvedAt: string | null;
  ready: boolean;
  openCount: number;
  running: boolean;
  busy: boolean;
  approveLabel: string;
  approvedLabel: string;
  readyHint: string;
  draftHint: string;
  onApprove: () => void;
  onReopen: () => void;
  /** Replaces the default status text (a stage that knows exactly what is still required). */
  message?: React.ReactNode;
}) {
  if (approved) {
    return (
      <div className="flex items-center justify-between gap-3 border-t border-line bg-accent-soft px-6 py-4">
        <div className="flex items-center gap-2.5">
          <SealCheck size={22} weight="fill" className="text-accent" />
          <div>
            <p className="text-sm font-semibold text-accent-ink">{approvedLabel}</p>
            {approvedAt && (
              <p className="text-xs text-accent-ink/75">
                {new Date(approvedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onReopen}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3.5 py-2 text-sm font-medium text-accent-ink transition hover:bg-white active:scale-[0.98] disabled:opacity-40"
        >
          <ArrowCounterClockwise size={15} weight="bold" />
          Reopen
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 border-t border-line bg-surface px-6 py-4">
      <p className="text-sm text-muted">
        {message ? (
          message
        ) : ready ? (
          <>
            <span className="font-semibold text-ink">Ready for your review.</span> {readyHint}
          </>
        ) : openCount > 0 ? (
          `${openCount} question${openCount === 1 ? "" : "s"} left before this is ready.`
        ) : (
          draftHint
        )}
      </p>
      <button
        onClick={onApprove}
        disabled={busy || running || !ready}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-line-strong"
      >
        <SealCheck size={16} weight="bold" />
        {approveLabel}
      </button>
    </div>
  );
}
