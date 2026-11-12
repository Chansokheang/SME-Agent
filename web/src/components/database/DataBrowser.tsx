"use client";

import { CaretDown, CaretLeft, CaretRight, Database, DownloadSimple, FileXls, LockSimple, Warning } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import ImportDialog, { providerName } from "@/components/database/ImportDialog";
import EmptyCard from "@/components/stage/EmptyCard";
import { api, type DataOverview, type DataPage } from "@/lib/api";

type Source = { kind: "db" } | { kind: "file"; file: string; sheet: string };
const PAGE_SIZES = [100, 200];
// Secrets the website makes itself (password and key hashes, tokens): never shown, never imported.
const SECRET = /password|hash|token|secret|salt/i;

/**
 * The owner's own rows, per table: from their connected database, or from the spreadsheet they
 * uploaded (before it is imported). One page at a time from the server, so big tables stay fast.
 */
/** Tables that actually have rows: in the database, or in an uploaded file still on hand. */
export function tablesWithData(overview: DataOverview) {
  return overview.tables.filter((t) => (t.db_rows ?? 0) > 0 || t.sources.some((s) => s.available));
}

/** Loads the data overview (row counts per table); the panel shares it with its tab badge. */
export function useDataOverview(projectId: string, refreshKey?: unknown) {
  const [state, setState] = useState<{ overview: DataOverview | null; error: string | null }>({ overview: null, error: null });
  useEffect(() => {
    let live = true;
    api
      .getDataOverview(projectId)
      .then((overview) => live && setState({ overview, error: null }))
      .catch((e) => live && setState({ overview: null, error: (e as Error).message }));
    return () => {
      live = false;
    };
  }, [projectId, refreshKey]);
  return state;
}

