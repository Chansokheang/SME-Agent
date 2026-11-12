"use client";

import { Check, Globe, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, type Project } from "@/lib/api";

/** Asks before removing a project; the owner types its name to confirm. */
export default function RemoveProjectDialog({
  project,
  onClose,
  onRemoved,
}: {
  project: Project;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const matches = typed.trim().toLowerCase() === project.name.trim().toLowerCase();
  const site = project.live_url?.replace(/^https?:\/\//, "");

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !removing) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, removing]);

  async function remove(event: React.FormEvent) {
    event.preventDefault();
    if (!matches || removing) return;
    setRemoving(true);
    setError(null);
    try {
      await api.deleteProject(project.id);
      onRemoved();
    } catch (e) {
      setError((e as Error).message);
      setRemoving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#0e1b2c]/50 p-4 [animation:overlay-in_160ms_ease-out]"
      onMouseDown={(e) => e.target === e.currentTarget && !removing && onClose()}
    >
      <form
        onSubmit={remove}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-title"
        aria-describedby="remove-desc"
        className="w-full max-w-[480px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_-24px_rgba(14,27,44,0.45)] [animation:rise-in_200ms_cubic-bezier(0.2,0.8,0.2,1)]"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 id="remove-title" className="text-base font-semibold tracking-tight">
            Remove project
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={removing}
            aria-label="Close"
            className="-mr-2 grid size-8 place-items-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </header>

        <div className="space-y-5 px-6 py-5">
          <p id="remove-desc" className="text-sm leading-relaxed text-muted">
            <span className="font-semibold text-ink">{project.name}</span> and everything Gagesite made for it will be
            permanently removed. This can&rsquo;t be undone.
          </p>

          <dl className="divide-y divide-line rounded-xl border border-line text-sm">
            <div className="grid grid-cols-[7.5rem_1fr] gap-3 px-4 py-3">
              <dt className="text-muted">Removed</dt>
              <dd className="leading-relaxed text-ink">
                Conversations, plan, database and UI designs, website files, saved connections
              </dd>
            </div>
            <div className="grid grid-cols-[7.5rem_1fr] gap-3 px-4 py-3">
              <dt className="text-muted">Not affected</dt>
              <dd className="leading-relaxed text-ink">
                {site ? "Your live website, your" : "Your"} database and its rows, any copy on GitHub
              </dd>
            </div>
          </dl>

          {site && (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
              <Globe size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <p>
                <span className="font-medium">{site}</span> stays online. To take it down, use Take offline in Deployment
                before removing this project.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="confirm-name" className="block text-sm text-muted">
              To confirm, type <span className="font-medium text-ink">{project.name}</span>
            </label>
            <div className="relative mt-2">
              <input
                id="confirm-name"
                ref={input}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={removing}
                className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 pr-9 text-sm outline-none transition focus:border-accent focus:ring-3 focus:ring-accent-soft disabled:opacity-60"
              />
              <Check
                size={16}
                weight="bold"
                aria-hidden
                className={`absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 transition duration-150 ${
                  matches ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-line bg-surface-2/50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={removing}
            className="h-10 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition hover:bg-surface-2 active:scale-[0.98] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!matches || removing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-danger px-4 text-sm font-medium text-white transition hover:bg-[#a83232] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
          >
            {removing && <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
            {removing ? "Removing..." : "Remove project"}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
