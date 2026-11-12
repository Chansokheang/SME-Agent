"use client";

import { CheckCircle, CircleNotch, Database, LockSimple } from "@phosphor-icons/react";
import { useState } from "react";
import { api, type DbProvider, type FileProfile, type SourceDb } from "@/lib/api";

const PROVIDERS: { key: DbProvider; label: string; hint: string }[] = [
  {
    key: "supabase",
    label: "Supabase",
    hint: "In your Supabase project: Connect, then Session pooler, then copy the URI. Replace [YOUR-PASSWORD] with your database password.",
  },
  { key: "neon", label: "Neon", hint: "In Neon: Connection details, then copy the connection string." },
  { key: "postgres", label: "Other Postgres", hint: "A connection string like postgresql://user:password@host:5432/database." },
];

/**
 * Connects the owner's existing database as a SOURCE to design around: read-only, structure and
 * masked samples only. The string goes straight to the server, which stores it encrypted.
 */
export default function SourceConnect({
  projectId,
  source,
  tables,
  onChange,
}: {
  projectId: string;
  source: SourceDb | null;
  /** The connected database's tables, from the data profile. */
  tables: FileProfile["sheets"];
  onChange: (source: SourceDb | null, uploads: FileProfile[]) => void;
}) {
  const [provider, setProvider] = useState<DbProvider>("supabase");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.connectSourceDatabase(projectId, provider, url);
      setUrl("");
      onChange(result.source, result.uploads);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      const result = await api.disconnectSourceDatabase(projectId);
      onChange(null, result.uploads);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (source) {
    return (
      <div className="rounded-3xl border border-line bg-surface p-5">
        <div className="flex items-start gap-3">
          <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{source.label} connected</p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {source.database} on {source.host}
            </p>
          </div>
          <button
            onClick={disconnect}
            disabled={busy}
            className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-40"
          >
            Disconnect
          </button>
        </div>
        {tables.length > 0 && (
          <ul className="mt-4 grid gap-x-4 gap-y-1 border-t border-line pt-3 text-sm @lg:grid-cols-2">
            {tables.map((t) => (
              <li key={t.name} className="flex items-baseline justify-between gap-3">
                <span className="truncate">{t.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-faint">{t.rows.toLocaleString()} rows</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-faint">
          <LockSimple size={13} className="mt-px shrink-0" />
          Read only: nothing in this database changes. Gagesite only sees its structure, row counts and masked samples.
        </p>
      </div>
    );
  }

  const hint = PROVIDERS.find((p) => p.key === provider)?.hint;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (url.trim()) connect();
      }}
      className="rounded-3xl border border-line bg-surface p-5"
    >
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Where your database is">
        {PROVIDERS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={provider === p.key}
            onClick={() => setProvider(p.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              provider === p.key ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label htmlFor="source-url" className="mt-4 block text-sm font-medium">
        Connection string
      </label>
      <textarea
        id="source-url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        rows={2}
        spellCheck={false}
        autoComplete="off"
        placeholder="postgresql://..."
        className="mt-1.5 w-full resize-none rounded-xl border border-line-strong bg-surface px-3 py-2 font-mono text-xs outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft"
      />
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>}
      {error && <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-faint">
          <LockSimple size={13} className="mt-px shrink-0" />
          Read only. Stored encrypted and never shown to Gagesite.
        </p>
        <button
          disabled={busy || !url.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:bg-line-strong"
        >
          {busy ? <CircleNotch size={15} className="animate-spin" /> : <Database size={15} weight="bold" />}
          {busy ? "Reading your database..." : "Connect and read it"}
        </button>
      </div>
    </form>
  );
}
