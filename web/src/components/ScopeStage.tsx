"use client";

import LandingSkipCard from "@/components/LandingSkipCard";
import {
  CircleNotch,
  FileArrowUp,
  FileText,
  Globe,
  Image as ImageIcon,
  ListChecks,
  Paperclip,
  PresentationChart,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import ScopePanel from "@/components/ScopePanel";
import ChatColumn from "@/components/stage/ChatColumn";
import StartOverButton from "@/components/stage/StartOverButton";
import StageLayout from "@/components/stage/StageLayout";
import {
  api,
  type ChatFile,
  type ScopeArtifact,
  type SourceDoc,
  type StageInfo,
} from "@/lib/api";
import { useStageRun } from "@/lib/useStageRun";

const STAGE = "01-scope";

const DOC_ACCEPT = ".pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp,.txt,.md";
const DOC_ICON = {
  pdf: FileText,
  word: FileText,
  slides: PresentationChart,
  image: ImageIcon,
  text: FileText,
  other: FileText,
  link: Globe,
};
const URL_PATTERN = /https?:\/\/[^\s<>"'()]+/gi;

/** "https://www.example.com/menu/" -> "example.com/menu" */
function shortUrl(url: string) {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, "") + u.pathname).replace(/\/$/, "");
  } catch {
    return url;
  }
}

const EXAMPLES = [
  "I run a small coffee shop. I want people to see our menu and reserve a table.",
  "We're a family-run hair salon and want customers to book appointments online.",
  "I sell handmade ceramics and want a simple online shop with delivery.",
];

