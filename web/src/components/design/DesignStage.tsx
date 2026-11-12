"use client";

import { ArrowRight, PaintBrush, Rocket } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import DesignKitStart from "@/components/design/DesignKitStart";
import DesignPanel from "@/components/design/DesignPanel";
import { commentsMessage } from "@/components/design/PageComments";
import ChatColumn from "@/components/stage/ChatColumn";
import StartOverButton from "@/components/stage/StartOverButton";
import StageLayout from "@/components/stage/StageLayout";
import StartPanel, { ChatGreeting } from "@/components/stage/StartPanel";
import { api, type DesignArtifact, type DesignKit, type StageInfo } from "@/lib/api";
import { useStageRun } from "@/lib/useStageRun";

const STAGE = "03-design";

function describeKit(kit: DesignKit) {
  const parts = [];
  if (kit.logo) parts.push("my logo");
  if (kit.colors.length) parts.push(`my colours (${kit.colors.join(", ")})`);
  if (kit.photos.length) parts.push(`${kit.photos.length} photo${kit.photos.length === 1 ? "" : "s"}`);
  if (kit.references.length)
    parts.push(`${kit.references.length} screenshot${kit.references.length === 1 ? "" : "s"} of sites I like`);
  if (kit.style_notes) parts.push("a description of the style I like");
  return parts.length ? `I added ${parts.join(", ")}.` : "I didn't add a logo, colours or photos, so please decide.";
}

export default function DesignStage({
  projectId,
  stage,
  activeRunId,
  onStageChange,
  onApproved,
}: {
  projectId: string;
  stage: StageInfo;
  activeRunId: string | null;
  onStageChange: () => void;
  /** After approving: go on to the next stage. */
  onApproved?: () => void;
}) {
  const [artifact, setArtifact] = useState<DesignArtifact | null>(null);
  const [kit, setKit] = useState<DesignKit | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Previews reload only when their files really changed, not every time the chat updates.
  const loadArtifact = useCallback(() => {
    api.getDesign(projectId).then((next) => {
      setArtifact(next);
      setRefreshKey(next.version ?? 0);
    });
  }, [projectId]);
  useEffect(() => {
    loadArtifact();
    api.getDesignKit(projectId).then(setKit);
  }, [loadArtifact, projectId]);

  const run = useStageRun({
    projectId,
    stageKey: STAGE,
    activeRunId,
    onArtifactChange: loadArtifact,
    onDone: onStageChange,
  });
  const approved = stage.status === "approved";
  // Started once a style exists (or Gagesite is drawing one). Stopped before anything was drawn:
  // the start form comes back with what the owner already added, so they can go again.
  // A design plan counts too: it comes before the styles, and the owner must see it to approve it.
  const drawn = !!artifact && (artifact.directions.length > 0 || !!artifact.status || !!artifact.has_plan);
  const started = run.running || (run.messages.length > 0 && (artifact === null || drawn));
  const startKit = (saved: DesignKit) => run.send(`Please propose a style for my website. ${describeKit(saved)}`);

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
    <StageLayout
      wide
      chatBusy={run.running}
      panelLabel="Design"
      panelIcon={PaintBrush}
      chat={
        <ChatColumn
            projectId={projectId}
          title="UI design"
          subtitle="Pick one of three looks, then agree its building blocks and your key pages."
          messages={run.messages}
          live={run.live}
          error={run.error}
          approved={approved}
          placeholder="Ask for changes, e.g. 'Make the photos on the home page bigger'..."
          onSend={run.send}
          onStop={run.stop}
          stopping={run.stopping}
          headerAction={
            started || approved ? (
              <StartOverButton
                projectId={projectId}
                stageKey={STAGE}
                stageName="UI design"
                approved={approved}
                cleared="The three looks, the components, the key pages and this conversation"
                kept="Your logo, colours, photos, reference sites and notes, and your plan and data design"
                disabled={busy || run.running}
                onDone={async () => {
                  await run.reload();
                  loadArtifact();
                  onStageChange();
                }}
              />
            ) : null
          }
          emptyState={
            <ChatGreeting title="Let's see your website before it's built.">
              <p>
                On the right, add your logo, colours and photos, and any sites you like. Everything is optional; skip it and
                I&apos;ll decide.
              </p>
              <p>Or describe the style you want here, for example &ldquo;warm and cosy, brown and cream&rdquo;.</p>
            </ChatGreeting>
          }
        />
      }
      startOnPanel={(!started && !approved) || (approved && !!artifact?.skipped)}
      panel={
        !started && !approved ? (
          <StartPanel title="Design">
            {kit ? (
              <DesignKitStart
                projectId={projectId}
                kit={kit}
                onKitChange={setKit}
                onStart={startKit}
                onSkip={async () => {
                  await api.skipDesign(projectId);
                  if (onApproved) onApproved();
                  else onStageChange();
                }}
              />
            ) : (
              <div className="h-96 animate-pulse rounded-3xl bg-surface-2" />
            )}
          </StartPanel>
        ) : approved && artifact?.skipped ? (
          <StartPanel title="Design">
            <div className="mx-auto max-w-2xl rounded-3xl border border-line bg-surface p-6">
              <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent">
                <Rocket size={22} weight="duotone" />
              </span>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">You skipped UI Design</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Implementation builds one modern landing page and designs it itself, using your logo, colours, photos and
                notes from this step.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={`/projects/${projectId}/04-build`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98]"
                >
                  Go to Implementation
                  <ArrowRight size={16} weight="bold" />
                </Link>
                <button
                  type="button"
                  onClick={() => act("reopen")}
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-xl border border-line-strong px-4 text-sm font-medium transition hover:border-accent hover:text-accent-ink active:scale-[0.98] disabled:opacity-60"
                >
                  Design a full website instead
                </button>
              </div>
              {run.error && <p className="mt-3 text-sm text-danger">{run.error}</p>}
            </div>
          </StartPanel>
        ) : (
          <DesignPanel
            projectId={projectId}
            artifact={artifact}
            approved={approved}
            approvedAt={stage.approved_at}
            running={run.running}
            busy={busy}
            refreshKey={refreshKey}
            onChoose={(direction) =>
              run.send(`I'd like to use this style (${direction.name}). Please create the component library and my key pages.`)
            }
            onApprove={() => act("approve")}
            onReopen={() => act("reopen")}
            onSendComments={(comments) => run.send(commentsMessage(comments))}
            onAsk={run.send}
            kit={kit}
          />
        )
      }
    />
  );
}
