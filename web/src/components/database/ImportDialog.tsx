"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CircleNotch,
  Database,
  FileArrowUp,
  FileXls,
  Info,
  LinkSimple,
  LockSimple,
  Sparkle,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  api,
  type ImportCheck,
  type ImportColumn,
  type ImportFile,
  type ImportJob,
  type ImportMapping,
  type ImportPlan,
  type ImportSource,
  type ImportSources,
} from "@/lib/api";

type Step = "source" | "match" | "check" | "adding" | "done";
const STEPS: { key: Step; label: string }[] = [
  { key: "source", label: "Choose data" },
  { key: "match", label: "Match columns" },
  { key: "check", label: "Check" },
  { key: "done", label: "Add" },
];
const SAME_VALUE = "__value__";

/** "supabase" -> "Supabase", "neon" -> "Neon", "postgres" -> "Postgres". */
export function providerName(provider: string | null | undefined) {
  return provider ? provider[0].toUpperCase() + provider.slice(1) : "";
}

/**
 * Import rows into one table of the owner's connected database: pick a spreadsheet (or a table of
 * their existing database), match its columns to the fields, see what will happen, then add.
 * Rows are only ever added; nothing is changed or deleted.
 */
export default function ImportDialog({
  projectId,
  table,
  provider,
  onClose,
  onImported,
}: {
  projectId: string;
  table: { name: string; label: string };
  provider: string | null;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>("source");
  const [sources, setSources] = useState<ImportSources | null>(null);
  const [uploaded, setUploaded] = useState<ImportFile | null>(null);
  const [source, setSource] = useState<ImportSource | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [mapping, setMapping] = useState<ImportMapping[]>([]);
  const [check, setCheck] = useState<ImportCheck | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .importSources(projectId)
      .then(setSources)
      .catch(() => setSources({ uploads: [], existing: null, job: null }));
  }, [projectId]);

  // Close on Escape (not while rows are being added).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "adding") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    if (uploaded) api.importForget(projectId, uploaded.id).catch(() => undefined); // the file is never kept
    onClose();
  }

  async function choose(next: ImportSource) {
    setBusy(true);
    setError(null);
    try {
      const found = await api.importPlan(projectId, table.name, next);
      setSource(next);
      setPlan(found);
      setMapping(found.mapping);
      setCheck(null);
      setStep("match");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runCheck() {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      setCheck(await api.importCheck(projectId, table.name, source, mapping));
      setStep("check");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      setJob(await api.importRun(projectId, table.name, source, mapping));
      setStep("adding");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Follow the import until it is done.
  useEffect(() => {
    if (step !== "adding") return;
    const timer = window.setInterval(async () => {
      const latest = await api.importStatus(projectId).catch(() => null);
      if (!latest) return;
      setJob(latest);
      if (latest.status !== "running") {
        window.clearInterval(timer);
        setStep("done");
        if (latest.status === "done") onImported();
      }
    }, 800);
    return () => window.clearInterval(timer);
  }, [step, projectId, onImported]);

  const stepIndex = STEPS.findIndex((s) => s.key === (step === "adding" ? "done" : step));

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/30 p-0 backdrop-blur-[2px] motion-safe:animate-[overlay-in_160ms_ease-out] sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Import into ${table.label}`}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl motion-safe:animate-[rise-in_220ms_ease-out] sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-ink">Import data</p>
            <h2 className="mt-0.5 font-display text-xl font-bold tracking-tight">Add rows to {table.label}</h2>
            <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {STEPS.map((s, i) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span
                    className={`flex items-center gap-1.5 font-medium transition-colors duration-200 ${
                      i < stepIndex ? "text-emerald-700" : i === stepIndex ? "text-ink" : "text-faint"
                    }`}
                  >
                    <span
                      className={`grid size-5 place-items-center rounded-full text-[11px] transition-colors duration-200 ${
                        i < stepIndex
                          ? "bg-emerald-100 text-emerald-700"
                          : i === stepIndex
                            ? "bg-accent text-white"
                            : "bg-surface-2 text-faint"
                      }`}
                    >
                      {i < stepIndex ? <CheckCircle size={12} weight="fill" /> : i + 1}
                    </span>
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && <span className="h-px w-4 bg-line-strong" />}
                </li>
              ))}
            </ol>
          </div>
          <button
            onClick={close}
            disabled={step === "adding"}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink active:scale-95 disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <p className="mb-4 flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger motion-safe:animate-[fade-in_160ms_ease-out]">
              <Warning size={16} weight="fill" className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}
          {step === "source" && (
            <SourceStep
              projectId={projectId}
              sources={sources}
              uploaded={uploaded}
              busy={busy}
              onUploaded={(file) => {
                if (uploaded) api.importForget(projectId, uploaded.id).catch(() => undefined);
                setUploaded(file);
                if (file.sheets.length === 1) choose({ kind: "file", file: file.id, sheet: file.sheets[0].name });
              }}
              onError={setError}
              onChoose={choose}
            />
          )}
          {step === "match" && plan && <MatchStep plan={plan} mapping={mapping} onChange={setMapping} />}
          {step === "check" && check && plan && <CheckStep check={check} plan={plan} provider={provider} />}
          {(step === "adding" || step === "done") && job && <ResultStep job={job} table={table.label} />}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/50 px-6 py-3.5">
          <p className="flex items-center gap-1.5 text-xs text-faint">
            <LockSimple size={13} />
            Only you see your rows. Rows are only added: nothing is changed or deleted.
          </p>
          <div className="flex items-center gap-2">
            {(step === "match" || step === "check") && (
              <button
                onClick={() => setStep(step === "check" ? "match" : "source")}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong px-3.5 py-2 text-sm font-semibold transition hover:border-accent hover:text-accent-ink active:scale-[0.98] disabled:opacity-40"
              >
                <ArrowLeft size={14} weight="bold" />
                Back
              </button>
            )}
            {step === "match" && (
              <PrimaryButton onClick={runCheck} busy={busy}>
                Check {plan?.rows.toLocaleString()} rows
                <ArrowRight size={15} weight="bold" />
              </PrimaryButton>
            )}
            {step === "check" && check && (
              <PrimaryButton onClick={add} busy={busy} disabled={check.ready === 0}>
                {check.ready === 0 ? "Nothing new to add" : `Add ${check.ready.toLocaleString()} row${check.ready === 1 ? "" : "s"}`}
              </PrimaryButton>
            )}
            {step === "done" && (
              <PrimaryButton onClick={close} busy={false}>
                Done
              </PrimaryButton>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body, // above every panel, whatever their stacking
  );
}

function PrimaryButton({
  onClick,
  busy,
  disabled,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(34,102,212,0.8)] transition hover:bg-accent-hover active:scale-[0.98] disabled:bg-line-strong disabled:shadow-none"
    >
      {busy && <CircleNotch size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ 1. source */

function SourceStep({
  projectId,
  sources,
  uploaded,
  busy,
  onUploaded,
  onError,
  onChoose,
}: {
  projectId: string;
  sources: ImportSources | null;
  uploaded: ImportFile | null;
  busy: boolean;
  onUploaded: (file: ImportFile) => void;
  onError: (message: string | null) => void;
  onChoose: (source: ImportSource) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    onError(null);
    try {
      onUploaded(await api.importUpload(projectId, file));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const existing = sources?.existing;
  return (
    <div className="space-y-5">
      <button
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files[0]);
        }}
        disabled={uploading || busy}
        className={`group flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition duration-200 ${
          dragging ? "scale-[1.01] border-accent bg-accent-soft/60" : "border-line-strong hover:border-accent hover:bg-accent-soft/30"
        }`}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent transition-transform duration-200 group-hover:-translate-y-0.5">
          {uploading || busy ? <CircleNotch size={24} className="animate-spin" /> : <FileArrowUp size={24} weight="duotone" />}
        </span>
        <span className="font-semibold">{uploading ? "Reading your file..." : "Upload a spreadsheet"}</span>
        <span className="text-sm text-muted">Drop a CSV or Excel file here, or click to choose one. Up to 50 MB.</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {uploaded && uploaded.sheets.length > 1 && (
        <OptionGroup title={`Which sheet of ${uploaded.name}?`}>
          {uploaded.sheets.map((sheet) => (
            <Option
              key={sheet.name}
              icon={FileXls}
              title={sheet.name}
              detail={`${sheet.rows.toLocaleString()} rows, ${sheet.columns.length} columns`}
              disabled={busy}
              onClick={() => onChoose({ kind: "file", file: uploaded.id, sheet: sheet.name })}
            />
          ))}
        </OptionGroup>
      )}

      {sources === null ? (
        <div className="h-16 animate-pulse rounded-2xl bg-surface-2" />
      ) : (
        <>
          {sources.uploads.length > 0 && (
            <OptionGroup title="Files you uploaded for the design">
              {sources.uploads.flatMap((file) =>
                file.sheets.map((sheet) => (
                  <Option
                    key={`${file.id}>${sheet.name}`}
                    icon={FileXls}
                    title={sheet.name ? `${file.name} > ${sheet.name}` : file.name}
                    detail={`${sheet.rows.toLocaleString()} rows`}
                    disabled={busy}
                    onClick={() => onChoose({ kind: "upload", file: file.id, sheet: sheet.name })}
                  />
                )),
              )}
            </OptionGroup>
          )}
          {existing && (
            <OptionGroup title={`From your ${existing.label.toLowerCase()} (read only)`}>
              {existing.tables === null ? (
                <p className="px-1 text-sm text-muted">Couldn&apos;t reach that database right now.</p>
              ) : (
                existing.tables.map((t) => (
                  <Option
                    key={t.name}
                    icon={Database}
                    title={t.name}
                    detail={`${t.rows.toLocaleString()} rows`}
                    disabled={busy}
                    onClick={() => onChoose({ kind: "db", file: "", sheet: t.name })}
                  />
                ))
              )}
            </OptionGroup>
          )}
        </>
      )}
    </div>
  );
}

function OptionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Option({
  icon: Icon,
  title,
  detail,
  disabled,
  onClick,
}: {
  icon: typeof Database;
  title: string;
  detail: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex min-w-0 items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-sm active:scale-[0.99] disabled:opacity-50"
    >
      <Icon size={20} weight="duotone" className="shrink-0 text-accent" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted">{detail}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ 2. match */

function MatchStep({
  plan,
  mapping,
  onChange,
}: {
  plan: ImportPlan;
  mapping: ImportMapping[];
  onChange: (mapping: ImportMapping[]) => void;
}) {
  const byColumn = useMemo(() => new Map(mapping.map((m) => [m.column, m])), [mapping]);
  // Fields the owner fills: not secrets, not ids or timestamps the database makes itself.
  const fields = plan.columns.filter((c) => !c.secret && !(c.primary && c.has_default));
  const shown = fields.filter((c) => !(c.has_default && !c.required && /^(createdAt|created_at)$/.test(c.name)));
  const automatic = plan.columns.filter((c) => !shown.includes(c) && !c.secret);
  const secrets = plan.columns.filter((c) => c.secret);
  const matched = shown.filter((c) => {
    const m = byColumn.get(c.name);
    return m && (m.from || m.value);
  }).length;

  function set(column: string, change: Partial<ImportMapping>) {
    const current = byColumn.get(column) ?? { column, from: null, value: null, match: null };
    const next = { ...current, ...change };
    onChange(byColumn.has(column) ? mapping.map((m) => (m.column === column ? next : m)) : [...mapping, next]);
  }

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-xl bg-accent-soft/50 px-3.5 py-2.5 text-sm text-accent-ink">
        <Sparkle size={16} weight="fill" className="mt-0.5 shrink-0" />
        Gagesite matched {matched} of {shown.length} fields by their names. Check each one: pick the column from your data that
        fills it, or leave it empty.
      </p>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {shown.map((column) => (
          <FieldRow
            key={column.name}
            column={column}
            mapping={byColumn.get(column.name)}
            sourceColumns={plan.source_columns}
            samples={plan.samples}
            onChange={(change) => set(column.name, change)}
          />
        ))}
      </ul>
      {(automatic.length > 0 || secrets.length > 0) && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-faint">
          <Info size={14} className="mt-px shrink-0" />
          <span>
            {automatic.length > 0 && <>Filled in automatically: {automatic.map((c) => c.label).join(", ")}. </>}
            {secrets.length > 0 && <>Made by the website itself, never imported: {secrets.map((c) => c.label).join(", ")}.</>}
          </span>
        </p>
      )}
    </div>
  );
}

function FieldRow({
  column,
  mapping,
  sourceColumns,
  samples,
  onChange,
}: {
  column: ImportColumn;
  mapping: ImportMapping | undefined;
  sourceColumns: string[];
  samples: ImportPlan["samples"];
  onChange: (change: Partial<ImportMapping>) => void;
}) {
  const choice = mapping?.from ?? (mapping?.value !== null && mapping?.value !== undefined ? SAME_VALUE : "");
  const filled = !!(mapping?.from || mapping?.value);
  const sample = mapping?.from ? samples[mapping.from] ?? [] : [];
  const link = column.references;
  return (
    <li className={`grid gap-3 px-4 py-3 transition-colors duration-200 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] ${filled ? "" : "bg-surface-2/40"}`}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
          {column.label}
          {column.required && <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-bold uppercase text-amber-800">Required</span>}
          {column.unique && <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-semibold text-muted">No repeats</span>}
          {link && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-semibold text-accent-ink">
              <LinkSimple size={10} weight="bold" />
              {link.table}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          {column.hint || column.kind}
          {column.choices.length > 0 && <> One of: {column.choices.join(", ")}.</>}
          {column.auto === "id" && " Left empty, Gagesite makes a new one."}
          {column.auto === "now" && " Left empty, the time of the import."}
        </p>
      </div>
      <div className="min-w-0 space-y-1.5">
        <select
          value={choice}
          onChange={(e) =>
            e.target.value === SAME_VALUE
              ? onChange({ from: null, value: "" })
              : onChange({ from: e.target.value || null, value: null })
          }
          aria-label={`Column for ${column.label}`}
          className={`w-full rounded-xl border bg-surface px-3 py-2 text-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${
            column.required && !filled ? "border-amber-300" : "border-line-strong"
          }`}
        >
          <option value="">Leave empty</option>
          {sourceColumns.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value={SAME_VALUE}>Same value for every row...</option>
        </select>
        {choice === SAME_VALUE &&
          (column.choices.length > 0 ? (
            <select
              value={mapping?.value ?? ""}
              onChange={(e) => onChange({ value: e.target.value })}
              aria-label={`Value for ${column.label}`}
              className="w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">Choose...</option>
              {column.choices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={mapping?.value ?? ""}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder="The value for every row"
              aria-label={`Value for ${column.label}`}
              className="w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          ))}
        {link && mapping?.from && (link.match_options?.length ?? 0) > 1 && (
          <label className="flex items-center gap-2 text-xs text-muted">
            Find the {link.table.toLowerCase()} by its
            <select
              value={mapping.match ?? link.column}
              onChange={(e) => onChange({ match: e.target.value === link.column ? null : e.target.value })}
              className="rounded-lg border border-line-strong bg-surface px-2 py-1 text-xs text-ink"
            >
              {link.match_options!.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        )}
        {sample.length > 0 && (
          <p className="truncate text-xs text-faint" title={sample.join(", ")}>
            e.g. {sample.map((v) => String(v)).join(" · ")}
          </p>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ 3. check */

function CheckStep({ check, plan, provider }: { check: ImportCheck; plan: ImportPlan; provider: string | null }) {
  const label = (name: string) => plan.columns.find((c) => c.name === name)?.label ?? name;
  const skipped = check.invalid + check.duplicates_file + check.duplicates_db;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat tone="good" value={check.ready} label="new rows to add" />
        <Stat tone={check.invalid ? "warn" : "quiet"} value={check.invalid} label="rows with problems, skipped" />
        <Stat
          tone="quiet"
          value={check.duplicates_file + check.duplicates_db}
          label={check.duplicates_db ? "already in your database, skipped" : "repeated rows, skipped"}
        />
      </div>

      {check.problems.length > 0 && (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-950">
            <Warning size={16} weight="fill" className="text-amber-500" />
            What to fix in your data (or skip)
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-950">
            {check.problems.map((p) => (
              <li key={`${p.column}-${p.reason}`} className="leading-relaxed">
                <span className="font-semibold">{p.label}</span> {p.reason}:{" "}
                {p.count.toLocaleString()} row{p.count === 1 ? "" : "s"}
                <span className="text-amber-900/70">
                  {" "}
                  (row{p.rows.length === 1 ? "" : "s"} {p.rows.join(", ")}
                  {p.count > p.rows.length ? ", ..." : ""})
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-900/70">
            Row numbers are as in your file. Fix them there and import again later: rows already added are skipped then.
          </p>
        </section>
      )}

      {check.sample.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
            The first {check.sample.length} rows, as they will be saved
          </h3>
          <div className="overflow-x-auto rounded-xl ring-1 ring-line">
            <table className="w-max min-w-full text-[13px]">
              <thead className="bg-surface-2">
                <tr>
                  {check.columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted">
                      {label(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {check.sample.map((row, i) => (
                  <tr key={i} className="border-t border-line">
                    {check.columns.map((c) => (
                      <td key={c} className="max-w-[14rem] truncate whitespace-nowrap px-3 py-1.5">
                        {row[c] === null || row[c] === "" ? <span className="text-line-strong">&ndash;</span> : String(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed text-muted">
        <Database size={16} className="mt-0.5 shrink-0 text-accent" />
        <span>
          {check.ready > 0
            ? `${check.ready.toLocaleString()} rows go into your ${providerName(provider)} database, the one your website uses. `
            : "There is nothing new to add. "}
          {skipped > 0 && `${skipped.toLocaleString()} are skipped. `}
          They are added all in one go: if anything goes wrong, nothing is added.
        </span>
      </p>
    </div>
  );
}

function Stat({ tone, value, label }: { tone: "good" | "warn" | "quiet"; value: number; label: string }) {
  const style =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50/70 text-amber-950"
        : "border-line bg-surface-2/60 text-muted";
  return (
    <div className={`rounded-2xl border px-4 py-3 motion-safe:animate-[rise-in_260ms_ease-out] ${style}`}>
      <p className="font-display text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ 4. result */

function ResultStep({ job, table }: { job: ImportJob; table: string }) {
  const percent = job.total ? Math.round((job.added / job.total) * 100) : 0;
  if (job.status === "running") {
    return (
      <div className="py-8 text-center">
        <CircleNotch size={32} className="mx-auto animate-spin text-accent" />
        <p className="mt-3 font-semibold">Adding rows to {table}...</p>
        <div className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-sm tabular-nums text-muted">
          {job.added.toLocaleString()} of {job.total.toLocaleString()}
        </p>
      </div>
    );
  }
  if (job.status === "failed") {
    return (
      <div className="rounded-2xl bg-danger-soft px-5 py-6 text-center text-danger motion-safe:animate-[rise-in_220ms_ease-out]">
        <Warning size={30} weight="fill" className="mx-auto" />
        <p className="mt-2 font-semibold">Nothing was added</p>
        <p className="mt-1 text-sm">{job.error}</p>
      </div>
    );
  }
  return (
    <div className="py-6 text-center motion-safe:animate-[rise-in_260ms_ease-out]">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle size={32} weight="fill" />
      </span>
      <p className="mt-3 font-display text-xl font-bold">
        Added {job.added.toLocaleString()} row{job.added === 1 ? "" : "s"} to {table}
      </p>
      <p className="mt-1 text-sm text-muted">
        {job.skipped > 0 ? `${job.skipped.toLocaleString()} were already there and skipped. ` : ""}
        They&apos;re in your database now, and your website shows them.
      </p>
    </div>
  );
}
