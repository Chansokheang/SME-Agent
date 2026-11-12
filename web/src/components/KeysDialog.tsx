"use client";

import { CircleNotch, LockSimple, PencilSimple, Plus, ShieldCheck, Trash, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, type ProjectKey, type ProjectKeys } from "@/lib/api";

type Draft = { name: string; purpose: string; secret: boolean; value: string };
const EMPTY: Draft = { name: "", purpose: "", secret: true, value: "" };
const toName = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9_]/g, "_");

const FIELD =
  "h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none transition placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/15";
const PRIMARY =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-medium text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY =
  "inline-flex h-9 items-center justify-center rounded-lg border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink transition hover:bg-surface-2 active:scale-[0.98] disabled:opacity-50";
const ICON =
  "grid size-8 place-items-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-ink disabled:opacity-40";

/**
 * Keys & settings, in Gagesite's dialog style: the keys the website uses to reach other services.
 * The owner names them; the plan only suggests. Values are encrypted, never shown again (only their
 * last 4 characters), and only the running website gets them; the AI building it sees names only.
 */
export default function KeysDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [data, setData] = useState<ProjectKeys | null>(null);
  const [open, setOpen] = useState<{ kind: "value" | "edit"; name: string } | null>(null);
  const [value, setValue] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(() => {
    api
      .getKeys(projectId)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [projectId]);
  useEffect(() => load(), [load]);
  useEffect(() => {
    doneRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || busy) return;
      if (open || adding) {
        setOpen(null);
        setAdding(false);
      } else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose, open, adding]);

  async function act(id: string, action: () => Promise<ProjectKeys>) {
    setBusy(id);
    setError(null);
    try {
      setData(await action());
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  function openValue(name: string) {
    setAdding(false);
    setValue("");
    setOpen({ kind: "value", name });
  }
  function openEdit(k: ProjectKey) {
    setAdding(false);
    setDraft({ name: k.name, purpose: k.purpose, secret: k.secret, value: "" });
    setOpen({ kind: "edit", name: k.name });
  }
  function openAdd(start: Draft = EMPTY) {
    setOpen(null);
    setDraft({ ...start });
    setAdding(true);
  }

  async function saveValue(name: string) {
    if (value.trim() && (await act(`value-${name}`, () => api.setKeys(projectId, { [name]: value.trim() })))) {
      setValue("");
      setOpen(null);
    }
  }
  async function saveEdit(from: string) {
    if (await act(`edit-${from}`, () => api.editKey(projectId, from, draft))) setOpen(null);
  }
  async function add() {
    if (!draft.name.trim()) return setError("Give the key a name, e.g. MODEL_API_KEY.");
    if (await act("add", () => api.addKey(projectId, draft))) setAdding(false);
  }

  const keys = data?.keys ?? [];
  const suggestions = data?.suggestions ?? [];
  const missing = keys.filter((k) => k.required && !k.set).length;

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#0e1b2c]/50 p-4 [animation:overlay-in_160ms_ease-out]"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="keys-title"
        className="flex max-h-[min(720px,calc(100vh-2rem))] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_-24px_rgba(14,27,44,0.45)] [animation:rise-in_200ms_cubic-bezier(0.2,0.8,0.2,1)]"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 id="keys-title" className="text-base font-semibold tracking-tight">
            Keys & settings
          </h2>
          <button type="button" onClick={onClose} disabled={!!busy} aria-label="Close" className={`-mr-2 ${ICON}`}>
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <p className="text-sm leading-relaxed text-muted">
            The keys your website uses to reach other services, named however you like.
          </p>

          {data === null ? (
            <div className="h-28 animate-pulse rounded-xl bg-surface-2" aria-label="Loading keys" />
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {keys.length === 0 && !adding && (
                <p className="px-4 py-6 text-center text-sm text-muted">No keys yet.</p>
              )}
              {keys.map((k) => {
                const own = k.source === "owner";
                const isOpen = open?.name === k.name;
                return (
                  <div key={k.name} className={`transition-colors ${isOpen ? "bg-surface-2/60" : "hover:bg-surface-2/40"}`}>
                    {open?.kind === "edit" && isOpen ? (
                      <div className="p-4 [animation:rise-in_160ms_ease-out]">
                        <KeyForm
                          draft={draft}
                          onChange={setDraft}
                          withValue={false}
                          busy={busy === `edit-${k.name}`}
                          submitLabel="Save changes"
                          onSubmit={() => saveEdit(k.name)}
                          onCancel={() => setOpen(null)}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5">
                              <code className="truncate font-mono text-[13px] font-semibold text-ink">{k.name}</code>
                              {k.secret && <LockSimple size={12} className="shrink-0 text-faint" aria-label="Secret" />}
                            </p>
                            <p className="truncate text-xs text-muted">
                              {k.purpose || (own ? "No description" : "Needed by the website to go online")}
                            </p>
                          </div>
                          <Status k={k} />
                          <div className="flex shrink-0 items-center">
                            <button
                              type="button"
                              onClick={() => (isOpen ? setOpen(null) : openValue(k.name))}
                              disabled={!!busy}
                              className="h-8 rounded-lg px-2.5 text-sm font-medium text-accent-ink transition hover:bg-accent-soft disabled:opacity-40"
                            >
                              {k.set ? "Replace" : "Set value"}
                            </button>
                            {own && (
                              <button
                                type="button"
                                onClick={() => openEdit(k)}
                                disabled={!!busy}
                                aria-label={`Rename or describe ${k.name}`}
                                title="Rename or describe"
                                className={ICON}
                              >
                                <PencilSimple size={15} />
                              </button>
                            )}
                            {(own || k.set) && (
                              <button
                                type="button"
                                onClick={() => act(`rm-${k.name}`, () => api.removeKey(projectId, k.name))}
                                disabled={!!busy}
                                aria-label={own ? `Remove ${k.name}` : `Clear ${k.name}`}
                                title={own ? "Remove this key" : "Clear the value"}
                                className={`${ICON} hover:bg-danger-soft hover:text-danger`}
                              >
                                {busy === `rm-${k.name}` ? <CircleNotch size={15} className="animate-spin" /> : <Trash size={15} />}
                              </button>
                            )}
                          </div>
                        </div>
                        {open?.kind === "value" && isOpen && (
                          <form
                            className="flex gap-2 px-4 pb-3 [animation:rise-in_160ms_ease-out]"
                            onSubmit={(e) => {
                              e.preventDefault();
                              saveValue(k.name);
                            }}
                          >
                            <input
                              autoFocus
                              value={value}
                              onChange={(e) => setValue(e.target.value)}
                              type="password"
                              autoComplete="off"
                              spellCheck={false}
                              placeholder={k.set ? "Paste the new value" : "Paste the value"}
                              aria-label={`Value for ${k.name}`}
                              className={`${FIELD} font-mono`}
                            />
                            <button type="submit" disabled={!value.trim() || !!busy} className={PRIMARY}>
                              {busy === `value-${k.name}` && <CircleNotch size={14} className="animate-spin" />}
                              Save
                            </button>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              {adding ? (
                <div className="bg-surface-2/60 p-4 [animation:rise-in_160ms_ease-out]">
                  <KeyForm
                    draft={draft}
                    onChange={setDraft}
                    withValue
                    busy={busy === "add"}
                    submitLabel="Add key"
                    onSubmit={add}
                    onCancel={() => setAdding(false)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openAdd()}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-muted transition hover:bg-surface-2/60 hover:text-accent-ink"
                >
                  <Plus size={14} weight="bold" />
                  Add a key
                </button>
              )}
            </div>
          )}

          {suggestions.length > 0 && (
            <div>
              <p className="text-xs text-muted">Suggested by your plan</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => openAdd({ name: s.name, purpose: s.purpose, secret: s.secret, value: "" })}
                    title={s.purpose}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-line-strong px-2 font-mono text-[12px] text-muted transition hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
                  >
                    <Plus size={11} weight="bold" />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <p className="flex items-start gap-2 text-xs leading-relaxed text-faint">
            <ShieldCheck size={14} weight="fill" className="mt-0.5 shrink-0 text-emerald-600" />
            Encrypted and never shown again. Only your running website gets the values; Gagesite&apos;s AI builds with the
            names alone, and values never go into the code, GitHub or the download.
          </p>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/50 px-6 py-4">
          <p className="text-xs text-muted">
            {missing > 0
              ? `${missing} ${missing === 1 ? "key needs" : "keys need"} a value before going online.`
              : "Demo answers until a key is set. Saving restarts the preview."}
          </p>
          <button ref={doneRef} type="button" onClick={onClose} disabled={!!busy} className={`h-10 px-4 ${SECONDARY}`}>
            Done
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/** Set (dots and the last 4 characters, never more) or not. */
function Status({ k }: { k: ProjectKey }) {
  if (k.set) {
    return (
      <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted sm:inline-flex" title="Set">
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
        {/* Never more than the last 4 characters, even if the server sent more. */}
        <span className="font-mono tracking-wider">••••&#8202;{k.hint.slice(-4)}</span>
      </span>
    );
  }
  return (
    <span
      className={`hidden shrink-0 items-center gap-1.5 text-xs sm:inline-flex ${k.required ? "text-amber-700" : "text-faint"}`}
    >
      <span className={`size-1.5 rounded-full ${k.required ? "bg-amber-500" : "bg-line-strong"}`} aria-hidden />
      {k.required ? "Needed" : "Not set"}
    </span>
  );
}

function KeyForm({
  draft,
  onChange,
  withValue,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  withValue: boolean;
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <input
          autoFocus
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: toName(e.target.value) })}
          placeholder="NAME, e.g. MODEL_API_KEY"
          aria-label="Key name"
          className={`${FIELD} font-mono`}
        />
        <input
          value={draft.purpose}
          onChange={(e) => onChange({ ...draft, purpose: e.target.value })}
          placeholder="What it's for"
          aria-label="What it's for"
          maxLength={200}
          className={FIELD}
        />
      </div>
      {withValue && (
        <input
          value={draft.value}
          onChange={(e) => onChange({ ...draft, value: e.target.value })}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="Value (optional, add it later if you like)"
          aria-label="Value"
          className={`${FIELD} font-mono`}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={draft.secret}
            onChange={(e) => onChange({ ...draft, secret: e.target.checked })}
            className="size-3.5 accent-[var(--color-accent)]"
          />
          Secret (a key or password)
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className={SECONDARY}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={PRIMARY}>
            {busy && <CircleNotch size={14} className="animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
