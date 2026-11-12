"use client";

import {
  ArrowRight,
  Browsers,
  CheckCircle,
  Database,
  GithubLogo,
  Hammer,
  PaintBrush,
  PlugsConnected,
  SealCheck,
  Timer,
  Lightning,
  WarningCircle,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import BuildPanel from "@/components/build/BuildPanel";
import GitHubConnect from "@/components/build/GitHubConnect";
import SetupChoice, { LandingVideo } from "@/components/build/SetupChoice";
import TeamStrip from "@/components/build/TeamStrip";
import ChatColumn from "@/components/stage/ChatColumn";
import ConfirmDialog from "@/components/stage/ConfirmDialog";
import { StartOverTrigger } from "@/components/stage/StartOverButton";
import StageLayout from "@/components/stage/StageLayout";
import StartPanel, { ChatGreeting } from "@/components/stage/StartPanel";
import {
  api,
  type BuildArtifact,
  type BuildSetup,
  type BuildSetupChoice,
  type GitHubInfo,
  type LandingStyle,
  type Scope,
  type StageInfo,
  type StoryboardInfo,
  type TeamInfo,
} from "@/lib/api";
import StoryboardPanel from "@/components/build/StoryboardPanel";
import { useStageRun } from "@/lib/useStageRun";
import { useTeamLive } from "@/lib/useTeamLive";

const STAGE = "04-build";
const START_MESSAGE = "Please build my website from the approved plan, data design and design.";
const SETUP_WORDS: Record<BuildSetup["setup"], string> = {
  all_in_one: "with the pages and API together in one Next.js app (with Prisma)",
  api_service: "as a UI-only website plus a dedicated API service in service/ (see Build setup)",
  static_external: "as a static UI: pages only, with no backend or database of our own",
  landing: "as one commercial, modern landing page (see the landing page instructions). Start with the scroll storyboard",
};

const LANDING_SHOWPIECE: Record<LandingStyle, string> = {
  modern: "layered visuals and scroll motion",
  "3d": "a live 3D scene",
  video: "a full-screen video",
};

export default function BuildStage({
  projectId,
  stage,
  activeRunId,
  onStageChange,
  onApproved,
  earlierOpen: reopenedStages = [],
}: {
  projectId: string;
  stage: StageInfo;
  activeRunId: string | null;
  onStageChange: () => void;
  /** After approving: go on to the next stage. */
  onApproved?: () => void;
  /** An earlier stage was reopened: nothing can start here until it is approved again. */
  /** Earlier stages that were reopened (the build waits for them). */
  earlierOpen?: { key: string; title: string }[];
}) {
  const [artifact, setArtifact] = useState<BuildArtifact | null>(null);
  const [github, setGitHub] = useState<GitHubInfo | null>(null);
  const [pages, setPages] = useState<Scope["pages"]>([]);
  const [access, setAccess] = useState<Scope["program_access"]>(undefined);
  const [businessName, setBusinessName] = useState("");
  // A simple site without a database (chosen in Stage 2) builds no practice database.
  const [noDatabase, setNoDatabase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // A landing page's scroll storyboard (written before any code, approved by the owner).
  const [storyboard, setStoryboard] = useState<StoryboardInfo | null>(null);
  const loadArtifact = useCallback(() => {
    api.getBuild(projectId).then(setArtifact);
    api
      .getStoryboard(projectId)
      .then(setStoryboard)
      .catch(() => undefined);
    api
      .getGitHub(projectId)
      .then(setGitHub)
      .catch(() => undefined);
  }, [projectId]);
  useEffect(() => {
    loadArtifact();
    api
      .getScope(projectId)
      .then((s) => {
        setPages(s.data?.pages ?? []);
        setAccess(s.data?.program_access);
        setBusinessName(s.data?.business?.name ?? "");
      })
      .catch(() => undefined);
    api
      .getDatabase(projectId)
      .then((d) => setNoDatabase(d.data?.mode === "none"))
      .catch(() => undefined);
  }, [loadArtifact, projectId]);

  const run = useStageRun({
    projectId,
    stageKey: STAGE,
    activeRunId,
    onArtifactChange: loadArtifact,
    onDone: () => {
      onStageChange();
      // Screenshots and the GitHub save finish shortly after the turn: pick them up.
      window.setTimeout(loadArtifact, 8000);
      window.setTimeout(loadArtifact, 30000);
    },
  });
  const approved = stage.status === "approved";

  // How the website is built. A setup with its own API needs a finished database design:
  // choosing one before that sends the owner to Database Design.
  const [setup, setSetup] = useState<BuildSetup | null>(null);
  useEffect(() => {
    const load = () =>
      api
        .getBuildSetup(projectId)
        .then(setSetup)
        .catch(() => undefined);
    load();
    // Coming back to the tab: pick up changes (e.g. newly available setups) without a refresh.
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [projectId]);
  // A static UI has no database of its own, so an open Database Design doesn't hold it up.
  const earlierOpen =
    reopenedStages.find(
      (s) => !((setup?.setup === "static_external" || setup?.setup === "landing") && s.key === "02-database"),
    ) ?? null;

  async function chooseSetup(choice: BuildSetupChoice) {
    setBusy(true);
    run.setError(null);
    try {
      setSetup(await api.putBuildSetup(projectId, choice));
    } catch (e) {
      run.setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // The agent team (beta): its board, and the chat following each agent's run as it starts.
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const followed = useRef<string | null>(activeRunId);
  const loadTeam = useCallback(() => {
    api
      .getTeam(projectId)
      .then(setTeam)
      .catch(() => undefined);
  }, [projectId]);
  useEffect(() => {
    loadTeam();
  }, [loadTeam]);
  const teamRunning = team?.state === "running";
  useEffect(() => {
    if (!teamRunning) return;
    const timer = window.setInterval(loadTeam, 3000);
    return () => window.clearInterval(timer);
  }, [teamRunning, loadTeam]);
  const currentRun = team?.current.run_id;
  const { follow, running: chatRunning } = run;
  useEffect(() => {
    if (currentRun && currentRun !== followed.current && !chatRunning) {
      followed.current = currentRun;
      follow(currentRun);
    }
  }, [currentRun, chatRunning, follow]);
  // Every agent at work right now, one folded line per task in the chat.
  const liveGroups = useTeamLive(team, () => {
    run.reload();
    loadArtifact();
  });
  const wasRunning = useRef(false);
  useEffect(() => {
    // The team just stopped (finished, paused or blocked): refresh the stage and the website panel.
    if (wasRunning.current && !teamRunning) {
      onStageChange();
      loadArtifact();
    }
    wasRunning.current = teamRunning;
  }, [teamRunning, onStageChange, loadArtifact]);

  async function teamAction(action: "start" | "retry" | "pause") {
    setBusy(true);
    run.setError(null);
    try {
      setTeam(action === "pause" ? await api.pauseTeam(projectId) : await api.startTeam(projectId, action === "retry"));
    } catch (e) {
      run.setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Stopped before anything was written: the start panel comes back.
  const started = run.running || !!artifact?.exists || !!team || (run.messages.length > 0 && artifact === null)
    || (setup?.setup === "landing" && !!storyboard?.storyboard);

  // A landing page is storyboarded first (the Motion Director), then built from the approved storyboard.
  const storyboardPhase =
    setup?.setup === "landing" && !!storyboard && !storyboard.approved && !storyboard.build_started && !approved
    && (run.running || !!storyboard.storyboard || run.messages.length > 0);

  async function buildFromStoryboard() {
    setBusy(true);
    run.setError(null);
    try {
      setStoryboard(await api.approveStoryboard(projectId));
      await run.send(
        "The storyboard is approved. Please build my landing page from it (docs/04-storyboard.json), following its " +
          "concept, sections and decisions, and check the motion with the motion check before you finish.",
      );
    } catch (e) {
      run.setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Errors surface in the confirm dialog, which stays open.
  async function startOver() {
    setBusy(true);
    run.setError(null);
    try {
      await api.resetStage(projectId, STAGE);
      await run.reload();
      loadArtifact();
      onStageChange(); // an approved step was reopened
    } finally {
      setBusy(false);
    }
  }

  async function act(action: "approve" | "reopen") {
    setBusy(true);
    run.setError(null);
    try {
      await (action === "approve" ? api.approve(projectId, STAGE) : api.reopen(projectId, STAGE));
      if (action === "approve" && onApproved) onApproved();
      else onStageChange();
    } catch (e) {
      run.setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {confirmReset && (
        <ConfirmDialog
          title="Start the build over?"
          description={`Gagesite builds your website again from your approved plan, data and design.${approved ? " The step is approved, so it is reopened first and later steps wait for it again." : ""} This can't be undone.`}
          rows={[
            ["Cleared", "The website built so far and this conversation"],
            ["Kept", "Your plan, data design, UI design and database rows"],
          ]}
          confirmLabel="Start over"
          busyLabel="Clearing..."
          danger
          onConfirm={startOver}
          onClose={() => setConfirmReset(false)}
        />
      )}
      <StageLayout
        wide
        chatBusy={run.running}
        panelLabel="Website"
        panelIcon={Browsers}
        chat={
          <ChatColumn
            projectId={projectId}
            title="Implementation"
            subtitle="Gagesite builds your real website. Try it on the right while it works."
            messages={run.messages}
            live={run.live}
            liveGroups={liveGroups}
            tasks={team?.tasks}
            error={run.error}
            approved={approved}
            placeholder="Ask for changes, e.g. 'Show the newest proteins first'..."
            onSend={run.send}
            onStop={run.stop}
            stopping={run.stopping}
            headerAction={
              started || approved ? (
                <StartOverTrigger onClick={() => setConfirmReset(true)} disabled={busy} />
              ) : null
            }
            emptyState={
              setup?.setup === "landing" ? (
                <ChatGreeting title="Now let's build your landing page.">
                  <p>
                    Press Storyboard my landing page on the right. Gagesite first plans the scroll story (the big idea and
                    what moves in each section) for you to read and change; then it builds the page and checks how it moves.
                  </p>
                </ChatGreeting>
              ) : (
                <ChatGreeting title="Now let's build your real website.">
                  <p>Press Build my website on the right when you&apos;re ready. A small team builds it and tests each part as it goes.</p>
                </ChatGreeting>
              )
            }
          />
        }
        startOnPanel={(!started && !approved) || storyboardPhase}
        panel={
          !started && !approved ? (
            <StartPanel title="Website" wide>
              <BuildStart
                projectId={projectId}
                pages={pages}
                access={access}
                noDatabase={noDatabase}
                suggestedName={businessName
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "")}
                github={github}
                onGitHubChange={setGitHub}
                starting={
                  run.running ||
                  busy ||
                  !!earlierOpen ||
                  (!!setup && ((setup.needs_database && !setup.database_ready) || setup.needs_service))
                }
                onStart={() => run.send(`${START_MESSAGE} Build it ${SETUP_WORDS[setup?.setup ?? "all_in_one"]}.`)}
                onStartTeam={() => teamAction("start")}
                setup={setup}
                blocked={
                  earlierOpen
                    ? {
                        text: `${earlierOpen.title} was reopened, so building waits until you finish and approve it.`,
                        label: `Go to ${earlierOpen.title}`,
                        href: `/projects/${projectId}/${earlierOpen.key}`,
                      }
                    : setup?.needs_database && !setup.database_ready
                      ? {
                          text: "This setup needs a database. Finish Database Design with a database first.",
                          label: "Go to Database Design",
                          href: `/projects/${projectId}/02-database?from=setup`,
                        }
                      : null
                }
                setupChoice={
                  setup && (
                    <SetupChoice
                      projectId={projectId}
                      setup={setup}
                      busy={busy}
                      onChoose={chooseSetup}
                      onSetup={setSetup}
                    />
                  )
                }
              />
            </StartPanel>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              {setup?.setup === "landing" && setup.landing_style === "video" && !approved && (
                <div className="shrink-0 border-line bg-surface px-4 pt-3 lg:border-l">
                  <LandingVideo projectId={projectId} setup={setup} onSetup={setSetup} compact />
                </div>
              )}
              {team && !approved && (
                <div className="shrink-0 border-line bg-surface pt-3 lg:border-l">
                  <TeamStrip
                    team={team}
                    busy={busy}
                    onPause={() => teamAction("pause")}
                    onResume={(retry) => teamAction(retry ? "retry" : "start")}
                  />
                </div>
              )}
              <div className="min-h-0 flex-1">
                {storyboardPhase ? (
                  <StoryboardPanel
                    board={storyboard?.storyboard ?? null}
                    running={run.running}
                    busy={busy}
                    onBuild={buildFromStoryboard}
                  />
                ) : (
                  <BuildPanel
                    projectId={projectId}
                    artifact={artifact}
                    approved={approved}
                    approvedAt={stage.approved_at}
                    running={run.running}
                    busy={busy}
                    github={github}
                    onGitHubChange={setGitHub}
                    onApprove={() => act("approve")}
                    onReopen={() => act("reopen")}
                  />
                )}
              </div>
            </div>
          )
        }
      />
    </>
  );
}

function BuildStart({
  projectId,
  pages,
  access,
  noDatabase,
  suggestedName,
  github,
  onGitHubChange,
  starting,
  onStart,
  onStartTeam,
  setup,
  blocked,
  setupChoice,
}: {
  projectId: string;
  pages: Scope["pages"];
  access: Scope["program_access"];
  noDatabase: boolean;
  suggestedName: string;
  github: GitHubInfo | null;
  onGitHubChange: (github: GitHubInfo | null) => void;
  starting: boolean;
  onStart: () => void;
  onStartTeam: () => void;
  setup: BuildSetup | null;
  /** Why the build can't start yet, and where to fix it. */
  blocked: { text: string; label: string; href: string } | null;
  /** "How should it be built?" */
  setupChoice?: React.ReactNode;
}) {
  // The GitHub form only opens when asked for: building never waits on it.
  const [connecting, setConnecting] = useState(false);
  const apiPages = new Set(["/api-docs", "/settings/access-keys"]);
  const sitePages = pages.filter((p) => !apiPages.has(p.path)).length;
  const kind = setup?.setup ?? "all_in_one";
  const otherPrograms = access?.needed === true;

  // What gets built, in plain words, following the chosen setup.
  const landing = kind === "landing";
  const facts: { icon: Icon; label: string; value: string; tone?: "on" | "off" }[] = landing
    ? [
        { icon: Browsers, label: "Pages", value: "One landing page: your plan's pages become its sections" },
        {
          icon: PaintBrush,
          label: "Design",
          value: setup?.design_skipped
            ? `Designed here, with ${LANDING_SHOWPIECE[setup?.landing_style ?? "modern"]}`
            : `Your approved design, with ${LANDING_SHOWPIECE[setup?.landing_style ?? "modern"]}`,
        },
        { icon: Database, label: "Data", value: "No database: your content kept in a file, forms sent by email" },
        { icon: SealCheck, label: "Testing", value: "The builder checks every section on desktop and phone" },
        { icon: Timer, label: "Time", value: "Quicker than a full website" },
      ]
    : [
    {
      icon: Browsers,
      label: "Pages",
      value: `${sitePages} page${sitePages === 1 ? "" : "s"} from your plan${kind === "static_external" ? ", with no server of our own" : ""}`,
    },
    {
      icon: Database,
      label: "Data",
      value:
        kind === "static_external"
          ? "Sample data for now; another service's data once you connect it"
          : noDatabase
            ? "Your own content, kept in files"
            : "Your database design, filled with sample data",
    },
    {
      icon: PlugsConnected,
      label: "API",
      value:
        kind === "static_external"
          ? "None of our own: the pages call another service"
          : kind === "api_service"
            ? `Its own service in ${setup?.api_language === "python" ? "Python (FastAPI)" : "TypeScript (Hono)"}`
            : `In the same app (Next.js + Prisma)${otherPrograms ? "; other programs can use it with access keys" : ""}`,
    },
    { icon: SealCheck, label: "Testing", value: "A tester checks each part, then the whole site at the end" },
    { icon: Timer, label: "Time", value: "Longer than a quick build; try each page as soon as it's ready" },
  ];

  return (
    <div className="pb-2">
      <div>
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Ready to build your website</h2>
        <p className="mt-1 text-sm text-muted">Choose how it&apos;s built, then start. Everything comes from your approved plan, data and design.</p>
      </div>

      <div className="mt-5 grid items-stretch gap-4 @3xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col [&>section]:flex-1">{setupChoice}</div>

        <aside className="flex min-w-0 flex-col">
          <section className="flex flex-1 flex-col rounded-3xl border border-accent/40 bg-accent-soft/40 p-5">
            <h3 className="font-display text-[17px] font-bold tracking-tight">Your build</h3>
            <dl className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface text-sm">
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-start gap-3 px-3.5 py-2.5">
                  <fact.icon
                    size={17}
                    weight="duotone"
                    className={`mt-0.5 shrink-0 ${fact.tone === "off" ? "text-faint" : "text-accent"}`}
                  />
                  <dt className="w-16 shrink-0 font-medium text-muted">{fact.label}</dt>
                  <dd className={`min-w-0 flex-1 ${fact.tone === "off" ? "text-muted" : ""}`}>{fact.value}</dd>
                </div>
              ))}
            </dl>
            <button
              onClick={landing ? onStart : onStartTeam}
              disabled={starting}
              className="group mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3 font-semibold text-white shadow-[0_12px_32px_-12px_rgba(34,102,212,0.7)] transition duration-200 hover:-translate-y-0.5 hover:bg-accent-hover active:scale-[0.98] disabled:translate-y-0 disabled:bg-line-strong disabled:shadow-none"
            >
              <Hammer size={18} weight="bold" />
              {landing ? "Storyboard my landing page" : "Build my website"}
              <ArrowRight size={18} weight="bold" className="transition group-hover:translate-x-0.5" />
            </button>
            <p className="mt-2 text-center text-xs leading-relaxed text-muted">
              {landing
                ? "First a motion director storyboards the scroll story for you to approve; then one builder builds it and checks how it moves."
                : "Built by a team: an advisor plans the tasks, a builder makes each one, a tester checks it before the next."}
            </p>
            {/* The faster single-builder route, at the bottom so both columns end together. */}
            <ul className={`mt-auto border-t border-accent/20 pt-1 ${landing ? "hidden" : ""}`}>
              <li className="flex items-center gap-3 py-3">
                <button
                  onClick={onStart}
                  disabled={starting}
                  className="inline-flex h-9 w-36 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface text-[13px] font-semibold transition duration-200 hover:border-accent hover:text-accent-ink active:scale-[0.98] disabled:opacity-50"
                >
                  <Lightning size={15} weight="duotone" />
                  Quick build
                </button>
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
                  One builder makes every page, then checks the whole site. Faster, but nobody else tests its work.
                </p>
              </li>
            </ul>
          </section>
        </aside>
      </div>

      <div className="mt-3 space-y-2">
        {blocked && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-950 ring-1 ring-amber-200/70 [animation:rise-in_200ms_ease-out]">
            <WarningCircle size={17} weight="fill" className="shrink-0 text-amber-500" />
            <p className="min-w-0 flex-1 leading-relaxed">{blocked.text}</p>
            <Link
              href={blocked.href}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-amber-900 px-3 text-xs font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-amber-950 active:scale-[0.98]"
            >
              {blocked.label}
              <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        )}

        <section className="rounded-xl border border-line bg-surface px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <GithubLogo size={17} weight="fill" className="shrink-0" />
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{github ? "Saved to your GitHub" : "Save your code to GitHub"}</span>
              <span className="ml-2 text-muted">
                {github ? (
                  <a href={github.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-ink hover:underline">
                    {github.repo}
                  </a>
                ) : (
                  "A copy in your own account. Optional."
                )}
              </span>
            </p>
            {github ? (
              <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                <CheckCircle size={16} weight="fill" />
                Connected
              </span>
            ) : (
              <button
                onClick={() => setConnecting(!connecting)}
                aria-expanded={connecting}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-semibold transition duration-200 hover:border-accent hover:text-accent-ink active:scale-[0.98]"
              >
                <GithubLogo size={14} weight="fill" />
                {connecting ? "Close" : "Connect GitHub"}
              </button>
            )}
          </div>
          {!github && connecting && (
            <div className="mt-4 border-t border-line pt-4 [animation:rise-in_200ms_ease-out]">
              <GitHubConnect
                projectId={projectId}
                github={github}
                onChange={onGitHubChange}
                suggestedName={suggestedName}
                bare
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
