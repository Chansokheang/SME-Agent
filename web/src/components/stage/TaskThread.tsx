"use client";

import { CaretRight } from "@phosphor-icons/react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { STATUS } from "@/components/build/TeamStrip";
import { splitReply, StepsFold } from "@/components/stage/ReplySteps";
import { messageSteps, type Message, type TeamTask } from "@/lib/api";
import type { LiveGroup } from "@/lib/useTeamLive";

/**
 * Team builds: the chat in task order. Each task's runs (built, tested, fixed, tested again) gather
 * in one card where the task first started; the owner's messages and the Advisor's notes stay as
 * they are, between the cards.
 */
export type ThreadItem =
  | { kind: "message"; message: Message }
  | { kind: "task"; id: string; title: string; messages: Message[]; live: LiveGroup[] }
  | { kind: "live"; group: LiveGroup };

/** "**UI Developer · Project board view**" -> who and on what. */
function parseLabel(text: string) {
  const inner = text.trim().replace(/^\*\*/, "").replace(/\*\*$/, "");
  const at = inner.indexOf(" · ");
  return at < 0 ? { name: inner, title: "" } : { name: inner.slice(0, at), title: inner.slice(at + 3) };
}

/** A team reply's heading: from its saved steps, or the first line of older replies. */
function heading(message: Message) {
  const label = messageSteps(message).find((s) => s.t === "label");
  if (label && label.t === "label") return { ...parseLabel(label.text), task: label.task || "" };
  const first = message.content.split("\n", 1)[0];
  if (!/^\*\*.+\*\*$/.test(first.trim())) return null;
  return { ...parseLabel(first), task: "" };
}

export function threadItems(messages: Message[], tasks: TeamTask[], live: LiveGroup[]): ThreadItem[] {
  const byTitle = new Map(tasks.map((t) => [t.title, t.id]));
  const items: ThreadItem[] = [];
  const cards = new Map<string, Extract<ThreadItem, { kind: "task" }>>();
  const card = (id: string, title: string) => {
    let c = cards.get(id);
    if (!c) {
      c = { kind: "task", id, title: tasks.find((t) => t.id === id)?.title || title, messages: [], live: [] };
      cards.set(id, c);
      items.push(c);
    }
    return c;
  };
  for (const message of messages) {
    const h = message.role === "assistant" ? heading(message) : null;
    const id = h ? h.task || byTitle.get(h.title) || "" : "";
    if (h && id) card(id, h.title).messages.push(message);
    else items.push({ kind: "message", message });
  }
  for (const group of live) {
    const title = parseLabel(group.label).title;
    const id = group.task || byTitle.get(title) || "";
    if (id) card(id, title).live.push(group);
    else items.push({ kind: "live", group });
  }
  return items;
}

