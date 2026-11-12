"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * An in-app confirmation (instead of the browser's own pop-up), styled like the remove-project dialog.
 * `onConfirm` may be async: the dialog shows progress, keeps itself open on an error, and closes on success.
 */
export default function ConfirmDialog({
  title,
  description,
  rows,
  confirmLabel,
  busyLabel = "Working...",
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description: React.ReactNode;
  /** Optional label/value summary, e.g. [["Cleared", "..."], ["Kept", "..."]]. */
  rows?: [string, React.ReactNode][];
  confirmLabel: string;
  busyLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus the safe choice first.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !working) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, working]);

  async function confirm() {
    setWorking(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setWorking(false);
    }
  }

  if (typeof document === "undefined") return null; // never rendered on the server
  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#0e1b2c]/50 p-4 [animation:overlay-in_160ms_ease-out]"
      onMouseDown={(e) => e.target === e.currentTarget && !working && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_-24px_rgba(14,27,44,0.45)] [animation:rise-in_200ms_cubic-bezier(0.2,0.8,0.2,1)]"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 id="confirm-title" className="text-base font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            aria-label="Close"
            className="-mr-2 grid size-8 place-items-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </header>

        <div className="space-y-4 px-6 py-5">
          <p id="confirm-desc" className="text-sm leading-relaxed text-muted">
            {description}
          </p>
          {rows && rows.length > 0 && (
            <dl className="divide-y divide-line rounded-xl border border-line text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-3 px-4 py-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="leading-relaxed text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {error && (
            <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-line bg-surface-2/50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={working}
            className="h-10 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition hover:bg-surface-2 active:scale-[0.98] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={working}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 ${
              danger ? "bg-danger hover:bg-[#a83232]" : "bg-accent hover:bg-accent-hover"
            }`}
          >
            {working && <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
            {working ? busyLabel : confirmLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
