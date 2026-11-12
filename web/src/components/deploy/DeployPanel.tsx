"use client";

import {
  ArrowSquareOut,
  CheckCircle,
  Circle,
  CircleNotch,
  Globe,
  MinusCircle,
  MoonStars,
  PlayCircle,
  Power,
  RocketLaunch,
  WarningCircle,
  Wrench,
  XCircle,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AccountRows from "@/components/deploy/AccountRows";
import ApiServerCard from "@/components/deploy/ApiServerCard";
import ApprovalBar from "@/components/stage/ApprovalBar";
import { api, type DbConnection, type DeployArtifact, type DeployStep, type GitHubInfo, type VercelInfo } from "@/lib/api";

type Owner = { email: string; name: string; password: string };

export default function DeployPanel({
  projectId,
  artifact,
  github,
  vercel,
  database,
  suggestedName,
  approved,
  approvedAt,
  running,
  busy,
  onGitHubChange,
  onVercelChange,
  onDatabaseChange,
  onArtifactChange,
  onAskFix,
  onApprove,
  onReopen,
}: {
  projectId: string;
  artifact: DeployArtifact;
  github: GitHubInfo | null;
  vercel: VercelInfo | null;
  database: DbConnection | null;
  suggestedName: string;
  approved: boolean;
  approvedAt: string | null;
  /** Gagesite (the chat) is working. */
  running: boolean;
  busy: boolean;
  onGitHubChange: (github: GitHubInfo | null) => void;
  onVercelChange: (vercel: VercelInfo | null) => void;
  onDatabaseChange: (connection: DbConnection | null) => void;
  onArtifactChange: (artifact: DeployArtifact) => void;
  onAskFix: (message: string) => void;
  onApprove: () => void;
  onReopen: () => void;
}) {
  const deployment = artifact.deployment;
  const going = deployment.status === "running";
  const [owner, setOwner] = useState<Owner>({ email: "", name: "", password: "" });
  const [values, setValues] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsAccount = artifact.first_account && !deployment.first_account_email;
  // Gagesite makes the first login: the owner may change its email, nothing else is needed.
  const loginEmail = owner.email || artifact.first_login?.email || "";
  const ownerOk = !needsAccount || loginEmail.includes("@");
  // Only when something needs the owner: a required setting, a saved one, or one with a problem. All
  // optional and empty means nothing to do here (they stay in Keys & settings, to add any time).
  const showSettings = artifact.settings.some((s) => s.required || s.filled || s.problem);
  const settingsOk = artifact.settings.every(
    (s) => values[s.name]?.trim() || (!s.problem && (!s.required || s.filled)),
  );
  const checklist = [
    { key: "github", done: !!github },
    ...(artifact.has_database ? [{ key: "database", done: !!database }] : []),
    { key: "vercel", done: !!vercel },
    ...(needsAccount ? [{ key: "account", done: ownerOk }] : []),
    ...(showSettings ? [{ key: "settings", done: settingsOk }] : []),
  ];
  const allDone = checklist.every((c) => c.done);
  // Once online, only when there's something new to put there.
  const nothingNew = deployment.status === "live" && !deployment.changes_waiting;
  const canGo = allDone && artifact.status === "ready" && !going && !running && !approved && !nothingNew;

  async function goOnline() {
    setStarting(true);
    setError(null);
    try {
      const typed = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()));
      if (Object.keys(typed).length) onArtifactChange(await api.saveDeploySettings(projectId, typed));
      await api.goOnline(projectId, needsAccount ? { email: loginEmail, name: "", password: "" } : null);
      setOwner((o) => ({ ...o, password: "" }));
      setValues({});
      onArtifactChange(await api.getDeploy(projectId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const failedStep = deployment.steps.find((s) => s.status === "failed");
  const accounts = checklist.filter((c) => ["github", "database", "vercel"].includes(c.key));
  const accountTotal = accounts.length;
  const accountsDone = accounts.filter((c) => c.done).length;
  const others = checklist.filter((c) => !["github", "database", "vercel"].includes(c.key));
  const number = (key: string) => others.findIndex((c) => c.key === key) + 1;

  return (
    <section className="flex h-full min-h-0 w-full flex-col border-line bg-surface lg:border-l">
      <header className="px-6 pb-3 pt-5">
        <h2 className="font-display text-lg font-bold tracking-tight">Go online</h2>
      </header>
      <div className="@container min-h-0 flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto w-full max-w-2xl space-y-4 pt-2">
          {deployment.status === "live" && deployment.url && (
            <LiveCard projectId={projectId} artifact={artifact} canChange={!going && !running} onChange={onArtifactChange} />
          )}

          {(going || deployment.status === "failed") && (
            <section className="rounded-3xl border border-line bg-surface p-5">
              <h3 className="font-display text-[15px] font-bold tracking-tight">
                {going ? "Putting your website online..." : "Your website didn't go online"}
              </h3>
              <ol className="mt-3 space-y-2.5">
                {deployment.steps.map((step) => (
                  <StepRow key={step.key} step={step} />
                ))}
              </ol>
              {deployment.status === "failed" && (
                <div className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
                  <p>{deployment.error}</p>
                  <button
                    onClick={() =>
                      onAskFix(
                        `Going online failed at "${failedStep?.label ?? "a step"}": ${deployment.error ?? ""} Please find the cause and fix it.`,
                      )
                    }
                    disabled={running}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-surface px-3.5 py-2 font-semibold text-ink shadow-sm transition hover:bg-surface-2 disabled:opacity-50"
                  >
                    <Wrench size={15} weight="bold" />
                    {running ? "Gagesite is working on it..." : "Ask Gagesite to fix it"}
                  </button>
                </div>
              )}
            </section>
          )}

          <ApiServerCard projectId={projectId} running={running} onAskFix={onAskFix} />

          {!approved && (
            <>
              {artifact.status !== "ready" && (
                <p className="rounded-2xl bg-accent-soft/60 px-4 py-3 text-sm text-accent-ink">
                  {running
                    ? "Gagesite is getting your website ready to go online. Meanwhile, you can connect your accounts below."
                    : "Gagesite hasn't finished getting your website ready. Ask it to continue in the chat."}
                </p>
              )}

              <div>
                <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-muted">
                  Connect your accounts
                  <span className="font-normal text-faint">
                    {accountsDone}/{accountTotal}
                  </span>
                </h3>
                <AccountRows
                  projectId={projectId}
                  github={github}
                  database={database}
                  vercel={vercel}
                  needsDatabase={artifact.has_database}
                  suggestedName={suggestedName}
                  locked={going}
                  onGitHubChange={onGitHubChange}
                  onDatabaseChange={onDatabaseChange}
                  onVercelChange={onVercelChange}
                />
              </div>

              {needsAccount && (
                <Item
                  n={number("account")}
                  done={ownerOk}
                  title="Your login online"
                  subtitle="Gagesite creates it for you when the website goes online and shows it here, so you can sign in straight away."
                >
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Sign-in email</span>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setOwner({ ...owner, email: e.target.value })}
                      autoComplete="off"
                      className="w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                    />
                  </label>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    The same email as your test account in the preview. Change it to your own if you like. Gagesite
                    makes a strong password and shows it here once the website is online; you can change it later in
                    your website.
                  </p>
                </Item>
              )}
              {artifact.first_account && deployment.first_account_email && (
                <FirstLogin projectId={projectId} email={deployment.first_account_email} kept={!!artifact.first_login?.kept} />
              )}

              {showSettings && (
                <Item
                  n={number("settings")}
                  done={settingsOk}
                  title="Settings your website needs"
                  subtitle="Kept encrypted and given only to your website."
                  keepOpen
                >
                  <SettingsGroups
                    settings={artifact.settings}
                    values={values}
                    onChange={(name, v) => setValues({ ...values, [name]: v })}
                  />
                </Item>
              )}

              {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={goOnline}
                  disabled={!canGo || starting}
                  className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-[0_12px_32px_-12px_rgba(34,102,212,0.7)] transition hover:bg-accent-hover active:scale-[0.98] disabled:bg-line-strong disabled:shadow-none"
                >
                  {going || starting ? (
                    <CircleNotch size={18} className="animate-spin" />
                  ) : (
                    <RocketLaunch size={18} weight="bold" />
                  )}
                  {deployment.status === "live" ? "Put my changes online" : "Put my website online"}
                </button>
                {!allDone && <span className="text-sm text-muted">Complete the steps above first.</span>}
                {allDone && deployment.status === "live" && !going && (
                  <span className="text-sm text-muted">
                    {nothingNew
                      ? "Everything is online. Changes you make with Gagesite show up here."
                      : "You have changes that aren't online yet."}
                  </span>
                )}
              </div>

              {artifact.markdown && (
                <details className="rounded-2xl border border-line px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold">About going online</summary>
                  <div className="prose-doc mt-3 text-[14px]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.markdown}</ReactMarkdown>
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </div>
      <ApprovalBar
        approved={approved}
        approvedAt={approvedAt}
        ready={artifact.ready}
        openCount={0}
        running={running || going}
        busy={busy}
        approveLabel="Finish"
        approvedLabel={deployment.offline_at ? "Your website is offline" : "Your website is online"}
        readyHint={
          deployment.offline_at
            ? "Your website is offline. Press Finish when you're done, or put it back online first."
            : "Your website is online. Press Finish when you're happy with it."
        }
        draftHint="Put your website online first."
        onApprove={onApprove}
        onReopen={onReopen}
      />
    </section>
  );
}

function LiveCard({
  projectId,
  artifact,
  canChange,
  onChange,
}: {
  projectId: string;
  artifact: DeployArtifact;
  canChange: boolean;
  onChange: (artifact: DeployArtifact) => void;
}) {
  const d = artifact.deployment;
  const offline = !!d.offline_at;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(action: "offline" | "online") {
    setBusy(true);
    setError(null);
    try {
      onChange(await (action === "offline" ? api.takeOffline(projectId) : api.backOnline(projectId)));
      setConfirming(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const since = d.offline_at
    ? new Date(d.offline_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "";
  return (
    <section
      className={
        offline
          ? "rounded-3xl border border-line-strong bg-surface-2 p-5 transition-colors duration-300"
          : "rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 transition-colors duration-300"
      }
    >
      <p
        className={`flex items-center gap-2 font-display text-[17px] font-bold tracking-tight ${offline ? "text-ink" : "text-emerald-900"}`}
      >
        {offline ? <MoonStars size={20} weight="duotone" /> : <Globe size={20} weight="duotone" />}
        {offline ? "Your website is offline" : "Your website is online"}
      </p>
      {offline ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Since {since}. Visitors to <span className="break-all font-medium text-ink">{d.url}</span> see a &ldquo;paused&rdquo;
          page. Nothing is deleted: your website, its data and its address are kept, and it comes back exactly as it was.
        </p>
      ) : (
        <>
          <a
            href={d.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 break-all text-[15px] font-semibold text-accent-ink hover:underline"
          >
            {d.url} <ArrowSquareOut size={14} />
          </a>
          <p className="mt-2 text-sm leading-relaxed text-emerald-900/80">
            {d.first_account_email ? `Sign in with ${d.first_account_email}. ` : ""}
            To use your own address (like www.yourbakery.com), add it in Vercel under Settings, then Domains.
          </p>
        </>
      )}

      {confirming && !offline && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm">
          <p className="font-semibold">Take your website offline?</p>
          <p className="mt-1 leading-relaxed text-muted">
            Visitors see a &ldquo;paused&rdquo; page until you put it back online. Your website, its data, accounts and
            address are all kept.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => change("offline")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 font-semibold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? <CircleNotch size={15} className="animate-spin" /> : <Power size={15} weight="bold" />}
              Take it offline
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-xl border border-line-strong px-3.5 py-2 font-semibold transition hover:border-accent hover:text-accent-ink active:scale-[0.98]"
            >
              Keep it online
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {!confirming && (
        <div className="mt-4">
          {offline ? (
            <button
              onClick={() => change("online")}
              disabled={busy || !canChange}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:bg-line-strong"
            >
              {busy ? <CircleNotch size={16} className="animate-spin" /> : <PlayCircle size={16} weight="bold" />}
              Put it back online
            </button>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              disabled={!canChange}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white/70 px-3.5 py-2 text-sm font-semibold text-emerald-900 transition hover:border-ink hover:text-ink active:scale-[0.98] disabled:opacity-50"
            >
              <Power size={15} weight="bold" />
              Take offline
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function StepRow({ step }: { step: Pick<DeployStep, "label" | "status" | "detail"> }) {
  const icon =
    step.status === "done" ? (
      <CheckCircle size={18} weight="fill" className="text-emerald-500" />
    ) : step.status === "running" ? (
      <CircleNotch size={18} className="animate-spin text-accent" />
    ) : step.status === "failed" ? (
      <XCircle size={18} weight="fill" className="text-danger" />
    ) : step.status === "skipped" ? (
      <MinusCircle size={18} className="text-faint" />
    ) : (
      <Circle size={18} className="text-line-strong" />
    );
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-px shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className={`text-sm font-medium ${step.status === "pending" ? "text-faint" : ""}`}>{step.label}</p>
        {step.detail && step.status !== "failed" && <p className="truncate text-xs text-muted">{step.detail}</p>}
      </div>
    </li>
  );
}

function Item({
  n,
  done,
  title,
  subtitle,
  children,
  keepOpen = false,
}: {
  n: number;
  done: boolean;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  /** Stay open when done (a list the owner should see, not a finished form). */
  keepOpen?: boolean;
}) {
  const [open, setOpen] = useState(!done || keepOpen);
  useEffect(() => {
    if (!done) setOpen(true);
  }, [done]);
  return (
    <section className={`rounded-3xl border p-5 ${done ? "border-line bg-surface" : "border-accent/40 bg-accent-soft/30"}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 text-left">
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
            done ? "bg-emerald-500 text-white" : "bg-accent text-white"
          }`}
        >
          {done ? <CheckCircle size={16} weight="bold" /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block text-sm text-muted">{subtitle}</span>
        </span>
      </button>
      {open && <div className="mt-4 pl-10">{children}</div>}
    </section>
  );
}

/** The live site's first login, made by Gagesite: email, and the password on request, with copy. */
export function FirstLogin({
  projectId,
  email,
  kept,
  note = "Sign in with this on your website. You can change the password there, or add your staff.",
}: {
  projectId: string;
  email: string;
  kept: boolean;
  note?: string;
}) {
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function reveal() {
    try {
      setPassword((await api.getFirstLogin(projectId)).password);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* the text is on screen to copy by hand */
    }
  }
  const row = "flex flex-wrap items-center gap-x-3 gap-y-1 text-sm";
  const button = "rounded-lg px-2 py-1 text-xs font-medium text-accent transition hover:bg-accent-soft active:scale-[0.97]";
  return (
    <div className="rounded-2xl border border-line bg-surface-2 px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CheckCircle size={16} weight="fill" className="text-emerald-500" />
        Your login online
      </p>
      <div className="mt-2 space-y-1.5 pl-6">
        <div className={row}>
          <span className="w-20 text-muted">Email</span>
          <span className="font-medium">{email}</span>
          <button type="button" className={button} onClick={() => copy("email", email)}>
            {copied === "email" ? "Copied" : "Copy"}
          </button>
        </div>
        {kept ? (
          <div className={row}>
            <span className="w-20 text-muted">Password</span>
            <span className="font-mono font-medium">{password ?? "••••-••••-••••-••••"}</span>
            {password === null ? (
              <button type="button" className={button} onClick={reveal}>
                Show
              </button>
            ) : (
              <button type="button" className={button} onClick={() => copy("password", password)}>
                {copied === "password" ? "Copied" : "Copy"}
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted">You chose this password yourself, so Gagesite didn&apos;t keep it.</p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        <p className="pt-1 text-xs leading-relaxed text-muted">
          {note}
        </p>
      </div>
    </div>
  );
}

/** Addresses, model names and folders aren't secret: show what is typed. */
const PLAIN = /(URL|ADDRESS|MODEL|BUCKET|ZONE|DIR|NAME)$/;

/**
 * The website's settings as one plain list: every setting is a row you can see without opening
 * anything, with what it is, its status in words ("Saved", "Needs you", "Not set, uses the
 * default") and one button ("Change" / "Add"). Rows that need the owner come first and are open.
 */
function SettingsGroups({
  settings,
  values,
  onChange,
}: {
  settings: DeployArtifact["settings"];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}) {
  const needs = (s: DeployArtifact["settings"][number]) => !!s.problem || (s.required && !s.filled);
  const rank = (s: DeployArtifact["settings"][number]) => (needs(s) ? 0 : s.filled ? 1 : 2);
  const rows = [...settings].sort((a, b) => rank(a) - rank(b));
  const left = settings.filter((s) => needs(s) && !values[s.name]?.trim()).length;
  const saved = settings.filter((s) => s.filled && !s.problem).length;
  const empty = settings.filter((s) => !s.filled && !s.required).length;

  return (
    <div className="space-y-3">
      <p
        className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${
          left ? "bg-amber-50 text-ink dark:bg-amber-500/10" : "bg-surface-2 text-muted"
        }`}
      >
        {left ? (
          <WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-amber-500" />
        ) : (
          <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-emerald-500" />
        )}
        <span>
          {left ? (
            <>
              <strong>
                {left} {left === 1 ? "setting needs" : "settings need"} you.
              </strong>{" "}
              Fill in the {left === 1 ? "one" : "ones"} marked below, then press the button.
            </>
          ) : (
            <>
              <strong className="text-ink">Nothing to do here.</strong> {saved} saved
              {empty ? `, ${empty} left empty on purpose (the website uses its defaults)` : ""}.
            </>
          )}
        </span>
      </p>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {rows.map((s) => (
          <SettingRow key={s.name} setting={s} needsYou={needs(s)} value={values[s.name] ?? ""} onChange={onChange} />
        ))}
      </ul>
    </div>
  );
}

function SettingRow({
  setting,
  needsYou,
  value,
  onChange,
}: {
  setting: DeployArtifact["settings"][number];
  needsYou: boolean;
  value: string;
  onChange: (name: string, value: string) => void;
}) {
  const s = setting;
  const [open, setOpen] = useState(needsYou);
  const typed = !!value.trim();
  const status = typed
    ? { text: "Will be saved", tone: "text-accent-ink bg-accent-soft" }
    : s.problem
      ? { text: "Doesn't work", tone: "text-danger bg-danger-soft" }
      : needsYou
        ? { text: "Needs you", tone: "text-amber-800 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15" }
        : s.filled
          ? { text: "Saved", tone: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10" }
          : { text: "Not set: default used", tone: "text-muted bg-surface-2" };
  // "Already saved under Keys & settings" is what the status says; keep the useful part.
  const help = s.filled && !s.problem ? s.purpose : `${s.purpose} ${s.help}`.trim();

  return (
    <li className={needsYou && !typed ? "bg-amber-50/50 dark:bg-amber-500/5" : "bg-surface"}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {s.label}
            {!s.required && <span className="font-normal text-faint"> · optional</span>}
          </p>
          <code className="font-mono text-[11px] text-faint">{s.name}</code>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${status.tone}`}>
          {status.text === "Saved" && <CheckCircle size={12} weight="fill" />}
          {status.text}
        </span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-accent transition hover:bg-accent-soft active:scale-[0.97]"
        >
          {open ? "Close" : s.filled ? "Change" : "Add"}
        </button>
      </div>
      {open && (
        <div className="space-y-1.5 px-4 pb-4 [animation:rise-in_160ms_ease-out]">
          {s.problem && !typed && (
            <p className="flex gap-1.5 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs leading-relaxed text-danger">
              <WarningCircle size={14} weight="bold" className="mt-px shrink-0" />
              <span>The saved value doesn&apos;t work: {s.problem}</span>
            </p>
          )}
          <input
            type={PLAIN.test(s.name) ? "text" : "password"}
            value={value}
            placeholder={
              s.problem
                ? "Paste the right value here"
                : s.filled
                  ? "Type a new value to replace the saved one"
                  : PLAIN.test(s.name)
                    ? "Leave empty to use the default"
                    : "Paste it here"
            }
            aria-label={s.label}
            onChange={(e) => onChange(s.name, e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
          {help && <p className="text-xs leading-relaxed text-muted">{help}</p>}
        </div>
      )}
    </li>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className="w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft"
      />
    </label>
  );
}
