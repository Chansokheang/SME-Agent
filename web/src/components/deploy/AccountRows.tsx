"use client";

import { ArrowSquareOut, CheckCircle, CircleNotch, Database, GithubLogo, LockSimple } from "@phosphor-icons/react";
import { useState } from "react";
import { api, type DbConnection, type DbProvider, type GitHubInfo, type VercelInfo } from "@/lib/api";

/* Brand marks, drawn small and flat so the three services are easy to tell apart. */

function VercelMark({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M12 2.5 23 21.5H1z" />
    </svg>
  );
}

function SupabaseMark({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        fill="#3ECF8E"
        d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z"
      />
    </svg>
  );
}

function NeonMark({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#00E599" />
      <path d="M7.5 17V7h1.6l5.4 6.9V7h1.9v10h-1.5L9.4 10v7z" fill="#0b1a14" />
    </svg>
  );
}

const DB_SERVICES: { key: DbProvider; name: string; mark: React.ReactNode; link?: string; hint: string; placeholder: string }[] = [
  {
    key: "supabase",
    name: "Supabase",
    mark: <SupabaseMark size={16} />,
    link: "https://supabase.com/dashboard",
    hint: "Create a free project, press Connect, choose Session pooler and copy the address. Put your database password in it.",
    placeholder: "postgresql://postgres.xxxx:password@aws-0-....pooler.supabase.com:5432/postgres",
  },
  {
    key: "neon",
    name: "Neon",
    mark: <NeonMark size={16} />,
    link: "https://console.neon.tech",
    hint: "Create a project, press Connect and copy the address.",
    placeholder: "postgresql://user:password@ep-....neon.tech/neondb?sslmode=require",
  },
  {
    key: "postgres",
    name: "My own",
    mark: <Database size={16} weight="duotone" className="text-accent" />,
    hint: "Paste the address of a PostgreSQL database whose user can create tables.",
    placeholder: "postgresql://user:password@your-server:5432/your_database",
  },
];

/** The three accounts the website goes online with, one simple row each. */
export default function AccountRows({
  projectId,
  github,
  database,
  vercel,
  needsDatabase,
  suggestedName,
  locked,
  onGitHubChange,
  onDatabaseChange,
  onVercelChange,
}: {
  projectId: string;
  github: GitHubInfo | null;
  database: DbConnection | null;
  vercel: VercelInfo | null;
  needsDatabase: boolean;
  suggestedName: string;
  /** True while the website is going online: accounts can't change mid-way. */
  locked: boolean;
  onGitHubChange: (github: GitHubInfo | null) => void;
  onDatabaseChange: (database: DbConnection | null) => void;
  onVercelChange: (vercel: VercelInfo | null) => void;
}) {
  const [open, setOpen] = useState<"github" | "database" | "vercel" | null>(null);
  const toggle = (key: typeof open) => setOpen(open === key ? null : key);
  const dbService = DB_SERVICES.find((s) => s.key === database?.provider);

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface">
      <Row
        logo={
          <span className="grid size-10 place-items-center rounded-xl bg-[#181717] text-white">
            <GithubLogo size={22} weight="fill" />
          </span>
        }
        name="GitHub"
        purpose="Keeps your website's code"
        connected={github ? { label: github.repo, href: github.url } : null}
        open={open === "github"}
        locked={locked}
        onToggle={() => toggle("github")}
        onDisconnect={async () => {
          await api.disconnectGitHub(projectId);
          onGitHubChange(null);
        }}
      >
        <GitHubForm
          projectId={projectId}
          suggestedName={suggestedName}
          onDone={(g) => {
            onGitHubChange(g);
            setOpen(null);
          }}
        />
      </Row>

      {needsDatabase && (
        <Row
          logo={
            <span className="grid size-10 place-items-center rounded-xl bg-[#1c1c1c]">
              {dbService?.key === "neon" ? (
                <NeonMark size={22} />
              ) : dbService?.key === "postgres" ? (
                <Database size={22} weight="duotone" className="text-white" />
              ) : (
                <SupabaseMark size={22} />
              )}
            </span>
          }
          name={dbService && dbService.key !== "postgres" ? dbService.name : "Database"}
          purpose="Keeps your orders, accounts and content"
          connected={database ? { label: database.host } : null}
          open={open === "database"}
          locked={locked}
          confirmDisconnect
          onToggle={() => toggle("database")}
          onDisconnect={async () => {
            await api.deleteConnection(projectId);
            onDatabaseChange(null);
          }}
        >
          <DatabaseForm
            projectId={projectId}
            onDone={(d) => {
              onDatabaseChange(d);
              setOpen(null);
            }}
          />
        </Row>
      )}

      <Row
        logo={
          <span className="grid size-10 place-items-center rounded-xl bg-black text-white">
            <VercelMark size={18} />
          </span>
        }
        name="Vercel"
        purpose="Runs your website online"
        connected={vercel ? { label: vercel.username } : null}
        open={open === "vercel"}
        locked={locked}
        onToggle={() => toggle("vercel")}
        onDisconnect={async () => {
          await api.disconnectVercel(projectId);
          onVercelChange(null);
        }}
      >
        <VercelForm
          projectId={projectId}
          onDone={(v) => {
            onVercelChange(v);
            setOpen(null);
          }}
        />
      </Row>

      <p className="flex items-center gap-1.5 bg-surface-2/60 px-5 py-2.5 text-xs text-faint">
        <LockSimple size={13} className="shrink-0" />
        All three are your own free accounts. Keys are stored encrypted.
      </p>
    </section>
  );
}