/** One task: folded to a line (number, title, status, runs); open, each run with its own folded steps. */
export function TaskCard({
  item,
  task,
}: {
  item: Extract<ThreadItem, { kind: "task" }>;
  task?: TeamTask;
}) {
  const working = item.live.length > 0;
  const [open, setOpen] = useState<boolean | null>(null);
  // Open while an agent works on it, folded once it moves on, unless the owner opened or closed it.
  const isOpen = open ?? working;
  const status = task ? STATUS[task.status] : null;
  const runs = item.messages.length + item.live.length;

  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition hover:bg-surface-2/60"
      >
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{item.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-faint">
            <span className="tabular-nums">{item.id}</span>
            {status && (
              <span className={`flex items-center gap-1.5 ${status.text}`}>
                <span className={`size-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            )}
            <span>
              {runs} run{runs === 1 ? "" : "s"}
            </span>
          </span>
        </span>
        <CaretRight size={12} className={`mt-1 shrink-0 text-faint transition-transform ${isOpen ? "rotate-90" : ""}`} />
      </button>
      {/* Folded and working: who is at it and what it's doing now. */}
      {!isOpen && working && (
        <div className="px-3 pb-3">
          {item.live.map((g) => (
            <LiveRun key={g.runId} group={g} />
          ))}
        </div>
      )}
      {isOpen && (
        <ol className="mx-3 mb-3 divide-y divide-line rounded-lg bg-surface-2/50">
          {item.messages.map((m) => (
            <li key={m.id} className="px-3 py-2.5">
              <SavedRun message={m} />
            </li>
          ))}
          {item.live.map((g) => (
            <li key={g.runId} className="px-3 py-2.5">
              <LiveRun group={g} />
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

type TaskItem = Extract<ThreadItem, { kind: "task" }>;

/**
 * Tasks worked on one after another, folded into one line like Claude's "Ran 3 commands":
 * "Worked on 16 tasks · all passed ›". Open, one row per task; open a task for its runs.
 */
export function TaskList({ items, tasks }: { items: TaskItem[]; tasks: TeamTask[] }) {
  const working = items.some((i) => i.live.length > 0);
  const [open, setOpen] = useState<boolean | null>(null);
  const isOpen = open ?? working;
  const statuses = items.map((i) => tasks.find((t) => t.id === i.id)?.status);
  const counts = new Map<string, number>();
  for (const s of statuses) if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  const passed = counts.get("passed") ?? 0;
  const summary =
    passed === items.length
      ? items.length === 1
        ? "passed"
        : "all passed"
      : [...counts].map(([s, n]) => `${n} ${STATUS[s as keyof typeof STATUS].label.toLowerCase()}`).join(", ");
  const title = `${working ? "Working on" : "Worked on"} ${items.length} task${items.length === 1 ? "" : "s"}`;

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex max-w-full items-baseline gap-1.5 rounded-lg py-0.5 text-left text-muted transition hover:text-ink"
      >
        <span>
          {title}
          {summary && ` · ${summary}`}
          <CaretRight size={12} className={`ml-1 inline align-[-1px] transition-transform ${isOpen ? "rotate-90" : ""}`} />
        </span>
      </button>
      {isOpen && (
        <ol className="mt-2 overflow-hidden rounded-xl border border-line bg-surface">
          {items.map((item) => (
            <TaskCard key={item.id} item={item} task={tasks.find((t) => t.id === item.id)} />
          ))}
        </ol>
      )}
    </div>
  );
}

/** Back-to-back task items become one list; everything else stays as it is. */
export function mergeTasks(items: ThreadItem[]) {
  const out: (Exclude<ThreadItem, TaskItem> | { kind: "tasks"; items: TaskItem[] })[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (item.kind === "task") {
      if (last?.kind === "tasks") last.items.push(item);
      else out.push({ kind: "tasks", items: [item] });
    } else out.push(item);
  }
  return out;
}

function RoleName({ name }: { name: string }) {
  return <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{name}</p>;
}

function SavedRun({ message }: { message: Message }) {
  const steps = messageSteps(message);
  const h = heading(message);
  if (steps.length) {
    const { work, answer } = splitReply(steps);
    return (
      <div className="space-y-1.5">
        <RoleName name={h?.name ?? "Gagesite"} />
        <StepsFold steps={work} />
        {answer && (
          <div className="prose-doc text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>
        )}
      </div>
    );
  }
  // Saved before steps were kept: the reply without its heading line.
  const body = message.content.replace(/^\*\*.+\*\*\s*\n+/, "");
  return (
    <div>
      <RoleName name={h?.name ?? "Gagesite"} />
      <div className="prose-doc text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </div>
  );
}

function LiveRun({ group }: { group: LiveGroup }) {
  const { work, answer } = splitReply(group.steps, true);
  return (
    <div className="space-y-1.5">
      <RoleName name={parseLabel(group.label).name} />
      <StepsFold steps={work} live status={answer ? "Writing the answer..." : group.status} />
      {answer && (
        <div className="prose-doc text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
