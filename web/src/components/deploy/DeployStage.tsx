"use client";

import { ArrowRight, Globe, RocketLaunch } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import ApiServerCard from "@/components/deploy/ApiServerCard";
import DeployPanel from "@/components/deploy/DeployPanel";
import ChatColumn from "@/components/stage/ChatColumn";
import StageLayout from "@/components/stage/StageLayout";
import StartPanel, { ChatGreeting } from "@/components/stage/StartPanel";
import { api, type DbConnection, type DeployArtifact, type GitHubInfo, type StageInfo, type VercelInfo } from "@/lib/api";
import { useStageRun } from "@/lib/useStageRun";

const STAGE = "05-deploy";
const START_MESSAGE = "Please get my website ready to go online.";

export default function DeployStage({
  projectId,
  stage,
  activeRunId,
  onStageChange,
}: {
  projectId: string;
  stage: StageInfo;
  activeRunId: string | null;
  onStageChange: () => void;
}) {
  const [artifact, setArtifact] = useState<DeployArtifact | null>(null);
  const [github, setGitHub] = useState<GitHubInfo | null>(null);
  const [vercel, setVercel] = useState<VercelInfo | null>(null);
  const [database, setDatabase] = useState<DbConnection | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState(false);

  const loadArtifact = useCallback(() => {
    api.getDeploy(projectId).then(setArtifact);
  }, [projectId]);
  useEffect(() => {
    loadArtifact();
    api
      .getGitHub(projectId)
      .then(setGitHub)
      .catch(() => undefined);
    api
      .getVercel(projectId)
      .then(setVercel)
      .catch(() => undefined);
    api
      .getConnection(projectId)
      .then(setDatabase)
      .catch(() => undefined);
    api
      .getScope(projectId)
      .then((s) => setBusinessName(s.data?.business?.name ?? ""))
      .catch(() => undefined);
  }, [loadArtifact, projectId]);

  // Follow the steps while the website goes online.
  const going = artifact?.deployment.status === "running";
  useEffect(() => {
    if (!going) return;
    const timer = window.setInterval(loadArtifact, 3000);
    return () => window.clearInterval(timer);
  }, [going, loadArtifact]);
  useEffect(() => {
    if (!going) onStageChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [going]);

  const run = useStageRun({ projectId, stageKey: STAGE, activeRunId, onArtifactChange: loadArtifact, onDone: onStageChange });
  const approved = stage.status === "approved";
  // Stopped before anything was written: the start panel comes back.
  const started = run.running || !!artifact?.exists || (run.messages.length > 0 && artifact === null);

  async function act(action: "approve" | "reopen") {
    setBusy(true);
    run.setError(null);
    try {
      await (action === "approve" ? api.approve(projectId, STAGE) : api.reopen(projectId, STAGE));
      onStageChange();
    } catch (e) {
      run.setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <StageLayout
      wide
      chatBusy={run.running}
      panelLabel="Go online"
      panelIcon={Globe}
      chat={
        <ChatColumn
            projectId={projectId}
          title="Deployment"
          subtitle="Your website goes online in your own accounts."
          messages={run.messages}
          live={run.live}
          error={run.error}
          approved={approved}
          placeholder="Ask about going online, e.g. 'Can I use my own address?'"
          onSend={run.send}
          onStop={run.stop}
          stopping={run.stopping}
          emptyState={
            <ChatGreeting title="Let's put your website online.">
              <p>Press Get it ready on the right when you&apos;re ready.</p>
            </ChatGreeting>
          }
        />
      }
      startOnPanel={!started && !approved}
      panel={
        !started && !approved ? (
          <StartPanel title="Go online">
            <div className="mx-auto max-w-2xl space-y-4 py-2">
              <h2 className="text-center font-display text-[clamp(1.6rem,2.4vw,2.1rem)] font-bold leading-tight tracking-tight">
                Put your website online
              </h2>
              <section className="rounded-3xl border border-accent/40 bg-accent-soft/40 p-5">
                <p className="text-sm leading-relaxed text-muted">
                  Your website goes online in <span className="font-medium text-ink">your own</span> Vercel account, with its data
                  in your own database. First, Gagesite checks everything works online and lists what you&apos;ll need. It takes
                  about 5 to 10 minutes.
                </p>
                <button
                  onClick={() => run.send(START_MESSAGE)}
                  disabled={run.running}
                  className="group mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-[0_12px_32px_-12px_rgba(34,102,212,0.7)] transition hover:bg-accent-hover active:scale-[0.98] disabled:bg-line-strong disabled:shadow-none"
                >
                  <RocketLaunch size={18} weight="bold" />
                  Get it ready
                  <ArrowRight size={18} weight="bold" className="transition group-hover:translate-x-0.5" />
                </button>
              </section>
              {/* "UI + dedicated API": the API can go on the owner's own server without the website. */}
              <ApiServerCard projectId={projectId} running={run.running} onAskFix={run.send} />
            </div>
          </StartPanel>
        ) : artifact ? (
          <DeployPanel
            projectId={projectId}
            artifact={artifact}
            github={github}
            vercel={vercel}
            database={database}
            suggestedName={businessName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")}
            approved={approved}
            approvedAt={stage.approved_at}
            running={run.running}
            busy={busy}
            onGitHubChange={setGitHub}
            onVercelChange={setVercel}
            onDatabaseChange={(connection) => {
              setDatabase(connection);
              loadArtifact(); // a different database has no account yet: the login step comes back
            }}
            onArtifactChange={setArtifact}
            onAskFix={run.send}
            onApprove={() => act("approve")}
            onReopen={() => act("reopen")}
          />
        ) : (
          <div className="h-full animate-pulse bg-surface-2" aria-label="Loading" />
        )
      }
    />
  );
}
