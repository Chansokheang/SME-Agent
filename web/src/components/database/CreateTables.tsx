"use client";

import { ArrowSquareOut, CaretDown, CheckCircle, CircleNotch, Code, Table, WarningCircle } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Status = Awaited<ReturnType<typeof api.getConnectionTables>>;

/** Creates the approved design's tables in the owner's connected database (optional before launch). */
export default function CreateTables({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [sql, setSql] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatusError(null);
    api.getConnectionTables(projectId).then(setStatus).catch((e) => setStatusError(e.message));
  }, [projectId]);
  useEffect(load, [load]);

  async function toggleSql() {
    setShowSql((v) => !v);
    if (sql === null) {
      try {
        setSql((await api.getSqlPreview(projectId)).sql);
      } catch (e) {
        setSql(`-- ${(e as Error).message}`);
      }
    }
  }

  async function create() {
    setCreating(true);
    setError(null);
    try {
      await api.createTables(projectId);
      setConfirming(false);
      load();
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (statusError) return <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{statusError}</p>;
  if (!status) return <div className="h-28 animate-pulse rounded-2xl bg-surface-2" aria-label="Checking tables" />;

  const total = status.design.length;
  const done = status.existing.length;
  const allCreated = done === total;
  const partial = done > 0 && !allCreated;
  const editorUrl = status.supabase_ref ? `https://supabase.com/dashboard/project/${status.supabase_ref}/editor` : null;

  return (
    <section className="rounded-3xl border border-line p-5">
      <div className="flex items-start gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${allCreated ? "bg-accent text-white" : "bg-surface-2 text-accent"}`}
        >
          {allCreated ? <CheckCircle size={20} weight="fill" /> : <Table size={20} weight="duotone" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {allCreated ? "Your tables are in your database" : `${done} of ${total} tables created`}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted">
            {allCreated
              ? "They are empty for now. Your spreadsheet rows are imported when the site launches."
              : "Optional now, required before launch. Creating them early lets you see the structure in your database."}
          </p>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-1.5">
        {status.design.map((name) => {
          const exists = status.existing.includes(name);
          return (
            <li
              key={name}
              className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${exists ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-muted"}`}
            >
              {name}
            </li>
          );
        })}
      </ul>

      {partial && (
        <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          <WarningCircle size={16} weight="fill" className="mt-px shrink-0 text-amber-500" />
          Some tables with these names already exist, so nothing will be created automatically. Rename or remove them
          in your database first.
        </p>
      )}
      {error && <p className="mt-4 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!allCreated && !partial && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98]"
          >
            <Table size={16} weight="bold" />
            Create tables now
          </button>
        )}
        {editorUrl && allCreated && (
          <a
            href={editorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong px-4 py-2.5 text-sm font-medium transition hover:border-accent hover:text-accent-ink"
          >
            Open Supabase Table Editor
            <ArrowSquareOut size={14} />
          </a>
        )}
        <button
          onClick={toggleSql}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <Code size={15} />
          {showSql ? "Hide SQL" : "Preview SQL"}
          <CaretDown size={12} className={`transition ${showSql ? "rotate-180" : ""}`} />
        </button>
      </div>

      {confirming && (
        <div className="mt-4 rounded-2xl bg-accent-soft p-4">
          <p className="text-sm font-medium text-accent-ink">
            Create {total} new tables in your database?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-accent-ink/80">
            It runs as one step: either every table is created or nothing changes. Nothing that is already in your
            database is changed or deleted.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={create}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
            >
              {creating && <CircleNotch size={15} className="animate-spin" />}
              {creating ? "Creating..." : "Yes, create tables"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={creating}
              className="rounded-xl px-3 py-2 text-sm font-medium text-accent-ink hover:bg-surface/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showSql && (
        <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-[#0e1b2c] p-4 font-mono text-[11px] leading-relaxed text-sky-100">
          {sql ?? "Generating..."}
        </pre>
      )}
    </section>
  );
}