export default function DataBrowser({
  projectId,
  overview,
  error,
  onImported,
}: {
  projectId: string;
  overview: DataOverview | null;
  error: string | null;
  onImported: () => void;
}) {
  const [tableName, setTableName] = useState<string | null>(null);

  if (error) return <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>;
  if (!overview) return <div className="h-80 animate-pulse rounded-3xl bg-surface-2" aria-label="Loading data" />;

  // With a database connected every table is listed, so the owner can import into empty ones.
  const dbOpen = overview.database.connected && !overview.database.error;
  const withData = dbOpen ? overview.tables : tablesWithData(overview);
  if (!withData.length) return <NoData connected={overview.database.connected} />;

  const table = withData.find((t) => t.name === tableName) ?? withData[0];
  const totalRows = overview.tables.reduce((n, t) => n + (t.db_rows ?? 0), 0);
  const warnings = overview.issues.filter((i) => i.severity === "warning");

  return (
    <div className="@container space-y-4">
      {dbOpen && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Connected
          </span>
          Your {providerName(overview.database.provider)} database: {totalRows.toLocaleString()} row{totalRows === 1 ? "" : "s"} in{" "}
          {overview.tables.length} tables. Pick a table to see its rows or import more.
        </p>
      )}
      {(warnings.length > 0 || overview.not_imported.length > 0) && <ImportNotes overview={overview} />}

      <div className="grid gap-4 @3xl:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Table list: a column when there is room, a row of chips when narrow */}
        <nav aria-label="Tables" className="flex gap-1.5 overflow-x-auto @3xl:flex-col @3xl:overflow-visible @3xl:border-r @3xl:border-line @3xl:pr-4">
          {withData.map((t) => {
            const active = t.name === table.name;
            const fileRows = t.sources.reduce((n, s) => n + (s.rows ?? 0), 0);
            const count = t.db_rows ?? (fileRows || null);
            const empty = dbOpen && !count;
            return (
              <button
                key={t.name}
                onClick={() => setTableName(t.name)}
                className={`flex shrink-0 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                  active ? "bg-accent-soft font-medium text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <span className={`truncate ${empty && !active ? "text-faint" : ""}`}>{t.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-faint">{count === null ? "" : count.toLocaleString()}</span>
              </button>
            );
          })}
        </nav>

        <TableData key={`${table.name}-${table.db_rows}`} projectId={projectId} overview={overview} table={table} onImported={onImported} />
      </div>

      <p className="flex items-center gap-1.5 text-xs text-faint">
        <LockSimple size={13} />
        Only you see these rows. Gagesite only ever sees column names and masked samples. Passwords and keys are never shown.
      </p>
    </div>
  );
}

function TableData({
  projectId,
  overview,
  table,
  onImported,
}: {
  projectId: string;
  overview: DataOverview;
  table: DataOverview["tables"][number];
  onImported: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const fileSources = table.sources.filter((s) => s.available);
  const dbReady = overview.database.connected && !overview.database.error && table.db_rows !== null;
  // Show the database once it has rows; before that, the uploaded sheet (what will be imported).
  const initial: Source | null =
    dbReady && (table.db_rows ?? 0) > 0
      ? { kind: "db" }
      : fileSources[0]
        ? { kind: "file", file: fileSources[0].file, sheet: fileSources[0].sheet }
        : dbReady
          ? { kind: "db" }
          : null;
  const [source, setSource] = useState<Source | null>(initial);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<DataPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceKey = source ? (source.kind === "db" ? "db" : `${source.file}>${source.sheet}`) : "";

  useEffect(() => {
    if (!source) return;
    let live = true;
    setLoading(true);
    setError(null);
    api
      .getDataRows(projectId, {
        table: table.name,
        source: source.kind,
        file: source.kind === "file" ? source.file : "",
        sheet: source.kind === "file" ? source.sheet : "",
        offset,
        limit: pageSize,
      })
      .then((p) => live && setPage(p))
      .catch((e) => live && setError((e as Error).message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // sourceKey stands in for `source` (a new object on every render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, table.name, sourceKey, offset, pageSize]);

  const choose = (next: Source) => {
    setSource(next);
    setOffset(0);
    setPage(null);
  };

  const options = useMemo(
    () => [
      ...(dbReady ? [{ key: "db", label: `Your ${providerName(overview.database.provider) || "database"}`, icon: Database, value: { kind: "db" } as Source }] : []),
      ...fileSources.map((s) => ({
        key: `${s.file}>${s.sheet}`,
        label: s.sheet ? `${s.file} > ${s.sheet}` : s.file,
        icon: FileXls,
        value: { kind: "file", file: s.file, sheet: s.sheet } as Source,
      })),
    ],
    [dbReady, fileSources, overview.database.provider],
  );

  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold leading-tight tracking-tight">{table.label}</h3>
          {table.description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{table.description}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
        {options.length > 1 && (
          <div className="flex shrink-0 rounded-lg bg-surface-2 p-0.5" role="radiogroup" aria-label="Show rows from">
            {options.map((o) => (
              <button
                key={o.key}
                role="radio"
                aria-checked={sourceKey === o.key}
                onClick={() => choose(o.value)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                  sourceKey === o.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                <o.icon size={13} />
                <span className="max-w-[12rem] truncate normal-case">{o.label}</span>
              </button>
            ))}
          </div>
        )}
        {dbReady && (
          <button
            onClick={() => setImporting(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(34,102,212,0.8)] transition duration-200 hover:-translate-y-0.5 hover:bg-accent-hover active:scale-[0.98]"
          >
            <DownloadSimple size={15} weight="bold" />
            Import
          </button>
        )}
        </div>
      </div>

      <SourceNote overview={overview} table={table} source={source} />
      {importing && (
        <ImportDialog
          projectId={projectId}
          table={{ name: table.name, label: table.label }}
          provider={overview.database.provider}
          onClose={() => setImporting(false)}
          onImported={onImported}
        />
      )}

      {!source ? (
        <EmptyRows overview={overview} table={table} onImport={dbReady ? () => setImporting(true) : undefined} />
      ) : error ? (
        <p className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
      ) : !page ? (
        <div className="mt-3 h-64 animate-pulse rounded-xl bg-surface-2" />
      ) : page.total === 0 ? (
        <EmptyRows overview={overview} table={table} onImport={dbReady ? () => setImporting(true) : undefined} />
      ) : (
        <>
          <div className={`mt-3 overflow-auto rounded-xl ring-1 ring-line transition-opacity ${loading ? "opacity-60" : ""}`} style={{ maxHeight: "62vh" }}>
            <table className="w-max min-w-full border-collapse text-[13px]">
              <thead className="sticky top-0 z-10 bg-surface-2">
                <tr>
                  <th className="sticky left-0 z-10 bg-surface-2 px-3 py-2 text-right text-xs font-medium text-faint">#</th>
                  {page.columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted">
                      <span className="inline-flex items-center gap-1">
                        {SECRET.test(c) && <LockSimple size={11} />}
                        {c}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row, r) => (
                  <tr key={offset + r} className="border-t border-line hover:bg-surface-2/60">
                    <td className="sticky left-0 bg-surface px-3 py-1.5 text-right text-xs tabular-nums text-faint">{offset + r + 1}</td>
                    {row.map((cell, i) => {
                      const hidden = SECRET.test(page.columns[i] ?? "") && cell !== null && cell !== "";
                      return (
                        <td
                          key={i}
                          className="max-w-[18rem] truncate whitespace-nowrap px-3 py-1.5"
                          title={hidden || cell === null ? "" : String(cell)}
                        >
                          {hidden ? (
                            <span className="rounded bg-surface-2 px-1.5 py-px text-[11px] text-faint">Hidden</span>
                          ) : cell === null || cell === "" ? (
                            <span className="text-line-strong">&ndash;</span>
                          ) : (
                            String(cell)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
            <span className="tabular-nums">
              Rows {(offset + 1).toLocaleString()}–{Math.min(offset + pageSize, page.total).toLocaleString()} of{" "}
              {page.total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5">
                Per page
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setOffset(0);
                  }}
                  className="rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-xs text-ink"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => setOffset(Math.max(0, offset - pageSize))}
                disabled={offset === 0 || loading}
                aria-label="Previous page"
                className="grid size-7 place-items-center rounded-md border border-line-strong transition hover:border-accent disabled:opacity-40"
              >
                <CaretLeft size={13} weight="bold" />
              </button>
              <button
                onClick={() => setOffset(offset + pageSize)}
                disabled={offset + pageSize >= page.total || loading}
                aria-label="Next page"
                className="grid size-7 place-items-center rounded-md border border-line-strong transition hover:border-accent disabled:opacity-40"
              >
                <CaretRight size={13} weight="bold" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/** Only real data shows here, so explain why the website preview can show records when this is empty. */
const SAMPLE_NOTE =
  "The website preview uses sample records Gagesite made up so its pages look real. They stay in the preview: they never show here and never go online.";

/** Nothing to browse yet: a plain page, no table names. */
function NoData({ connected }: { connected: boolean }) {
  return (
    <EmptyCard
      icon={Database}
      title="No data yet"
      text={`${connected ? "Your database has no rows yet." : "Your real data shows here once you upload files or connect your database."} ${SAMPLE_NOTE}`}
    />
  );
}

/** Where the rows on screen come from, in one line. */
function SourceNote({
  overview,
  table,
  source,
}: {
  overview: DataOverview;
  table: DataOverview["tables"][number];
  source: Source | null;
}) {
  const feed = table.sources[0];
  let text = "";
  if (source?.kind === "db") {
    text = `Rows in your ${providerName(overview.database.provider)} database, the one your website uses. Import adds new rows; nothing here changes or deletes any.`;
    if (feed) text += ` ${feed.sheet || feed.file} from your upload is copied in when the site launches.`;
  } else if (source?.kind === "file") {
    text = `From your upload. These rows are copied into your database when the site launches.`;
  }
  if (!text) return null;
  return <p className="mt-2 text-xs text-faint">{text}</p>;
}

function EmptyRows({
  overview,
  table,
  onImport,
}: {
  overview: DataOverview;
  table: DataOverview["tables"][number];
  onImport?: () => void;
}) {
  const deleted = table.sources.find((s) => !s.available);
  const db = overview.database;
  const lines: string[] = [];
  if (!db.connected) lines.push("No database connected yet. Connect one to see and import rows here.", SAMPLE_NOTE);
  else if (db.error) lines.push(`Couldn't reach your database: ${db.error}`);
  else if (table.db_rows === null) lines.push("This table isn't in your database yet. Create the tables from the Connect panel.");
  else lines.push(`No ${table.label.toLowerCase()} in your ${providerName(db.provider)} database yet.`, SAMPLE_NOTE);
  if (deleted) {
    lines.push(
      `${deleted.sheet || deleted.file} (${deleted.rows ?? "?"} rows) from ${deleted.file} will fill it at launch. The file itself was removed after the design step, for privacy.`,
    );
  }
  return (
    <div className="mt-3 grid place-items-center rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
      <div className="max-w-sm space-y-1.5">
        <Database size={26} className="mx-auto text-accent" weight="duotone" />
        {lines.map((l) => (
          <p key={l} className="text-sm leading-relaxed text-muted">
            {l}
          </p>
        ))}
        {onImport && (
          <button
            onClick={onImport}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-accent-hover active:scale-[0.98]"
          >
            <DownloadSimple size={15} weight="bold" />
            Import {table.label.toLowerCase()} from a spreadsheet
          </button>
        )}
      </div>
    </div>
  );
}

/** What was the Import tab: problems to fix before the rows are copied, and sheets left out. */
function ImportNotes({ overview }: { overview: DataOverview }) {
  const [open, setOpen] = useState(false);
  const warnings = overview.issues.filter((i) => i.severity === "warning");
  return (
    <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200/70">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-amber-950">
        <Warning size={16} weight="fill" className="shrink-0 text-amber-500" />
        <span className="flex-1">
          {warnings.length > 0 && (
            <span className="font-semibold">
              {warnings.length} thing{warnings.length === 1 ? "" : "s"} to fix before import
            </span>
          )}
          {warnings.length > 0 && overview.not_imported.length > 0 && ", "}
          {overview.not_imported.length > 0 && `${overview.not_imported.length} sheet${overview.not_imported.length === 1 ? "" : "s"} not imported`}
        </span>
        <CaretDown size={12} weight="bold" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-amber-200/70 px-4 py-3 text-sm leading-relaxed text-amber-950">
          {warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 marker:text-amber-400">
              {warnings.map((w) => (
                <li key={w.message}>{w.message}</li>
              ))}
            </ul>
          )}
          {overview.not_imported.map((s) => (
            <p key={`${s.file}>${s.sheet}`} className="text-amber-900/80">
              <span className="font-medium">Not imported: {s.sheet || s.file}</span>
              {s.rows !== null && ` (${s.rows} rows)`}
              {s.notes && `. ${s.notes}`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
