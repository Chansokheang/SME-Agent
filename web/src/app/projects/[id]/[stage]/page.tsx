"use client";

import { ArrowRight, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import BuildStage from "@/components/build/BuildStage";
import DatabaseStage from "@/components/database/DatabaseStage";
import DeployStage from "@/components/deploy/DeployStage";
import DesignStage from "@/components/design/DesignStage";
import LandingBrief from "@/components/LandingBrief";
import PlaceholderStage from "@/components/PlaceholderStage";
import ScopeStage from "@/components/ScopeStage";
import StageSidebar, { MobileStageBar } from "@/components/StageSidebar";
import { api, type ProjectDetail } from "@/lib/api";

export default function StagePage() {
  const { id, stage } = useParams<{ id: string; stage: string }>();
  const router = useRouter();
  const fromSetup = useSearchParams().get("from") === "setup";
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api
      .getProject(id)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(refresh, [refresh]);
  // Notice work started elsewhere (another tab or window): check every few seconds while visible.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (error) {
    return (
      <main className="grid h-[100dvh] place-items-center px-4">
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
      </main>
    );
  }
  if (!detail) return <WorkspaceSkeleton />;

  const current = detail.stages.find((s) => s.key === stage);
  if (!current) return <p className="p-10 text-sm text-muted">Unknown stage.</p>;
  const runId = detail.active_run?.stage_key === stage ? detail.active_run.id : null;
  // Approving a stage unlocks the next one: take the owner straight there.
  // After approving, go to the next stage that still needs work (later ones may still be approved).
  const next = detail.stages.find((s) => s.order > current.order && s.status !== "approved");
  // A reopened earlier stage must be finished first: everything after it builds on it.
  const reopenedAll =
    current.status !== "locked" ? detail.stages.filter((s) => s.order < current.order && s.status !== "approved") : [];
  const reopened = reopenedAll[0];
  const onApproved = next
    ? () => {
        refresh();
        router.push(`/projects/${id}/${next.key}`);
      }
    : undefined;

  // A landing page has three steps: its brief (in place of Plan, Database and UI Design),
  // Implementation and Deployment. The brief's step opens the first stage, where the brief lives.
  const landing = detail.kind === "landing";
  const navStages = landing
    ? [
        {
          ...detail.stages[0],
          title: "Landing page brief",
          description: "What the page is about, its main action and key facts.",
          status: detail.brief_needed ? ("active" as const) : ("approved" as const),
        },
        ...detail.stages.filter((s) => s.key === "04-build" || s.key === "05-deploy"),
      ].map((s, i) => ({ ...s, order: i + 1 }))
    : detail.stages;
  const navKey = landing && (stage === "02-database" || stage === "03-design") ? "01-scope" : stage;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-canvas">
      <StageSidebar projectId={id} projectName={detail.project.name} stages={navStages} currentKey={navKey} />
      <main className="flex min-w-0 flex-1 flex-col">
        <MobileStageBar projectId={id} projectName={detail.project.name} stages={navStages} currentKey={navKey} />
        {reopened && stage !== "04-build" && (
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-sm text-amber-950">
            <WarningCircle size={18} weight="fill" className="shrink-0 text-amber-500" />
            <p className="min-w-0 flex-1">
              <span className="font-semibold">{reopened.title}</span> was reopened. Finish and approve it first: this step
              builds on it.
            </p>
            <Link
              href={`/projects/${id}/${reopened.key}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-950"
            >
              Go to {reopened.title}
              <ArrowRight size={13} weight="bold" />
            </Link>
          </div>
        )}
        {fromSetup && stage === "02-database" && current.status !== "approved" && (
          <div className="flex shrink-0 items-center gap-3 border-b border-accent/20 bg-accent-soft px-5 py-2.5 text-sm text-accent-ink">
            <WarningCircle size={18} weight="fill" className="shrink-0 text-accent" />
            <p className="min-w-0 flex-1">
              The build setup you chose has its own API, so your website needs a database. Design it here and approve it;
              you&apos;ll then go back to Implementation.
            </p>
          </div>
        )}
        <div className="min-h-0 flex-1">
          {landing && (stage === "01-scope" || stage === "02-database" || stage === "03-design") ? (
            <LandingBrief
              projectId={id}
              projectName={detail.project.name}
              onDone={() => {
                refresh();
                router.push(`/projects/${id}/04-build`);
              }}
            />
          ) : current.status !== "locked" && stage === "01-scope" ? (
            <ScopeStage
              key={stage}
              projectId={id}
              stage={current}
              activeRunId={runId}
              onStageChange={refresh}
              onApproved={onApproved}
            />
          ) : current.status !== "locked" && stage === "02-database" ? (
            <DatabaseStage
              key={stage}
              projectId={id}
              stage={current}
              activeRunId={runId}
              onStageChange={refresh}
              onApproved={onApproved}
            />
          ) : current.status !== "locked" && stage === "03-design" ? (
            <DesignStage
              key={stage}
              projectId={id}
              stage={current}
              activeRunId={runId}
              onStageChange={refresh}
              onApproved={onApproved}
            />
          ) : current.status !== "locked" && stage === "04-build" ? (
            <BuildStage
              key={stage}
              projectId={id}
              stage={current}
              activeRunId={runId}
              onStageChange={refresh}
              onApproved={onApproved}
              earlierOpen={reopenedAll.map((s) => ({ key: s.key, title: s.title }))}
            />
          ) : current.status !== "locked" && stage === "05-deploy" ? (
            <DeployStage key={stage} projectId={id} stage={current} activeRunId={runId} onStageChange={refresh} />
          ) : (
            <PlaceholderStage stage={current} />
          )}
        </div>
      </main>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-[100dvh] animate-pulse bg-canvas" aria-label="Loading project">
      <div className="hidden w-[272px] shrink-0 space-y-4 border-r border-line bg-surface p-5 lg:block">
        <div className="h-8 w-40 rounded-lg bg-surface-2" />
        <div className="h-16 rounded-2xl bg-surface-2" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-11 rounded-xl bg-surface-2" />
        ))}
      </div>
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_500px]">
        <div className="space-y-4 p-8">
          <div className="h-5 w-48 rounded bg-surface-2" />
          <div className="h-24 max-w-xl rounded-2xl bg-surface-2" />
          <div className="ml-auto h-12 max-w-sm rounded-2xl bg-surface-2" />
        </div>
        <div className="hidden border-l border-line bg-surface lg:block" />
      </div>
    </div>
  );
}