function Row({
  logo,
  name,
  purpose,
  connected,
  open,
  locked,
  confirmDisconnect = false,
  onToggle,
  onDisconnect,
  children,
}: {
  logo: React.ReactNode;
  name: string;
  purpose: string;
  connected: { label: string; href?: string } | null;
  open: boolean;
  locked: boolean;
  confirmDisconnect?: boolean;
  onToggle: () => void;
  onDisconnect: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function disconnect() {
    setBusy(true);
    try {
      await onDisconnect();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="border-b border-line">
      <div className="flex items-center gap-3.5 px-5 py-4">
        <span className="shrink-0">{logo}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold">
            {name}
            {connected && <CheckCircle size={16} weight="fill" className="text-emerald-500" />}
          </p>
          {connected ? (
            connected.href ? (
              <a
                href={connected.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1 truncate text-sm text-accent-ink hover:underline"
              >
                {connected.label} <ArrowSquareOut size={11} className="shrink-0" />
              </a>
            ) : (
              <p className="truncate text-sm text-muted">{connected.label}</p>
            )
          ) : (
            <p className="text-sm text-muted">{purpose}</p>
          )}
        </div>
        {connected ? (
          confirming ? (
            <span className="flex shrink-0 items-center gap-1 text-sm">
              <button
                onClick={disconnect}
                disabled={busy}
                className="rounded-lg bg-danger px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                Disconnect
              </button>
              <button onClick={() => setConfirming(false)} className="px-2 py-1 text-xs text-muted hover:text-ink">
                Keep
              </button>
            </span>
          ) : (
            <button
              onClick={() => (confirmDisconnect ? setConfirming(true) : disconnect())}
              disabled={busy || locked}
              className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-faint transition hover:bg-danger-soft hover:text-danger disabled:opacity-40"
            >
              Disconnect
            </button>
          )
        ) : (
          <button
            onClick={onToggle}
            disabled={locked}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40 ${
              open ? "bg-surface-2 text-muted hover:text-ink" : "bg-accent text-white hover:bg-accent-hover"
            }`}
          >
            {open ? "Close" : "Connect"}
          </button>
        )}
      </div>
      {open && !connected && <div className="px-5 pb-5 sm:pl-[4.6rem]">{children}</div>}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-line-strong bg-surface px-3 py-2 font-mono text-xs outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft";

function Hint({ href, label, children }: { href?: string; label?: string; children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-muted">
      {children}{" "}
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-ink hover:underline">
          {label} <ArrowSquareOut size={11} className="inline" />
        </a>
      )}
    </p>
  );
}

function Submit({ busy, disabled, label }: { busy: boolean; disabled: boolean; label: string }) {
  return (
    <button
      disabled={busy || disabled}
      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/85 active:scale-[0.98] disabled:bg-line-strong"
    >
      {busy && <CircleNotch size={15} className="animate-spin" />}
      {busy ? "Checking..." : label}
    </button>
  );
}

function Failure({ text }: { text: string | null }) {
  return text ? <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{text}</p> : null;
}

function GitHubForm({
  projectId,
  suggestedName,
  onDone,
}: {
  projectId: string;
  suggestedName: string;
  onDone: (github: GitHubInfo) => void;
}) {
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-2.5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          onDone(await api.connectGitHub(projectId, repo.trim(), token.trim()));
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Hint href="https://github.com/settings/personal-access-tokens/new" label="Create a GitHub token">
        Name it Gagesite and allow Contents and Administration: Read and write.
      </Hint>
      <input
        value={repo}
        onChange={(e) => setRepo(e.target.value)}
        placeholder={`your-github-name/${suggestedName || "my-website"}`}
        aria-label="GitHub folder for your code"
        spellCheck={false}
        autoComplete="off"
        className={inputClass}
      />
      <div className="flex gap-2">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="github_pat_..."
          aria-label="GitHub token"
          spellCheck={false}
          autoComplete="off"
          className={inputClass}
        />
        <Submit busy={busy} disabled={!repo.trim() || !token.trim()} label="Connect" />
      </div>
      <p className="text-xs text-faint">A new private folder is created if it doesn&apos;t exist yet.</p>
      <Failure text={error} />
    </form>
  );
}

function DatabaseForm({ projectId, onDone }: { projectId: string; onDone: (database: DbConnection) => void }) {
  const [provider, setProvider] = useState<DbProvider>("supabase");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const service = DB_SERVICES.find((s) => s.key === provider)!;

  return (
    <form
      className="space-y-2.5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          // Test first, then save: only a working database is kept.
          const test = await api.testConnection(projectId, provider, url.trim());
          if (!test.ok) setError([test.error, test.hint].filter(Boolean).join(" "));
          else if (test.can_create === false) setError("This database user can't create tables. Use the main database user.");
          else onDone(await api.saveConnection(projectId, provider, url.trim()));
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Database service">
        {DB_SERVICES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="radio"
            aria-checked={s.key === provider}
            onClick={() => {
              setProvider(s.key);
              setError(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              s.key === provider ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-muted hover:border-line-strong"
            }`}
          >
            {s.mark}
            {s.name}
          </button>
        ))}
      </div>
      <Hint href={service.link} label={`Open ${service.name}`}>
        {service.hint}
      </Hint>
      <div className="flex gap-2">
        <input
          type="password"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={service.placeholder}
          aria-label="Database address"
          spellCheck={false}
          autoComplete="off"
          className={inputClass}
        />
        <Submit busy={busy} disabled={!url.trim()} label="Connect" />
      </div>
      <Failure text={error} />
    </form>
  );
}

function VercelForm({ projectId, onDone }: { projectId: string; onDone: (vercel: VercelInfo) => void }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-2.5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          onDone(await api.connectVercel(projectId, token.trim()));
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Hint href="https://vercel.com/account/settings/tokens" label="Create a Vercel token">
        No account yet?{" "}
        <a href="https://vercel.com/signup" target="_blank" rel="noopener noreferrer" className="font-medium text-accent-ink hover:underline">
          Sign up free
        </a>
        . Then name a token Gagesite.
      </Hint>
      <div className="flex gap-2">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Vercel token"
          aria-label="Vercel token"
          spellCheck={false}
          autoComplete="off"
          className={inputClass}
        />
        <Submit busy={busy} disabled={!token.trim()} label="Connect" />
      </div>
      <Failure text={error} />
    </form>
  );
}
