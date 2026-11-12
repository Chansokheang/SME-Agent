"use client";

import { CaretDown, Check, CircleNotch, Desktop, Plus, Trash, UserCircle, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ClaudeAccounts } from "@/lib/api";

/**
 * Which Claude account Gagesite's AI runs use. Accounts are added with a token from
 * `claude setup-token`; with none picked, runs use this computer's own Claude Code login.
 * Switching is always the owner's choice: Gagesite never switches by itself.
 */
export default function ClaudeAccountMenu() {
  const [data, setData] = useState<ClaudeAccounts | null>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api
      .getClaudeAccounts()
      .then(setData)
      .catch(() => undefined);
  }, []);
  useEffect(() => load(), [load]);

  // Close on a click outside or Escape (not while a token is being checked).
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!busy && box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setOpen(false);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy]);

  async function act(key: string, action: () => Promise<ClaudeAccounts>) {
    setBusy(key);
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

  async function add() {
    if (!name.trim() || !token.trim()) {
      setError("Give the account a name and paste its token.");
      return;
    }
    if (await act("add", () => api.addClaudeAccount(name.trim(), token.trim()))) {
      setName("");
      setToken("");
      setAdding(false);
    }
  }

  const active = data?.accounts.find((a) => a.active);
  const computerLabel = data?.computer.email ?? (data?.computer.logged_in ? "Signed in" : "Not signed in");
  const label = active ? active.name : "This computer";

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Which Claude account Gagesite uses"
        className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted transition hover:bg-accent-soft hover:text-accent-ink"
      >
        <UserCircle size={18} weight={active ? "fill" : "regular"} className={active ? "text-accent" : ""} />
        <span className="hidden max-w-[9rem] truncate sm:inline">{data ? label : "Claude"}</span>
        <CaretDown size={12} weight="bold" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Claude account"
          className="absolute right-0 top-full z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-4 text-left shadow-[0_24px_48px_-24px_rgba(14,42,87,0.4)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-base font-bold">Claude account</p>
              <p className="mt-0.5 text-xs text-muted">Every AI step in Gagesite runs on the account you pick here.</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-lg p-1 text-faint hover:bg-surface-2 hover:text-ink"
            >
              <X size={14} weight="bold" />
            </button>
          </div>

          <ul className="mt-3 space-y-1.5">
            <Option
              selected={!active}
              busy={busy === "computer"}
              onSelect={() => act("computer", () => api.chooseClaudeAccount(null))}
              icon={<Desktop size={16} />}
              title="This computer's login"
              detail={[computerLabel, data?.computer.plan && `${data.computer.plan} plan`].filter(Boolean).join(" · ")}
            />
            {data?.accounts.map((account) => (
              <Option
                key={account.id}
                selected={account.active}
                busy={busy === account.id}
                onSelect={() => act(account.id, () => api.chooseClaudeAccount(account.id))}
                icon={<UserCircle size={16} />}
                title={account.name}
                detail={`Token ending ${account.hint}${account.last_used_at ? ` · last used ${when(account.last_used_at)}` : ""}`}
                action={
                  confirmRemove === account.id ? (
                    <span className="flex items-center gap-1 text-xs">
                      <button
                        onClick={() =>
                          act(`rm-${account.id}`, () => api.removeClaudeAccount(account.id)).then(() =>
                            setConfirmRemove(null),
                          )
                        }
                        className="rounded-md bg-danger px-2 py-1 font-semibold text-white"
                      >
                        Remove
                      </button>
                      <button onClick={() => setConfirmRemove(null)} className="rounded-md px-2 py-1 text-muted">
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(account.id)}
                      aria-label={`Remove ${account.name}`}
                      className="rounded-lg p-1.5 text-faint transition hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash size={14} />
                    </button>
                  )
                }
              />
            ))}
          </ul>

          {adding ? (
            <div className="mt-3 space-y-2 rounded-xl border border-line bg-surface-2 p-3">
              <p className="text-xs leading-relaxed text-muted">
                In a terminal signed in to that account, run{" "}
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px] text-ink">claude setup-token</code>{" "}
                and paste the token it prints. Gagesite checks it with one tiny request, then keeps it encrypted.
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name, e.g. Lab account"
                maxLength={60}
                className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Token (sk-ant-...)"
                className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-accent"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={add}
                  disabled={busy === "add"}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
                >
                  {busy === "add" ? <CircleNotch size={14} className="animate-spin" /> : <Check size={14} weight="bold" />}
                  {busy === "add" ? "Checking the token..." : "Check and add"}
                </button>
                <button
                  onClick={() => {
                    setAdding(false);
                    setError(null);
                  }}
                  disabled={busy === "add"}
                  className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setAdding(true);
                setError(null);
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent-ink"
            >
              <Plus size={14} weight="bold" />
              Add an account
            </button>
          )}

          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <p className="mt-3 text-[11px] leading-snug text-faint">
            Runs started after a switch use the new account; one already running finishes on its account. Gagesite never
            switches accounts by itself.
          </p>
        </div>
      )}
    </div>
  );
}

function Option({
  selected,
  busy,
  onSelect,
  icon,
  title,
  detail,
  action,
}: {
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <li
      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition ${
        selected ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"
      }`}
    >
      <button
        onClick={onSelect}
        disabled={selected || busy}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <span className={`grid size-5 shrink-0 place-items-center ${selected ? "text-accent" : "text-faint"}`}>
          {busy ? <CircleNotch size={14} className="animate-spin" /> : selected ? <Check size={16} weight="bold" /> : icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{title}</span>
          <span className="block truncate text-xs text-muted">{detail}</span>
        </span>
      </button>
      {action}
    </li>
  );
}

function when(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}
