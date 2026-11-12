"use client";

import {
  ArrowSquareOut,
  ArrowsClockwise,
  CheckCircle,
  CircleNotch,
  Database,
  Eye,
  EyeSlash,
  Lightning,
  LockSimple,
  Plugs,
  ShieldCheck,
  WarningCircle,
  type Icon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import CreateTables from "@/components/database/CreateTables";
import { api, type ConnectionTest, type DbConnection, type DbProvider } from "@/lib/api";

const PROVIDERS: {
  key: DbProvider;
  icon: Icon;
  title: string;
  text: string;
  link?: { href: string; label: string };
  steps: string[];
  placeholder: string;
}[] = [
  {
    key: "supabase",
    icon: Lightning,
    title: "Supabase",
    text: "Free to start, easy dashboard. Recommended.",
    link: { href: "https://supabase.com/dashboard", label: "Open Supabase" },
    steps: [
      "Create a free project. Write down the database password you choose.",
      "In the project, click Connect at the top of the page.",
      "Pick Session pooler and copy the URI.",
      "Paste it below and replace [YOUR-PASSWORD] with your database password.",
    ],
    placeholder: "postgresql://postgres.abcdefgh:your-password@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres",
  },
  {
    key: "neon",
    icon: Database,
    title: "Neon",
    text: "Serverless PostgreSQL with a free plan.",
    link: { href: "https://console.neon.tech", label: "Open Neon" },
    steps: ["Create a project.", "On the dashboard, click Connect and copy the connection string.", "Paste it below."],
    placeholder: "postgresql://user:password@ep-example-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
  },
  {
    key: "postgres",
    icon: Plugs,
    title: "My own PostgreSQL",
    text: "Any PostgreSQL server you already run.",
    steps: [
      "Use a database user that can create tables.",
      "Make sure the server accepts connections from outside.",
      "Paste the connection string below.",
    ],
    placeholder: "postgresql://user:password@your-server.example.com:5432/your_database",
  },
];

/** Final step of Stage 2: connect the database the finished website will use. */
export default function ConnectView({
  projectId,
  approved,
  connection,
  onChange,
}: {
  projectId: string;
  approved: boolean;
  connection: DbConnection | null;
  onChange: (connection: DbConnection | null) => void;
}) {
  const [replacing, setReplacing] = useState(false);

  if (!approved) {
    return (
      <div className="grid place-items-center py-16 text-center">
        <div className="max-w-sm">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-faint">
            <LockSimple size={26} />
          </span>
          <p className="mt-4 font-display text-lg font-bold">Approve the design first</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Once the design is approved, you choose where your website will keep its data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h3 className="font-display text-2xl font-bold tracking-tight">Where will your website&apos;s data live?</h3>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted">
          Bookings, menus and customer details are stored in a database you own. We don&apos;t keep your website&apos;s data on
          our platform, so you stay in control even if you leave.
        </p>
      </header>

      {connection && !replacing ? (
        <>
          <ConnectedCard projectId={projectId} connection={connection} onReplace={() => setReplacing(true)} onChange={onChange} />
          <CreateTables
            key={connection.tested_at}
            projectId={projectId}
            onCreated={() => api.getConnection(projectId).then(onChange)}
          />
        </>
      ) : (
        <ConnectForm
          projectId={projectId}
          canCancel={Boolean(connection)}
          onCancel={() => setReplacing(false)}
          onSaved={(saved) => {
            setReplacing(false);
            onChange(saved);
          }}
        />
      )}

      <p className="flex items-start gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-xs leading-relaxed text-muted">
        <ShieldCheck size={16} className="mt-px shrink-0 text-accent" />
        The connection string is stored encrypted and is never shown to Gagesite, written into your project files or displayed
        again. It is only used to set up your tables and import your data when the site goes live.
      </p>
    </div>
  );
}

export function ConnectForm({
  projectId,
  canCancel,
  onCancel,
  onSaved,
}: {
  projectId: string;
  canCancel: boolean;
  onCancel: () => void;
  onSaved: (connection: DbConnection) => void;
}) {
  const [provider, setProvider] = useState<DbProvider>("supabase");
  const [url, setUrl] = useState("");
  const [visible, setVisible] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ConnectionTest | null>(null);
  // Saving needs a successful test of exactly this string.
  const [testedUrl, setTestedUrl] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const guide = PROVIDERS.find((p) => p.key === provider)!;
  const testedOk = result?.ok && testedUrl === url.trim();

  async function test() {
    setTesting(true);
    setSaveError(null);
    try {
      const outcome = await api.testConnection(projectId, provider, url);
      setResult(outcome);
      setTestedUrl(url.trim());
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message } as ConnectionTest);
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      onSaved(await api.saveConnection(projectId, provider, url));
      setUrl("");
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2" role="radiogroup" aria-label="Database service">
        {PROVIDERS.map((p) => {
          const selected = p.key === provider;
          return (
            <button
              key={p.key}
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setProvider(p.key);
                setResult(null);
              }}
              className={`group flex items-center gap-4 rounded-2xl border p-3.5 text-left transition duration-300 hover:-translate-y-0.5 ${
                selected ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl transition-transform duration-500 group-hover:scale-105 ${
                  selected ? "bg-accent text-white" : "bg-surface-2 text-accent"
                }`}
              >
                <p.icon size={20} weight="duotone" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={`font-semibold ${selected ? "text-accent-ink" : ""}`}>{p.title}</span>
                  {p.key === "supabase" && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">Recommended</span>
                  )}
                </span>
                <span className="block text-sm text-muted">{p.text}</span>
              </span>
              <span
                aria-hidden
                className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-accent" : "border-line-strong"}`}
              >
                {selected && <span className="size-2.5 rounded-full bg-accent" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-line p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">How to get your connection string</p>
          {guide.link && (
            <a
              href={guide.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
            >
              {guide.link.label}
              <ArrowSquareOut size={14} />
            </a>
          )}
        </div>
        <ol className="mt-3 space-y-2">
          {guide.steps.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm leading-relaxed text-muted">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <label htmlFor="connection-string" className="mt-5 block text-sm font-medium">
          Connection string
        </label>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
          <input
            id="connection-string"
            type={visible ? "text" : "password"}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={guide.placeholder}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-3 font-mono text-xs outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide connection string" : "Show connection string"}
            className="text-faint transition hover:text-ink"
          >
            {visible ? <EyeSlash size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="mt-2 text-xs text-faint">Starts with postgresql://. Your password is part of it.</p>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              className={`mt-4 flex gap-2.5 rounded-xl px-4 py-3 text-sm ${
                result.ok ? "bg-accent-soft text-accent-ink" : "bg-danger-soft text-danger"
              }`}
            >
              {result.ok ? (
                <CheckCircle size={18} weight="fill" className="mt-px shrink-0" />
              ) : (
                <WarningCircle size={18} weight="fill" className="mt-px shrink-0" />
              )}
              <div className="space-y-0.5">
                {result.ok ? (
                  <>
                    <p className="font-medium">Connected to {result.host}</p>
                    <p className="text-xs opacity-80">
                      PostgreSQL {result.server_version}.{" "}
                      {result.table_count
                        ? `It already has ${result.table_count} table${result.table_count === 1 ? "" : "s"}; your website's tables will be added next to them.`
                        : "The database is empty and ready."}
                    </p>
                    {result.can_create === false && (
                      <p className="text-xs text-danger">This user can&apos;t create tables. Use the main database user.</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-medium">{result.error}</p>
                    {result.hint && <p className="text-xs opacity-80">{result.hint}</p>}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {saveError && <p className="mt-3 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">{saveError}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {canCancel && (
            <button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted hover:text-ink">
              Cancel
            </button>
          )}
          <button
            onClick={test}
            disabled={!url.trim() || testing}
            className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium transition hover:border-accent hover:text-accent-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testing && <CircleNotch size={16} className="animate-spin" />}
            {testing ? "Testing..." : "Test connection"}
          </button>
          <button
            onClick={save}
            disabled={!testedOk || result?.can_create === false || saving}
            title={testedOk ? "" : "Test the connection first"}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-line-strong"
          >
            {saving && <CircleNotch size={16} className="animate-spin" />}
            Save connection
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConnectedCard({
  projectId,
  connection,
  onReplace,
  onChange,
}: {
  projectId: string;
  connection: DbConnection;
  onReplace: () => void;
  onChange: (connection: DbConnection | null) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ConnectionTest | null>(null);
  const [confirming, setConfirming] = useState(false);
  const provider = PROVIDERS.find((p) => p.key === connection.provider)!;

  async function retest() {
    setChecking(true);
    try {
      const outcome = await api.retestConnection(projectId);
      setResult(outcome);
      if (outcome.ok) onChange(await api.getConnection(projectId));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-accent/40 bg-gradient-to-br from-accent-soft via-surface-2 to-surface">
      <div className="flex items-start gap-4 p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-white shadow-[0_8px_24px_-10px_rgba(34,102,212,0.7)]">
          <provider.icon size={24} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold text-accent-ink">
            <CheckCircle size={18} weight="fill" className="text-accent" />
            Connected to {provider.title}
          </p>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">Server</dt>
            <dd className="truncate font-mono text-xs leading-5">{connection.host}</dd>
            <dt className="text-muted">Database</dt>
            <dd className="truncate font-mono text-xs leading-5">{connection.database}</dd>
            <dt className="text-muted">Checked</dt>
            <dd className="text-xs leading-5 text-muted">
              {new Date(connection.tested_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}, PostgreSQL{" "}
              {connection.server_version}
            </dd>
          </dl>
        </div>
      </div>

      {result && !result.ok && (
        <p className="mx-5 mb-3 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {result.error} {result.hint}
        </p>
      )}
      {result?.ok && <p className="mx-5 mb-3 text-sm text-accent-ink">Still connected.</p>}

      <div className="flex flex-wrap items-center gap-2 border-t border-accent/20 bg-surface/60 px-5 py-3">
        <button
          onClick={retest}
          disabled={checking}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-accent-ink transition hover:bg-accent-soft disabled:opacity-50"
        >
          {checking ? <CircleNotch size={15} className="animate-spin" /> : <ArrowsClockwise size={15} />}
          Test again
        </button>
        <button
          onClick={onReplace}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          Use a different database
        </button>
        <span className="flex-1" />
        {confirming ? (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-muted">Disconnect?</span>
            <button
              onClick={async () => {
                await api.deleteConnection(projectId);
                onChange(null);
              }}
              className="rounded-lg bg-danger px-3 py-1.5 font-medium text-white"
            >
              Disconnect
            </button>
            <button onClick={() => setConfirming(false)} className="px-2 py-1.5 text-muted hover:text-ink">
              Keep
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-lg px-3 py-1.5 text-sm text-faint transition hover:text-danger"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
