"use client";

import {
  ArrowUp,
  CircleNotch,
  File as FileIcon,
  FilePdf,
  FileText,
  Paperclip,
  Sparkle,
  Square,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, messageFiles, messageSteps, type ChatFile, type Message, type ReplyStep } from "@/lib/api";
import { splitReply, StepsFold } from "@/components/stage/ReplySteps";
import { mergeTasks, TaskList, threadItems } from "@/components/stage/TaskThread";
import type { TeamTask } from "@/lib/api";

/** What can be attached to a message: images and screenshots, PDFs, text, Word and PowerPoint. */
const ATTACH_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,.pdf,.txt,.md,.csv,.json,.log,.docx,.pptx";
const MAX_FILES = 10;

type Pending = {
  key: string;
  name: string;
  /** A local preview of an image, while it uploads and after. */
  preview: string | null;
  state: "uploading" | "ready" | "failed";
  file?: ChatFile;
  error?: string;
};
import type { LiveTurn } from "@/lib/useStageRun";
import type { LiveGroup } from "@/lib/useTeamLive";

export default function ChatColumn({
  title,
  subtitle,
  messages,
  live,
  error,
  approved,
  placeholder,
  emptyState,
  composerAccessory,
  notice,
  headerAction,
  onSend,
  onStop,
  stopping = false,
  projectId,
  liveGroups,
  tasks,
}: {
  /** Team builds: the task board, so each task's replies gather in one card. */
  tasks?: TeamTask[];
  title: string;
  subtitle: string;
  messages: Message[];
  live: LiveTurn | null;
  /** Team builds: every agent at work right now, shown one per task instead of `live`. */
  liveGroups?: LiveGroup[];
  error: string | null;
  approved: boolean;
  placeholder: string;
  /** Shown instead of the conversation before the first message. */
  emptyState: React.ReactNode;
  /** Extra control next to the send button (e.g. attach a file). */
  composerAccessory?: React.ReactNode;
  /** A short prompt shown just above the composer (e.g. "file uploaded, tell Claude"). */
  notice?: React.ReactNode;
  /** A small control at the top right while Gagesite is idle (e.g. "Start over"). */
  headerAction?: React.ReactNode;
  onSend: (text: string, files?: ChatFile[]) => Promise<boolean>;
  /** Lets the owner attach files to a message (button, paste a screenshot, or drop files). */
  projectId?: string;
  /** Ends the run Gagesite is working on (the send button becomes Stop while it works). */
  onStop?: () => void;
  stopping?: boolean;
}) {
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const running = live !== null;
  const canAttach = !!projectId && !approved;
  const uploading = pending.some((p) => p.state === "uploading");
  const ready = pending.filter((p) => p.state === "ready" && p.file).map((p) => p.file!);

  function attach(files: File[]) {
    if (!projectId || !files.length) return;
    const room = MAX_FILES - pending.length;
    for (const file of files.slice(0, Math.max(0, room))) {
      const key = `${Date.now()}-${Math.random()}`;
      const name = file.name || "screenshot.png";
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      setPending((p) => [...p, { key, name, preview, state: "uploading" }]);
      api
        .uploadChatFile(projectId, file)
        .then((saved) => setPending((p) => p.map((x) => (x.key === key ? { ...x, state: "ready", file: saved } : x))))
        .catch((e: Error) =>
          setPending((p) => p.map((x) => (x.key === key ? { ...x, state: "failed", error: e.message } : x))),
        );
    }
  }

  function removePending(key: string) {
    setPending((p) => {
      const gone = p.find((x) => x.key === key);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return p.filter((x) => x.key !== key);
    });
  }

  // Grow with the text (up to the max height in its class), so a long message stays readable.
  useEffect(() => {
    const box = textarea.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
  }, [input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, live?.text, live?.steps.length, liveGroups?.length]);

  async function submit() {
    const text = input;
    if ((!text.trim() && !ready.length) || running || uploading) return;
    const sent = pending;
    setInput("");
    setPending([]);
    if (!(await onSend(text, ready))) {
      setInput(text);
      setPending(sent);
    } else {
      sent.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
    }
  }

  return (
    <section className="relative flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-4 px-6 pb-2 pt-5">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight">{title}</h1>
          <p className="truncate text-[13px] text-muted">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {running && (
            <span className="hidden items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-ink sm:flex">
              <LiveDot />
              Gagesite is working
            </span>
          )}
          {!running && headerAction}
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto max-w-[680px] space-y-5 pt-3">
          {messages.length === 0 && !running && emptyState}

          {tasks?.length ? (
            // A team build: each task's runs gathered in one card, in the order the tasks started.
            <>
              {mergeTasks(threadItems(messages, tasks, liveGroups ?? [])).map((item) =>
                item.kind === "tasks" ? (
                  <div key={`tasks-${item.items[0].id}`} className="flex gap-3">
                    <Avatar />
                    <div className="min-w-0 flex-1 pt-1">
                      <TaskList items={item.items} tasks={tasks} />
                    </div>
                  </div>
                ) : item.kind === "live" ? (
                  <LiveReply key={item.group.runId} label={`**${item.group.label}**`} steps={item.group.steps} status={item.group.status} />
                ) : (
                  <ChatMessage
                    key={item.message.id}
                    role={item.message.role}
                    text={item.message.content}
                    files={messageFiles(item.message)}
                    steps={messageSteps(item.message)}
                    projectId={projectId}
                  />
                ),
              )}
              {!liveGroups?.length && live && <LiveReply steps={live.steps} status={live.status} />}
            </>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  text={message.content}
                  files={messageFiles(message)}
                  steps={messageSteps(message)}
                  projectId={projectId}
                />
              ))}
              {/* One folded line per agent at work, headed by its task. */}
              {liveGroups?.length
                ? liveGroups.map((g) => <LiveReply key={g.runId} label={`**${g.label}**`} steps={g.steps} status={g.status} />)
                : live && <LiveReply steps={live.steps} status={live.status} />}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* The composer sits below the conversation (never over it), so notices and errors above it
          push the conversation up instead of covering it. The fade softens the edge. */}
      <div className="relative shrink-0 bg-canvas px-6 pb-4 pt-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-canvas to-transparent"
        />
        <div className="mx-auto max-w-[680px]">
          {error && <p className="mb-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          {notice}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            onDragOver={(e) => {
              if (!canAttach || !e.dataTransfer.types.includes("Files")) return;
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
            }}
            onDrop={(e) => {
              if (!canAttach) return;
              e.preventDefault();
              setDragging(false);
              attach(Array.from(e.dataTransfer.files));
            }}
            className={`relative rounded-2xl border bg-surface p-2 shadow-[0_12px_40px_-16px_rgba(34,102,212,0.35)] transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft ${
              dragging ? "border-accent ring-4 ring-accent-soft" : "border-line-strong"
            }`}
          >
            {dragging && (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl bg-accent-soft/80 text-sm font-medium text-accent-ink">
                Drop files to attach them
              </div>
            )}
            {pending.length > 0 && (
              <ul className="flex flex-wrap gap-2 px-1.5 pb-1 pt-1" aria-label="Attached files">
                {pending.map((p) => (
                  <li
                    key={p.key}
                    title={p.error ?? p.name}
                    className={`relative flex h-14 max-w-[220px] items-center gap-2 overflow-hidden rounded-xl border pr-7 text-xs ${
                      p.state === "failed" ? "border-danger/40 bg-danger-soft text-danger" : "border-line bg-surface-2"
                    }`}
                  >
                    {p.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.preview} alt="" className="h-full w-14 shrink-0 object-cover" />
                    ) : (
                      <span className="grid h-full w-11 shrink-0 place-items-center bg-surface text-muted">
                        <KindIcon name={p.name} />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{p.name}</span>
                      <span className="block truncate text-faint">
                        {p.state === "uploading" ? "Adding..." : p.state === "failed" ? p.error : "Ready"}
                      </span>
                    </span>
                    {p.state === "uploading" ? (
                      <CircleNotch size={14} className="absolute right-2 top-2 animate-spin text-muted" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => removePending(p.key)}
                        aria-label={`Remove ${p.name}`}
                        className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-surface text-muted shadow-sm transition hover:text-danger"
                      >
                        <X size={11} weight="bold" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <label htmlFor="chat-input" className="sr-only">
              Your message
            </label>
            <textarea
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={(e) => {
                // A screenshot copied to the clipboard (or files copied in a folder) becomes an attachment.
                const files = Array.from(e.clipboardData.files);
                if (canAttach && files.length) {
                  e.preventDefault();
                  attach(files);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              ref={textarea}
              disabled={approved}
              rows={2}
              placeholder={approved ? "This step is approved. Reopen it to make changes." : placeholder}
              className="block max-h-[min(40vh,320px)] min-h-[3.5rem] w-full resize-none overflow-y-auto bg-transparent px-3 pb-1 pt-2 text-[15px] leading-[1.6] text-ink outline-none transition-[height] duration-150 [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin] placeholder:text-faint disabled:cursor-not-allowed"
            />
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-line/70 px-1.5 pt-2">
              <div className="flex min-w-0 items-center gap-2">
                {canAttach && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      disabled={pending.length >= MAX_FILES}
                      aria-label="Attach files"
                      title="Attach a screenshot, image, PDF or text file (you can also paste or drop them here)"
                      className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-accent-soft hover:text-accent disabled:opacity-40"
                    >
                      <Paperclip size={18} />
                    </button>
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      accept={ATTACH_ACCEPT}
                      className="hidden"
                      onChange={(e) => {
                        attach(Array.from(e.target.files ?? []));
                        e.target.value = "";
                      }}
                    />
                  </>
                )}
                {composerAccessory}
                <span className="hidden truncate text-xs text-faint sm:inline">Enter to send, Shift + Enter for a new line</span>
              </div>
              {running && onStop ? (
                <button
                  type="button"
                  onClick={onStop}
                  disabled={stopping}
                  aria-label="Stop Gagesite"
                  title="Stop. What Gagesite already wrote is kept."
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-xs font-semibold text-ink transition duration-200 hover:border-danger/40 hover:bg-danger-soft hover:text-danger active:scale-95 disabled:cursor-wait disabled:opacity-60 [animation:rise-in_160ms_ease-out]"
                >
                  {stopping ? (
                    <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                  ) : (
                    <Square size={12} weight="fill" />
                  )}
                  {stopping ? "Stopping..." : "Stop"}
                </button>
              ) : (
                <button
                  disabled={running || approved || uploading || (!input.trim() && !ready.length)}
                  aria-label="Send message"
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-white transition hover:bg-accent-hover active:scale-95 disabled:cursor-not-allowed disabled:bg-line-strong"
                >
                  <ArrowUp size={16} weight="bold" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

export function Avatar() {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-sky-400 text-white shadow-[0_4px_12px_-4px_rgba(34,102,212,0.6)]">
      <Sparkle size={13} weight="fill" />
    </span>
  );
}

export function LiveDot() {
  return (
    <span className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-accent" />
    </span>
  );
}

function KindIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return <FilePdf size={20} />;
  if (["txt", "md", "csv", "json", "log", "docx", "pptx"].includes(ext)) return <FileText size={20} />;
  return <FileIcon size={20} />;
}

/** The files sent with a message: images as thumbnails (open full size), other files as chips. */
function MessageFiles({ files, projectId }: { files: ChatFile[]; projectId?: string }) {
  if (!files.length || !projectId) return null;
  return (
    <div className="flex max-w-[85%] flex-wrap justify-end gap-2">
      {files.map((f) => {
        const url = api.chatFileUrl(projectId, f.file);
        return f.kind === "image" ? (
          <a key={f.file} href={url} target="_blank" rel="noreferrer" title={f.name} className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={f.name}
              className="h-24 max-w-[200px] rounded-xl border border-line object-cover transition hover:opacity-90"
            />
          </a>
        ) : (
          <a
            key={f.file}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex max-w-[220px] items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink transition hover:border-accent"
          >
            <span className="shrink-0 text-muted">
              <KindIcon name={f.name} />
            </span>
            <span className="truncate font-medium">{f.name}</span>
          </a>
        );
      })}
    </div>
  );
}

/** The reply being written: its work so far folded into one line, the answer streaming under it. */
function LiveReply({ steps, status, label: heading }: { steps: ReplyStep[]; status: string; label?: string }) {
  const split = splitReply(steps, true);
  const { work, answer } = split;
  const label = heading ?? split.label;
  return (
    <div className="flex gap-3">
      <Avatar />
      <div className="min-w-0 flex-1 space-y-2 pt-1" aria-live="polite">
        {label && (
          <div className="prose-doc text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{label}</ReactMarkdown>
          </div>
        )}
        <StepsFold steps={work} live status={answer ? "Writing the answer..." : status} />
        {answer && (
          <div className="prose-doc text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatMessage({
  role,
  text,
  files = [],
  steps = [],
  projectId,
}: {
  role: Message["role"];
  text: string;
  files?: ChatFile[];
  steps?: ReplyStep[];
  projectId?: string;
}) {
  const reduce = useReducedMotion();
  const enter = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
      };

  if (role === "user") {
    return (
      <motion.div {...enter} className="flex flex-col items-end gap-1.5">
        <MessageFiles files={files} projectId={projectId} />
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent-soft px-4 py-2.5 text-sm leading-relaxed text-ink">
          {text}
        </div>
      </motion.div>
    );
  }
  if (role === "error" && text.startsWith("Stopped.")) {
    // The owner pressed Stop: a calm note, not an error.
    return (
      <motion.div {...enter} className="flex items-center gap-2.5 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm text-muted">
        <Square size={12} weight="fill" className="shrink-0 text-faint" />
        <span className="break-words leading-relaxed">{text}</span>
      </motion.div>
    );
  }
  if (role === "error") {
    return (
      <motion.div {...enter} className="flex gap-2.5 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
        <WarningCircle size={18} className="mt-0.5 shrink-0" />
        <span className="break-words leading-relaxed">{text}</span>
      </motion.div>
    );
  }
  // Replies saved with their steps: the work folds away under "Took N steps", the answer stays open.
  // Older replies (saved before steps were kept) show as they were.
  const reply = steps.length ? splitReply(steps) : null;
  return (
    <motion.div {...enter} className="flex gap-3">
      <Avatar />
      {reply ? (
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          {reply.label && (
            <div className="prose-doc text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{reply.label}</ReactMarkdown>
            </div>
          )}
          <StepsFold steps={reply.work} />
          {reply.answer && (
            <div className="prose-doc text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{reply.answer}</ReactMarkdown>
            </div>
          )}
        </div>
      ) : (
        <div className="prose-doc min-w-0 flex-1 pt-0.5 text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      )}
    </motion.div>
  );
}
