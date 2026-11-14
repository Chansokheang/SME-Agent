"use client";

import {
  ArrowClockwise,
  ArrowSquareOut,
  Browsers,
  CheckCircle,
  CircleNotch,
  Desktop,
  DeviceMobile,
  DeviceTablet,
  DownloadSimple,
  GithubLogo,
  Hammer,
  Play,
  Stop,
  Warning,
  WifiSlash,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GitHubConnect from "@/components/build/GitHubConnect";
import ApprovalBar from "@/components/stage/ApprovalBar";
import EmptyCard from "@/components/stage/EmptyCard";
import { api, type BuildArtifact, type BuildCheck, type BuildPage, type GitHubInfo, type PreviewInfo, previewAddress } from "@/lib/api";

type Tab = "preview" | "pages" | "summary" | "github";

const DEVICES = [
  { key: "desktop", icon: Desktop, label: "Desktop", width: "100%" },
  { key: "tablet", icon: DeviceTablet, label: "Tablet", width: "768px" },
  { key: "phone", icon: DeviceMobile, label: "Phone", width: "390px" },
] as const;

export default function BuildPanel({
  projectId,
  artifact,
  approved,
  approvedAt,
  running,
  busy,
  github,
  onGitHubChange,
  onApprove,
  onReopen,
}: {
  projectId: string;
  artifact: BuildArtifact | null;
  approved: boolean;
  approvedAt: string | null;
  running: boolean;
  busy: boolean;
  github: GitHubInfo | null;
  onGitHubChange: (github: GitHubInfo | null) => void;
  onApprove: () => void;
  onReopen: () => void;
}) {
  const [tab, setTab] = useState<Tab>("preview");
  const [preview, setPreview] = useState<PreviewInfo | null>(artifact?.preview ?? null);
  const [path, setPath] = useState("/");
  const [device, setDevice] = useState<(typeof DEVICES)[number]>(DEVICES[0]);
  const [frameKey, setFrameKey] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const pages = artifact?.pages ?? [];
  const done = pages.filter((p) => p.status === "done").length;

  const refreshPreview = useCallback(() => {
    api
      .getPreview(projectId)
      .then(setPreview)
      // Gagesite's server isn't answering: say so instead of showing a stale "Live".
      .catch(() => setPreview({ status: "offline", url: null, log: [] }));
  }, [projectId]);

  // Keep the status honest: follow it closely while it starts, and keep checking it runs.
  const waiting = preview?.status === "installing" || preview?.status === "building" || preview?.status === "starting";
  useEffect(() => {
    const timer = window.setInterval(refreshPreview, waiting ? 2000 : 8000);
    return () => window.clearInterval(timer);
  }, [waiting, refreshPreview]);
  useEffect(() => {
    if (artifact) setPreview(artifact.preview);
  }, [artifact]);

  const startPreview = useCallback(async () => {
    setPreviewError(null);
    try {
      setPreview(await api.startPreview(projectId));
    } catch (e) {
      setPreviewError((e as Error).message);
    }
  }, [projectId]);

  // Once packages are installed, keep a preview running while the owner is on this step.
  const canStart = !!artifact?.installed;
  useEffect(() => {
    if (canStart && preview?.status === "stopped") startPreview();
  }, [canStart, preview?.status, startPreview]);

  async function stopPreview() {
    setPreview(await api.stopPreview(projectId));
  }

  function open(page: BuildPage) {
    setPath(page.preview);
    setTab("preview");
    setFrameKey((n) => n + 1);
  }

  const tabs: {
    key: Tab;
    label: string;
    badge?: string;
    icon?: typeof GithubLogo;
  }[] = [
    { key: "preview", label: "Preview" },
    {
      key: "pages",
      label: "Pages",
      badge: pages.length ? `${done}/${pages.length}` : undefined,
    },
    { key: "summary", label: "Summary" },
    { key: "github", label: "GitHub", icon: GithubLogo },
  ];

  return (
    <section className="flex h-full min-h-0 w-full flex-col border-line bg-surface lg:border-l">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 pb-3 pt-5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-lg font-bold tracking-tight">Your website</h2>
          {running && <span className="text-xs text-accent-ink">building...</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex rounded-xl bg-surface-2 p-1" aria-label="Website views">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  tab === t.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {t.icon && <t.icon size={13} weight="fill" />}
                {t.label}
                {t.badge && (
                  <span className="rounded-full bg-accent-soft px-1.5 text-[10px] text-accent-ink">{t.badge}</span>
                )}
                {t.key === "github" && github && <span className="size-1.5 rounded-full bg-emerald-500" />}
              </button>
            ))}
          </nav>
          {/* Only once there is code to take away, and not halfway through a build. */}
          {artifact?.exists && !running && (
            <a
              href={api.downloadUrl(projectId)}
              title="Download the website's code and your plan as a zip file"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs font-semibold transition hover:border-accent hover:text-accent-ink active:scale-[0.98]"
            >
              <DownloadSimple size={13} weight="bold" />
              Download code
            </a>
          )}
        </div>
      </header>

      {!github && tab !== "github" && (
        <div className="mx-6 mb-3 flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-2 text-sm text-amber-950">
          <GithubLogo size={16} weight="fill" className="shrink-0" />
          <span className="min-w-0 flex-1">
            Your code isn&apos;t saved to GitHub yet. You&apos;ll need it to put the website online.
          </span>
          <button
            onClick={() => setTab("github")}
            className="shrink-0 font-semibold text-amber-900 underline-offset-2 hover:underline"
          >
            Connect
          </button>
        </div>
      )}

      <div className="@container flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6">
        {artifact === null ? (
          <div className="h-full min-h-[420px] animate-pulse rounded-3xl bg-surface-2" aria-label="Loading" />
        ) : tab === "preview" ? (
          <PreviewView
            artifact={artifact}
            preview={preview}
            path={path}
            device={device}
            frameKey={frameKey}
            error={previewError}
            running={running}
            onPath={(p) => {
              setPath(p);
              setFrameKey((n) => n + 1);
            }}
            onDevice={setDevice}
            onReload={() => setFrameKey((n) => n + 1)}
            onStart={startPreview}
            onStop={stopPreview}
          />
        ) : tab === "pages" ? (
          <PagesView projectId={projectId} pages={pages} check={artifact.check} running={running} onOpen={open} />
        ) : tab === "summary" ? (
          <SummaryView artifact={artifact} />
        ) : (
          <div className="mx-auto w-full max-w-2xl pt-2">
            <GitHubConnect projectId={projectId} github={github} onChange={onGitHubChange} canPush={!running} />
          </div>
        )}
      </div>

      <ApprovalBar
        approved={approved}
        approvedAt={approvedAt}
        ready={artifact?.ready ?? false}
        openCount={artifact?.open_questions.length ?? 0}
        running={running}
        busy={busy}
        approveLabel="Approve website"
        approvedLabel="Website approved"
        readyHint="Approving unlocks putting your website online."
        draftHint={
          pages.length
            ? `Gagesite is building your website (${done} of ${pages.length} pages done).`
            : "Gagesite lists every page first, then builds them one by one."
        }
        onApprove={onApprove}
        onReopen={onReopen}
      />
    </section>
  );
}

