"use client";

import {
  CaretRight,
  FileText,
  Globe,
  ListChecks,
  MagnifyingGlass,
  PencilSimple,
  TerminalWindow,
  UsersThree,
  Wrench,
} from "@phosphor-icons/react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReplyStep } from "@/lib/api";

/**
 * Splits an AI reply the way Claude shows one: the work (notes it wrote along the way and the tools
 * it used) folds away, and only the final answer, the words after its last tool, stays open.
 */
export function splitReply(steps: ReplyStep[], live = false) {
  const label = steps.find((s) => s.t === "label")?.text ?? null;
  const body = steps.filter((s) => s.t !== "label" && !(s.t === "text" && !s.text.trim()));
  let lastTool = -1;
  body.forEach((s, i) => {
    if (s.t === "tool") lastTool = i;
  });
  let work = body.slice(0, lastTool + 1);
  let answer = body.slice(lastTool + 1);
  // Finished without words after its last tool: its last note is the answer.
  if (!live && !answer.length) {
    const lastText = work.map((s) => s.t).lastIndexOf("text");
    if (lastText >= 0) {
      answer = [work[lastText]];
      work = work.filter((_, i) => i !== lastText);
    }
  }
  const text = answer.map((s) => (s.t === "text" ? s.text.trim() : "")).join("\n\n");
  return { label, work, answer: text };
}

type ToolStep = Extract<ReplyStep, { t: "tool" }>;
/** One described step: a note it wrote ("Now the board component.") and the tools it used after it. */
type Row = { note: string | null; tools: ToolStep[] };

function groupRows(steps: ReplyStep[]): Row[] {
  const rows: Row[] = [];
  for (const step of steps) {
    if (step.t === "text") rows.push({ note: step.text.trim(), tools: [] });
    else if (step.t === "tool") {
      if (!rows.length) rows.push({ note: null, tools: [] });
      rows[rows.length - 1].tools.push(step);
    }
  }
  return rows;
}

const KIND: Record<string, "read" | "edit" | "run" | "search" | "web"> = {
  Read: "read",
  Write: "edit",
  Edit: "edit",
  MultiEdit: "edit",
  NotebookEdit: "edit",
  Bash: "run",
  PowerShell: "run",
  Glob: "search",
  Grep: "search",
  WebSearch: "web",
  WebFetch: "web",
};

/** "Read 14 files, edited 6 files, ran 5 commands": what a set of tool calls did, in plain words. */
function summarise(tools: ToolStep[]) {
  const n: Record<string, number> = {};
  for (const t of tools) n[KIND[t.name] ?? "other"] = (n[KIND[t.name] ?? "other"] ?? 0) + 1;
  const s = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const parts = [
    n.read && `read ${s(n.read, "file", "files")}`,
    n.edit && `edited ${s(n.edit, "file", "files")}`,
    n.run && `ran ${s(n.run, "command", "commands")}`,
    n.search && `searched ${n.search === 1 ? "once" : `${n.search} times`}`,
    n.web && `looked at ${s(n.web, "web page", "web pages")}`,
    n.other && s(n.other, "other step", "other steps"),
  ].filter(Boolean) as string[];
  const text = parts.join(", ");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

/** A note's first sentence, without markdown, as a step's title. */
function firstSentence(note: string) {
  const plain = note.replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();
  const end = plain.search(/[.!?](\s|$)/);
  const sentence = end > 0 ? plain.slice(0, end + 1) : plain;
  return sentence.length > 140 ? `${sentence.slice(0, 137)}...` : sentence;
}

/**
 * The work behind a reply, folded the way Claude shows it: one line saying what was done
 * ("Read 14 files, edited 6 files, ran 5 commands"). Open, a short list of described steps,
 * each of which opens again to show the exact files and commands.
 */
export function StepsFold({ steps, live = false, status }: { steps: ReplyStep[]; live?: boolean; status?: string }) {
  const [open, setOpen] = useState(false);
  const tools = steps.filter((s): s is ToolStep => s.t === "tool");
  const rows = groupRows(steps);
  if (!steps.length && !live) return null;
  const done = summarise(tools);
  const title = live ? [status || "Working on it...", done.toLowerCase()].filter(Boolean).join(" · ") : done || "Worked it out";
  const current = live ? tools[tools.length - 1] : undefined;

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={!steps.length}
        aria-expanded={open}
        className="group flex max-w-full items-baseline gap-1.5 rounded-lg py-0.5 text-muted transition hover:text-ink disabled:hover:text-muted"
      >
        {live && (
          <span className="relative mr-0.5 flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
        )}
        <span className="text-left">
          {title}
          {!!steps.length && (
            <CaretRight size={12} className={`ml-1 inline align-[-1px] transition-transform ${open ? "rotate-90" : ""}`} />
          )}
        </span>
      </button>
      {/* While working and folded: just the latest tool, so it's clear something is happening. */}
      {live && !open && current && (
        <p className="mt-0.5 truncate pl-3.5 text-xs text-faint">{describeTool(current.name, current.summary).text}</p>
      )}
      {open && (
        <ol className="mt-2 overflow-hidden rounded-xl border border-line bg-surface">
          {rows.map((row, i) => (
            <StepRow key={i} row={row} />
          ))}
        </ol>
      )}
    </div>
  );
}

