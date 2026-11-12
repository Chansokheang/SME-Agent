"use client";

import {
  ArrowSquareOut,
  CaretDown,
  CircleNotch,
  Database,
  HardDrives,
  Power,
  RocketLaunch,
  Wrench,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { FirstLogin, StepRow } from "@/components/deploy/DeployPanel";
import { api, type ApiServerInfo } from "@/lib/api";

/** "UI + dedicated API": the API alone, in Docker on a server the owner controls, using the
 *  Stage 2 database. Once online, Gagesite's changes to the API go there by themselves. */
export default function ApiServerCard({
  projectId,
  running,
  onAskFix,
}: {
  projectId: string;
  /** Gagesite (the chat) is working. */
  running: boolean;
  onAskFix: (message: string) => void;
}) {
  const [info, setInfo] = useState<ApiServerInfo | null>(null);
  const [port, setPort] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null: decided by the state (folded once it's online and well, open otherwise); then the owner's choice.
  const [openChoice, setOpenChoice] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      setInfo(await api.getApiServer(projectId));
    } catch {
      /* the card stays as it was */
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);
  // Quick while it's going online; slow otherwise, to show an update Gagesite started by itself.
  const going = info?.status === "running";
  useEffect(() => {
    const timer = setInterval(load, going ? 2000 : 15000);
    return () => clearInterval(timer);
  }, [load, going]);
  useEffect(() => {
    if (info) setPort(String(info.port));
  }, [info?.port]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!info?.available) return null;

  const live = info.status === "live";
  const failed = info.status === "failed";
  const failedStep = info.steps.find((s) => s.status === "failed");
  const portNumber = Number(port);
  const portOk =
    Number.isInteger(portNumber) && portNumber >= 1024 && portNumber <= 65535;
  const serverReady = !!(
    info.server?.host &&
    info.server?.user &&
    info.server?.public_key
  );

  const smokeFailed = !!info.smoke && info.smoke.passed < info.smoke.total;
  // Always open while it's going online or something needs the owner.
  const open = going || failed || smokeFailed || (openChoice ?? !live);
  const summary = going
    ? "Going online..."
    : failed
      ? "Didn't go online"
      : live
        ? `Online${info.smoke ? ` · ${info.smoke.passed}/${info.smoke.total} checks passed` : ""}${
            info.out_of_date ? " · changes waiting" : ""
          }`
        : info.status === "stopped"
          ? "Stopped"
          : "Not online yet";

  async function act(work: () => Promise<ApiServerInfo>) {
    setBusy(true);
    setError(null);
    try {
      setInfo(await work());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function putOnline() {
    await act(async () => {
      if (info && portOk && portNumber !== info.port)
        await api.saveApiServer(projectId, { port: portNumber });
      return api.deployApiServer(projectId);
    });
  }

  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <button
        type="button"
        onClick={() => setOpenChoice(!open)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
          <HardDrives size={18} weight="bold" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] font-bold tracking-tight">
            Your API on your own server
          </span>
          <span className="block text-sm text-muted">
            {open
              ? "Only your API, running in Docker with the database you connected in Stage 2."
              : summary}
          </span>
        </span>
        <CaretDown
          size={16}
          weight="bold"
          className={`mt-1 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-4 space-y-3 pl-12">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
              Where
            </p>
            <div className="inline-flex rounded-xl bg-surface-2 p-1 text-sm">
              {(
                [
                  ["ssh", "Your server"],
                  ["this_pc", "This computer, to try it"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() =>
                    key !== info.target &&
                    act(() => api.saveApiServer(projectId, { target: key }))
                  }
                  disabled={busy || going || (live && key !== info.target)}
                  title={
                    live && key !== info.target
                      ? "Stop your API first, then move it"
                      : undefined
                  }
                  className={`rounded-lg px-3 py-1.5 transition disabled:cursor-not-allowed ${
                    info.target === key
                      ? "bg-surface font-semibold shadow-sm"
                      : "text-muted hover:text-ink disabled:opacity-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {info.target === "ssh" && (
            <ServerDetails
              projectId={projectId}
              info={info}
              locked={busy || going || live}
              onChange={setInfo}
            />
          )}

          <p className="flex items-center gap-2 text-sm">
            <Database size={16} className="shrink-0 text-muted" />
            {info.database ? (
              <span className="min-w-0 truncate">
                {info.database.database} on {info.database.host}
              </span>
            ) : (
              <span className="text-danger">
                Connect your database in Stage 2 first: your API keeps its data
                there.
              </span>
            )}
          </p>

          {!live && !going && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">
                {info.target === "ssh"
                  ? "Port on your server (not opened to the internet)"
                  : "Answers on port"}
              </span>
              <input
                value={port}
                onChange={(e) =>
                  setPort(e.target.value.replace(/\D/g, "").slice(0, 5))
                }
                inputMode="numeric"
                className={`w-20 rounded-lg border bg-surface px-2 py-1 text-sm outline-none transition focus:ring-4 focus:ring-accent-soft ${
                  portOk
                    ? "border-line-strong focus:border-accent"
                    : "border-danger"
                }`}
              />
            </label>
          )}

          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <span className="relative mt-0.5 inline-flex shrink-0">
              <input
                type="checkbox"
                role="switch"
                checked={info.auto_update}
                disabled={busy || going}
                onChange={(e) =>
                  act(() =>
                    api.saveApiServer(projectId, {
                      auto_update: e.target.checked,
                    }),
                  )
                }
                className="peer sr-only"
              />
              <span className="h-5 w-9 rounded-full bg-line-strong transition-colors duration-200 peer-checked:bg-accent peer-focus-visible:ring-4 peer-focus-visible:ring-accent-soft" />
              <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-4" />
            </span>
            <span>
              <span className="block font-medium">Update automatically</span>
              <span className="block text-muted">
                When Gagesite finishes a change to your API, the new version
                goes online by itself.
              </span>
            </span>
          </label>

          {live && info.url && (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              <p className="font-semibold">
                Online at{" "}
                {/* The API has nothing at its bare address (404): the link opens its docs. */}
                <a
                  href={info.docs_url ?? info.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {info.url.replace(/^https?:\/\//, "")}
                </a>
              </p>
              {info.docs_url && (
                <a
                  href={info.docs_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-medium underline underline-offset-2"
                >
                  Try it in the API docs <ArrowSquareOut size={13} />
                </a>
              )}
              {info.target === "ssh" && (
                <p className="mt-1 text-xs opacity-80">
                  {info.website_live
                    ? "Your website online uses this address. If it changes (when your server restarts), Gagesite updates your website."
                    : "When your website goes online, it uses this address instead of putting a copy of your API on Vercel."}
                </p>
              )}
              {info.reason === "change" && info.live_at && (
                <p className="mt-1 text-xs opacity-80">
                  Updated by itself after a change, {when(info.live_at)}.
                </p>
              )}
              {info.out_of_date && (
                <p className="mt-1 text-xs">
                  Gagesite changed your API since this version went online.
                  {info.auto_update
                    ? " It goes online when Gagesite finishes."
                    : " Press Update now to put it online."}
                </p>
              )}
            </div>
          )}
          {live && info.smoke && (
            <SmokeResult
              result={info.smoke}
              running={running}
              onAskFix={onAskFix}
            />
          )}
          {live && info.first_account_email && (
            <FirstLogin
              projectId={projectId}
              email={info.first_account_email}
              kept
              note="Sign in with this through your API (POST /api/v1/auth/login, or Authorize in the API docs). Your website uses the same login."
            />
          )}
          {!info.account_script && !going && (
            <div className="rounded-2xl border border-line px-4 py-3 text-sm">
              <p className="font-medium">No first login yet</p>
              <p className="mt-0.5 text-muted">
                Your database starts with no accounts, so nobody can sign in.
                Gagesite writes a small script that creates your first login;
                after that, it&apos;s made each time your API goes online, if
                it&apos;s missing.
              </p>
              <button
                onClick={() =>
                  onAskFix(
                    "Write service/scripts/production.py (or service/prisma/production.ts for a TypeScript API): it creates the owner's first account from OWNER_EMAIL, OWNER_NAME and OWNER_PASSWORD, only when it's missing, plus anything else the API needs to start with (for example the workspace). Follow the Stage 5 rules for the production script. Only write that script: don't change anything else, and don't run it against any database.",
                  )
                }
                disabled={running}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3.5 py-2 font-semibold text-ink transition hover:bg-line disabled:opacity-50"
              >
                <Wrench size={15} weight="bold" />
                {running
                  ? "Gagesite is working..."
                  : "Ask Gagesite to write it"}
              </button>
            </div>
          )}
          {info.status === "stopped" && (
            <p className="text-sm text-muted">
              Your API is stopped. Its data stays in your database.
            </p>
          )}

          {(going || failed) && (
            <div>
              <p className="mb-2 text-sm font-semibold">
                {going
                  ? info.reason === "change"
                    ? "Putting Gagesite's change online..."
                    : "Putting your API online..."
                  : "Your API didn't go online"}
              </p>
              <ol className="space-y-2.5">
                {info.steps.map((step) => (
                  <StepRow key={step.key} step={step} />
                ))}
              </ol>
            </div>
          )}
          {failed && info.error && (
            <div className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
              <p>{info.error}</p>
              {info.log && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold">
                    What it said
                  </summary>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-2 text-[11px] text-ink">
                    {info.log}
                  </pre>
                </details>
              )}
              <button
                onClick={() =>
                  onAskFix(
                    `Putting the API on my server failed at "${failedStep?.label ?? "a step"}": ${info.error ?? ""}${
                      info.log ? `\n\nIt said:\n${info.log.slice(-1500)}` : ""
                    }\n\nPlease find the cause and fix it.`,
                  )
                }
                disabled={running}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-surface px-3.5 py-2 font-semibold text-ink shadow-sm transition hover:bg-surface-2 disabled:opacity-50"
              >
                <Wrench size={15} weight="bold" />
                {running
                  ? "Gagesite is working on it..."
                  : "Ask Gagesite to fix it"}
              </button>
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={putOnline}
              disabled={
                busy ||
                going ||
                running ||
                !info.database ||
                !portOk ||
                (info.target === "ssh" && !serverReady)
              }
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:bg-line-strong"
            >
              {busy || going ? (
                <CircleNotch size={16} className="animate-spin" />
              ) : (
                <RocketLaunch size={16} weight="bold" />
              )}
              {live ? "Update now" : "Put my API online"}
            </button>
            {(live || failed) && (
              <button
                onClick={() => act(() => api.stopApiServer(projectId))}
                disabled={busy || going}
                className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-2 disabled:opacity-50"
              >
                <Power size={15} weight="bold" />
                Stop
              </button>
            )}
            {running && !going && (
              <span className="text-sm text-muted">
                Wait for Gagesite to finish first.
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** The read-only test of the live address after it went online: a line when all is well, the
 *  failed checks (and a fix request) when not. */
function SmokeResult({
  result,
  running,
  onAskFix,
}: {
  result: NonNullable<ApiServerInfo["smoke"]>;
  running: boolean;
  onAskFix: (message: string) => void;
}) {
  const failed = result.checks.filter((c) => !c.ok);
  const ok = failed.length === 0;
  return (
    <details
      open={!ok}
      className={`rounded-2xl px-4 py-3 text-sm ${ok ? "border border-line" : "bg-danger-soft text-danger"}`}
    >
      <summary className="cursor-pointer font-semibold">
        {ok
          ? `Tested after going online: all ${result.total} checks passed`
          : `Tested after going online: ${failed.length} of ${result.total} checks failed`}
        {!result.signed_in && (
          <span className="font-normal text-muted"> (without signing in)</span>
        )}
      </summary>
      <p className="mt-1.5 text-xs opacity-80">
        Only reads: signs in with your first login and opens each simple
        address. Nothing in your database is changed.
      </p>
      <ul className="mt-2 space-y-1 text-xs">
        {(ok ? result.checks : failed).map((c) => (
          <li key={c.name} className="flex gap-2">
            <span className={c.ok ? "text-emerald-600" : "text-danger"}>
              {c.ok ? "✓" : "✗"}
            </span>
            <span className="min-w-0 break-words">
              <span className="font-mono">{c.name}</span>
              {!c.ok && (
                <span className="text-ink/80">
                  {" "}
                  &middot; {c.status || "no answer"} {c.detail}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {!ok && (
        <button
          onClick={() =>
            onAskFix(
              `After my API went online on my server, these checks of its live address failed:\n${failed
                .map(
                  (c) => `- ${c.name}: ${c.status || "no answer"} ${c.detail}`,
                )
                .join(
                  "\n",
                )}\n\nPlease find the cause in the API's code and fix it.`,
            )
          }
          disabled={running}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-surface px-3.5 py-2 font-semibold text-ink shadow-sm transition hover:bg-surface-2 disabled:opacity-50"
        >
          <Wrench size={15} weight="bold" />
          {running ? "Gagesite is working on it..." : "Ask Gagesite to fix it"}
        </button>
      )}
    </details>
  );
}

/** Your own server: address, SSH port and user, and Gagesite's key to add there (never a password). */
function ServerDetails({
  projectId,
  info,
  locked,
  onChange,
}: {
  projectId: string;
  info: ApiServerInfo;
  locked: boolean;
  onChange: (info: ApiServerInfo) => void;
}) {
  const server = info.server;
  const [host, setHost] = useState(server?.host ?? "");
  const [sshPort, setSshPort] = useState(String(server?.ssh_port ?? 22));
  const [user, setUser] = useState(server?.user ?? "");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const changed =
    host.trim() !== (server?.host ?? "") ||
    Number(sshPort) !== (server?.ssh_port ?? 22) ||
    user.trim() !== (server?.user ?? "");

  async function save() {
    setSaving(true);
    setProblem(null);
    try {
      await api.saveApiServer(projectId, {
        ssh_host: host.trim(),
        ssh_port: Number(sshPort) || 22,
        ssh_user: user.trim(),
      });
      if (!server?.public_key) await api.apiServerKey(projectId);
      onChange(await api.getApiServer(projectId));
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const command = server?.public_key
    ? `mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '${server.public_key}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`
    : "";
  const field =
    "rounded-lg border border-line-strong bg-surface px-2 py-1 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft disabled:opacity-60";

  return (
    <div className="space-y-2.5 rounded-2xl bg-surface-2/60 p-3.5 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-36">
          <span className="mb-1 block text-xs text-muted">Server address</span>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            disabled={locked}
            placeholder="203.0.113.10"
            className={`w-full ${field}`}
          />
        </label>
        <label className="w-20">
          <span className="mb-1 block text-xs text-muted">SSH port</span>
          <input
            value={sshPort}
            onChange={(e) =>
              setSshPort(e.target.value.replace(/\D/g, "").slice(0, 5))
            }
            disabled={locked}
            inputMode="numeric"
            className={`w-full ${field}`}
          />
        </label>
        <label className="w-32">
          <span className="mb-1 block text-xs text-muted">User</span>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            disabled={locked}
            placeholder="ubuntu"
            className={`w-full ${field}`}
          />
        </label>
        {(changed || !server?.public_key) && (
          <button
            onClick={save}
            disabled={locked || saving || !host.trim() || !user.trim()}
            className="rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-surface transition hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        )}
      </div>
      {problem && <p className="text-xs text-danger">{problem}</p>}
      {server?.public_key && (
        <div>
          <p className="text-xs text-muted">
            Gagesite signs in with its own key, never a password.{" "}
            {server.connected ? (
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                Your server accepts it.
              </span>
            ) : (
              <>Once, sign in to your server as {server.user} and run:</>
            )}
          </p>
          {!server.connected && (
            <div className="mt-1.5 flex items-start gap-2">
              <code className="block max-h-20 min-w-0 flex-1 overflow-auto break-all rounded-lg bg-surface px-2 py-1.5 text-[11px] leading-snug">
                {command}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(command).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
                className="shrink-0 rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-semibold transition hover:bg-surface"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-muted">
        Your server needs Docker. Your API gets a free public HTTPS address
        through a Cloudflare tunnel, so no ports need opening. The address
        changes if your server restarts; Gagesite follows it.
      </p>
    </div>
  );
}

function when(iso: string): string {
  const date = new Date(
    iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z",
  );
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