function PreviewView({
  artifact,
  preview,
  path,
  device,
  frameKey,
  error,
  running,
  onPath,
  onDevice,
  onReload,
  onStart,
  onStop,
}: {
  artifact: BuildArtifact;
  preview: PreviewInfo | null;
  path: string;
  device: (typeof DEVICES)[number];
  frameKey: number;
  error: string | null;
  running: boolean;
  onPath: (path: string) => void;
  onDevice: (device: (typeof DEVICES)[number]) => void;
  onReload: () => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const status = preview?.status ?? "stopped";
  const donePages = artifact.pages.filter((p) => p.status === "done");

  if (!artifact.installed) {
    return (
      <EmptyCard
        icon={Hammer}
        title={running ? "Gagesite is setting up your website..." : "Your website appears here"}
        text="Once the first pages are built, you can click through your real website here while Gagesite works on the rest."
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <select
            value={path}
            onChange={(e) => onPath(e.target.value)}
            aria-label="Page to show"
            className="max-w-[16rem] rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs font-medium outline-none focus:border-accent"
          >
            {!donePages.some((p) => p.preview === path) && <option value={path}>{path}</option>}
            {donePages.map((p) => (
              <option key={p.path} value={p.preview}>
                {p.name}
              </option>
            ))}
          </select>
          <span
            title={
              preview?.mode === "production"
                ? "The finished website, built exactly as it will be online."
                : "The website as Gagesite builds it: changes show at once."
            }
          >
            <StatusChip status={status} mode={preview?.mode} />
          </span>
        </div>
        <div className="flex items-center gap-1">
          {DEVICES.map((d) => (
            <button
              key={d.key}
              onClick={() => onDevice(d)}
              aria-label={d.label}
              aria-pressed={device.key === d.key}
              className={`grid size-8 place-items-center rounded-lg transition ${
                device.key === d.key ? "bg-accent-soft text-accent-ink" : "text-muted hover:bg-surface-2"
              }`}
            >
              <d.icon size={16} />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          {status === "running" ? (
            <>
              <button
                onClick={onReload}
                aria-label="Reload"
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2"
              >
                <ArrowClockwise size={16} />
              </button>
              <a
                href={preview?.url ? previewAddress(preview.url, path) : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in a new tab"
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2"
              >
                <ArrowSquareOut size={16} />
              </a>
              <button
                onClick={onStop}
                aria-label="Stop the preview"
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2"
              >
                <Stop size={16} />
              </button>
            </>
          ) : (
            status !== "installing" &&
            status !== "building" &&
            status !== "starting" && (
              <button
                onClick={onStart}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
              >
                <Play size={13} weight="fill" /> Start preview
              </button>
            )
          )}
        </div>
      </div>

      {/* "UI + dedicated API": the API answers on its own address too; its docs let the owner try each call. */}
      {status === "running" && preview?.api_url && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs">
          <span className="font-semibold text-ink">API</span>
          <a href={preview.api_url} target="_blank" rel="noopener noreferrer" className="font-mono text-muted hover:text-accent">
            {preview.api_url.replace(/^https?:\/\//, "")}/api/v1
          </a>
          <a
            href={`${preview.api_url}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            Try it in the API docs <ArrowSquareOut size={12} />
          </a>
        </div>
      )}

      {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="relative min-h-[520px] flex-1 overflow-hidden rounded-2xl border border-line bg-surface-2">
        {status === "running" && preview?.url ? (
          <div
            className="mx-auto h-full transition-[width] duration-300"
            style={{ width: device.width, maxWidth: "100%" }}
          >
            <iframe
              key={frameKey}
              src={previewAddress(preview.url, path)}
              title="Your website"
              className="h-full w-full bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        ) : (
          <div className="grid h-full place-items-center p-8 text-center">
            <div className="max-w-sm">
              {status === "installing" || status === "building" || status === "starting" ? (
                <>
                  <CircleNotch size={28} className="mx-auto animate-spin text-accent" />
                  <p className="mt-3 font-semibold">
                    {status === "installing"
                      ? "Getting your website ready..."
                      : status === "building"
                        ? "Preparing the final version..."
                        : "Starting your website..."}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {status === "building"
                      ? "The website is finished, so the preview now shows the final version: exactly what goes online. This takes 1 to 3 minutes."
                      : "The first start takes up to a minute."}
                  </p>
                </>
              ) : status === "offline" ? (
                <>
                  <WifiSlash size={28} weight="duotone" className="mx-auto text-amber-500" />
                  <p className="mt-3 font-semibold">Gagesite isn&apos;t reachable</p>
                  <p className="mt-1 text-sm text-muted">
                    Your website is safe. The preview comes back on its own once Gagesite is running again.
                  </p>
                </>
              ) : status === "failed" ? (
                <>
                  <Warning size={28} weight="fill" className="mx-auto text-amber-500" />
                  <p className="mt-3 font-semibold">The preview didn&apos;t start</p>
                  <p className="mt-1 text-sm text-muted">Ask Gagesite to fix it, or try again.</p>
                  {preview?.log.length ? (
                    <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-surface p-3 text-left text-[11px] text-muted">
                      {preview.log.slice(-12).join("\n")}
                    </pre>
                  ) : null}
                </>
              ) : (
                <>
                  <Browsers size={28} weight="duotone" className="mx-auto text-accent" />
                  <p className="mt-3 font-semibold">The preview is stopped</p>
                  <p className="mt-1 text-sm text-muted">Start it to click through your website.</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusChip({ status, mode }: { status: PreviewInfo["status"]; mode?: PreviewInfo["mode"] }) {
  const label = {
    // The finished site runs as its production build: what the owner sees is what goes online.
    running: mode === "production" ? "Final version" : "Live",
    installing: "Getting ready",
    building: "Preparing final version",
    starting: "Starting",
    stopped: "Stopped",
    failed: "Not running",
    offline: "Offline",
  }[status];
  const color =
    status === "running"
      ? "bg-emerald-50 text-emerald-700"
      : status === "failed" || status === "offline"
        ? "bg-danger-soft text-danger"
        : "bg-surface-2 text-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${color}`}>
      <span className={`size-1.5 rounded-full ${status === "running" ? "bg-emerald-500" : "bg-current opacity-60"}`} />
      {label}
    </span>
  );
}

function PagesView({
  projectId,
  pages,
  check,
  running,
  onOpen,
}: {
  projectId: string;
  pages: BuildPage[];
  check: BuildCheck | null;
  running: boolean;
  onOpen: (page: BuildPage) => void;
}) {
  if (!pages.length) {
    return (
      <EmptyCard
        icon={Hammer}
        title={running ? "Gagesite is planning the build..." : "Your pages appear here"}
        text="Every page of your plan, checked off as it is built, with a picture of how it looks."
      />
    );
  }
  const problemPages = new Set(check?.problems.map((p) => p.page) ?? []);
  return (
    <div className="space-y-4 pt-1">
      {check && <CheckSummary check={check} running={running} />}
      <ul className="grid gap-3 @xl:grid-cols-2">
        {pages.map((page) => (
          <li key={page.path} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <button
              onClick={() => page.status === "done" && onOpen(page)}
              disabled={page.status !== "done"}
              className="block w-full text-left disabled:cursor-default"
            >
              <div className="aspect-[16/10] overflow-hidden border-b border-line bg-surface-2">
                {page.screenshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${api.previewUrl(projectId, page.screenshot)}?t=${page.screenshot_at}`}
                    alt={`${page.name} page`}
                    className="w-full object-cover object-top"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-faint">
                    {page.status === "done"
                      ? "Picture comes after this round"
                      : running
                        ? "Being built..."
                        : "Not built yet"}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{page.name}</p>
                  <p className="truncate font-mono text-[11px] text-faint">{page.path}</p>
                </div>
                {page.status === "done" && problemPages.has(page.path) ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-700">
                    <Warning size={14} weight="fill" /> Needs a fix
                  </span>
                ) : page.status === "done" ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle size={14} weight="fill" /> Built
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-faint">To do</span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckSummary({ check, running }: { check: BuildCheck; running: boolean }) {
  if (check.ok) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900">
        <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-emerald-600" />
        {check.final
          ? `Final test passed: Gagesite built the finished website the way it will run online and tested every page${check.api ? ` and all ${check.api} API addresses` : ""}, logged out and with each test account.`
          : "Gagesite tested every finished page: each one opened without errors, logged out and with each test account."}
      </p>
    );
  }
  const shown = check.problems.slice(0, 4);
  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950">
      <p className="flex items-start gap-2 font-semibold">
        <Warning size={16} weight="fill" className="mt-0.5 shrink-0 text-amber-600" />
        {running
          ? `Gagesite's test found ${check.problems.length} problem${check.problems.length === 1 ? "" : "s"} and is fixing them.`
          : `Gagesite's test found ${check.problems.length} problem${check.problems.length === 1 ? "" : "s"}. Ask Gagesite to fix them.`}
      </p>
      <ul className="mt-1.5 space-y-1 pl-6 text-[13px] text-amber-900">
        {shown.map((p, i) => (
          <li key={i} className="truncate">
            <span className="font-medium">{p.page || "Website"}</span>: {p.problem.split("\n")[0]}
          </li>
        ))}
        {check.problems.length > shown.length && <li>and {check.problems.length - shown.length} more</li>}
      </ul>
    </div>
  );
}

function SummaryView({ artifact }: { artifact: BuildArtifact }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pt-2">
      {artifact.test_accounts.length > 0 && (
        <section>
          <h3 className="mb-2.5 font-display text-[15px] font-bold tracking-tight">Try it as each role</h3>
          <p className="mb-3 text-sm text-muted">
            Test accounts in the preview only. They are not used once your website is online.
          </p>
          <ul className="divide-y divide-line border-y border-line text-sm">
            {artifact.test_accounts.map((a) => (
              <li key={a.email} className="grid gap-x-4 py-2.5 sm:grid-cols-[10rem_1fr_8rem]">
                <span className="font-medium">{a.role}</span>
                <span className="font-mono text-xs text-muted">{a.email}</span>
                <span className="font-mono text-xs text-muted">{a.password}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {artifact.markdown ? (
        <div className="prose-doc text-[15px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.markdown}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-muted">Gagesite writes a plain summary of your website once it is built.</p>
      )}
    </div>
  );
}