/** One described step: its title; open it for the rest of the note and each file or command. */
function StepRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const title = row.note ? firstSentence(row.note) : summarise(row.tools);
  const more = !!row.tools.length || (!!row.note && firstSentence(row.note).length < row.note.replace(/\s+/g, " ").length - 2);
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={!more}
        aria-expanded={open}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-[13px] text-ink transition hover:bg-surface-2/60 disabled:hover:bg-transparent"
      >
        <span className="min-w-0 flex-1 leading-snug">{title}</span>
        {more && <CaretRight size={12} className={`mt-1 shrink-0 text-faint transition-transform ${open ? "rotate-90" : ""}`} />}
      </button>
      {open && (
        <div className="space-y-1.5 px-3 pb-3">
          {row.note && row.note.replace(/\s+/g, " ").length > title.length + 2 && (
            <div className="prose-doc text-[13px] text-muted">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{row.note}</ReactMarkdown>
            </div>
          )}
          {row.tools.map((t, i) => (
            <ToolLine key={i} name={t.name} summary={t.summary} />
          ))}
        </div>
      )}
    </li>
  );
}

function ToolLine({ name, summary }: { name: string; summary: string }) {
  const { Icon, text, detail } = describeTool(name, summary);
  return (
    <div className="flex items-center gap-2.5 text-[13px] text-muted" title={detail || undefined}>
      <Icon size={14} className="shrink-0 text-faint" />
      <span className="min-w-0 truncate">{text}</span>
    </div>
  );
}

/** A tool call in plain words: "Edited page.tsx", "Searched the web for ...". */
function describeTool(name: string, summary: string) {
  const target = summary.startsWith(name) ? summary.slice(name.length).trim() : summary;
  const short = target.length > 80 ? `${target.slice(0, 77)}...` : target;
  switch (name) {
    case "Read":
      return { Icon: FileText, text: `Read ${short}`, detail: target };
    case "Write":
      return { Icon: PencilSimple, text: `Wrote ${short}`, detail: target };
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return { Icon: PencilSimple, text: `Edited ${short}`, detail: target };
    case "Glob":
    case "Grep":
      return { Icon: MagnifyingGlass, text: short ? `Searched the files for ${short}` : "Searched the files", detail: target };
    case "WebSearch":
      return { Icon: Globe, text: `Searched the web for "${short}"`, detail: target };
    case "WebFetch": {
      let host = target;
      try {
        host = new URL(target).host;
      } catch {}
      return { Icon: Globe, text: `Opened ${host}`, detail: target };
    }
    case "Bash":
    case "PowerShell":
      return { Icon: TerminalWindow, text: short ? `Ran ${short}` : "Ran a command", detail: target };
    case "TodoWrite":
      return { Icon: ListChecks, text: "Updated its to-do list", detail: "" };
    case "Task":
    case "Agent":
      return { Icon: UsersThree, text: "Asked a helper", detail: target };
    default:
      return { Icon: Wrench, text: summary || name, detail: target };
  }
}