export default function ScopeStage({
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
  const [artifact, setArtifact] = useState<ScopeArtifact | null>(null);
  const [busy, setBusy] = useState(false);
  const loadArtifact = useCallback(() => {
    api.getScope(projectId).then(setArtifact);
  }, [projectId]);
  useEffect(loadArtifact, [loadArtifact]);

  const run = useStageRun({
    projectId,
    stageKey: STAGE,
    activeRunId,
    onArtifactChange: loadArtifact,
    onDone: onStageChange,
  });
  const approved = stage.status === "approved";

  // The owner's own documents (menu, price list, brochure...) that Claude reads for the plan.
  const [docs, setDocs] = useState<SourceDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [unread, setUnread] = useState<string[]>([]);
  // A website being opened from a link in the owner's message (before the message goes to Gagesite).
  const [reading, setReading] = useState<string | null>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    api
      .listSources(projectId)
      .then(setDocs)
      .catch(() => setDocs([]));
  }, [projectId]);

  async function upload(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    const added: string[] = [];
    try {
      for (const file of files)
        added.push((await api.uploadSource(projectId, file)).file);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
      setDocs(await api.listSources(projectId).catch(() => docs));
      if (added.length) setUnread((u) => [...new Set([...u, ...added])]);
    }
  }

  async function removeDoc(file: string) {
    try {
      setDocs(await api.deleteSource(projectId, file));
      setUnread((u) => u.filter((f) => f !== file));
    } catch (e) {
      setUploadError((e as Error).message);
    }
  }

  /** Sends a message; links in it are opened first (the plan's AI can't browse), with progress shown here. */
  async function send(text: string, files: ChatFile[] = []) {
    const known = new Set(docs.map((d) => d.url).filter(Boolean));
    const urls = [
      ...new Set(
        (text.match(URL_PATTERN) ?? []).map((u) =>
          u.replace(/[.,;:!?)\]}]+$/, ""),
        ),
      ),
    ].filter((u) => !known.has(u));
    if (urls.length) {
      setUploadError(null);
      for (const url of urls.slice(0, 2)) {
        setReading(shortUrl(url));
        try {
          await api.addSourceLink(projectId, url);
        } catch (e) {
          setUploadError(
            `Couldn't open ${shortUrl(url)}: ${(e as Error).message}`,
          );
        }
      }
      setReading(null);
      setDocs(await api.listSources(projectId).catch(() => docs));
    }
    return run.send(text, files);
  }

  async function askToRead() {
    const names = unread.join(", ");
    const one = unread.length === 1;
    if (
      await run.send(
        `I added ${names}. Please read ${one ? "it" : "them"} and use what's in ${one ? "it" : "them"} for the plan.`,
      )
    ) {
      setUnread([]);
    }
  }

  const attach = !approved && (
    <>
      <button
        type="button"
        onClick={() => attachRef.current?.click()}
        disabled={uploading || run.running}
        aria-label="Add a document to the plan"
        title="Add a document for the plan to keep (menu, price list, brochure...). To show Gagesite something just for this message, use the paperclip."
        className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-accent-soft hover:text-accent disabled:opacity-40"
      >
        {uploading ? (
          <CircleNotch size={18} className="animate-spin" />
        ) : (
          <FileArrowUp size={18} />
        )}
      </button>
      <input
        ref={attachRef}
        type="file"
        multiple
        accept={DOC_ACCEPT}
        className="hidden"
        onChange={(e) => {
          upload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </>
  );

  const notice =
    docs.length > 0 || uploadError || reading ? (
      <div className="mb-2 space-y-2">
        {docs.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Your documents">
            {docs.map((d) => {
              const Icon = DOC_ICON[d.kind] ?? FileText;
              const unreadable = d.text_ready === false;
              const label =
                d.kind === "link" && d.url ? shortUrl(d.url) : d.file;
              return (
                <span
                  key={d.file}
                  title={
                    unreadable
                      ? "Couldn't read the text in this file. Save it as a PDF and add it again."
                      : d.kind === "link"
                        ? `Website read by Gagesite: ${d.title ? `${d.title}, ` : ""}${d.url}`
                        : d.file
                  }
                  className={`inline-flex max-w-[16rem] items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${
                    unreadable
                      ? "border-danger/40 bg-danger-soft text-danger"
                      : "border-line bg-surface text-muted"
                  }`}
                >
                  <Icon size={13} className="shrink-0" />
                  <span className="truncate">{label}</span>
                  {!approved && (
                    <button
                      type="button"
                      onClick={() => removeDoc(d.file)}
                      disabled={run.running}
                      aria-label={`Remove ${label}`}
                      className="shrink-0 text-faint hover:text-danger disabled:opacity-40"
                    >
                      <X size={11} weight="bold" />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}
        {reading && (
          <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm text-accent-ink">
            <CircleNotch
              size={16}
              className="shrink-0 animate-spin text-accent"
            />
            <span className="min-w-0 flex-1 truncate">
              Opening {reading}... This takes a few seconds.
            </span>
          </div>
        )}
        {(unread.length > 0 || uploadError) && (
          <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm">
            <Paperclip size={16} className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate text-accent-ink">
              {uploadError ?? `Added ${unread.join(", ")}`}
            </span>
            {!uploadError && (
              <button
                onClick={askToRead}
                disabled={run.running}
                className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-40"
              >
                Ask Gagesite to read {unread.length === 1 ? "it" : "them"}
              </button>
            )}
            <button
              onClick={() => {
                setUnread([]);
                setUploadError(null);
              }}
              aria-label="Dismiss"
              className="text-accent-ink/60 hover:text-accent-ink"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    ) : null;

  async function act(action: "approve" | "reopen") {
    setBusy(true);
    run.setError(null);
    try {
      await (action === "approve"
        ? api.approve(projectId, STAGE)
        : api.reopen(projectId, STAGE));
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
      chatBusy={run.running}
      panelLabel="Plan"
      panelIcon={ListChecks}
      chat={
        <ChatColumn
          projectId={projectId}
          title="Feature analysis"
          subtitle="Tell Gagesite about your business. It writes the plan as you talk."
          messages={run.messages}
          live={run.live}
          error={run.error}
          approved={approved}
          placeholder="Describe your business, answer Gagesite's questions, or paste a link to a website..."
          onSend={send}
          onStop={run.stop}
          stopping={run.stopping}
          composerAccessory={attach}
          notice={notice}
          headerAction={
            run.messages.length > 0 || artifact?.exists ? (
              <StartOverButton
                projectId={projectId}
                stageKey={STAGE}
                stageName="the feature analysis"
                approved={approved}
                cleared="The plan, its flowchart and this conversation"
                kept="The documents and links you added, and your keys"
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
            <Welcome
              onPick={send}
              onAttach={approved ? undefined : () => attachRef.current?.click()}
            />
          }
        />
      }
      panel={
        <ScopePanel
          artifact={artifact}
          approved={approved}
          approvedAt={stage.approved_at}
          running={run.running}
          busy={busy}
          onApprove={() => act("approve")}
          onReopen={() => act("reopen")}
          onSaveDetails={async (details) =>
            setArtifact(await api.saveScopeDetails(projectId, details))
          }
          projectId={projectId}
          onUploadContent={async (index, item, files) =>
            setArtifact(
              await api.uploadContentFiles(projectId, index, item, files),
            )
          }
          onChooseContent={async (index, item, status) =>
            setArtifact(await api.chooseContent(projectId, index, item, status))
          }
          footer={
            approved ? undefined : (
              <LandingSkipCard
                projectId={projectId}
                disabled={busy || run.running}
                className="mx-6 mb-6 mt-2"
              />
            )
          }
        />
      }
    />
  );
}

function Welcome({
  onPick,
  onAttach,
}: {
  onPick: (text: string) => void;
  onAttach?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-7">
      <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Sparkle size={22} weight="fill" />
      </span>
      <h2 className="mt-4 font-display text-xl font-bold tracking-tight">
        Start with a sentence or two
      </h2>
      <p className="mt-1.5 max-w-[56ch] text-[15px] leading-relaxed text-muted">
        What does your business do, and what should the website help with?
        Gagesite asks a few questions and fills in the plan as you go.
      </p>
      <div className="mt-5 grid gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            onClick={() => onPick(example)}
            className="rounded-xl bg-surface-2 px-4 py-3 text-left text-sm transition hover:bg-accent-soft hover:text-accent-ink active:scale-[0.99]"
          >
            {example}
          </button>
        ))}
      </div>
      {onAttach && (
        <button
          type="button"
          onClick={onAttach}
          className="mt-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3 text-left text-sm text-muted transition hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
        >
          <Paperclip size={18} className="shrink-0 text-accent" />
          <span>
            <span className="font-medium text-ink">
              Have a menu, price list or brochure?
            </span>{" "}
            Add it (PDF, Word, PowerPoint or a photo) and Gagesite reads it, so
            you type less. Already have a website, or like someone else&apos;s?
            Paste its link in the chat.
          </span>
        </button>
      )}
    </div>
  );
}
