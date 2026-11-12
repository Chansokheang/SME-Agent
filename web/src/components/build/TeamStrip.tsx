"use client";

import { ArrowClockwise, Bug, CaretDown, CheckCircle, Pause, Play, UsersThree } from "@phosphor-icons/react";
import { useState } from "react";
import type { TeamInfo, TeamTask, TeamTaskStatus } from "@/lib/api";

export const STATUS: Record<TeamTaskStatus, { label: string; dot: string; text: string }> = {
  todo: { label: "To do", dot: "bg-line-strong", text: "text-muted" },
  building: { label: "Building", dot: "bg-accent animate-pulse", text: "text-accent-ink" },
  built: { label: "Built, waiting for test", dot: "bg-accent", text: "text-accent-ink" },
  testing: { label: "Testing", dot: "bg-violet-500 animate-pulse", text: "text-violet-700" },
  passed: { label: "Passed", dot: "bg-emerald-500", text: "text-emerald-700" },
  bug_found: { label: "Bug found", dot: "bg-amber-500", text: "text-amber-800" },
  fixing: { label: "Fixing", dot: "bg-amber-500 animate-pulse", text: "text-amber-800" },
  blocked: { label: "Needs you", dot: "bg-danger", text: "text-danger" },
};

const STATE: Record<TeamInfo["state"], { label: string; className: string }> = {
  running: { label: "Working", className: "bg-accent-soft text-accent-ink" },
  paused: { label: "Paused", className: "bg-surface-2 text-muted" },
  blocked: { label: "Needs you", className: "bg-danger-soft text-danger" },
  done: { label: "Finished", className: "bg-emerald-50 text-emerald-800" },
  failed: { label: "Stopped", className: "bg-danger-soft text-danger" },
};

const DOING = {
  advisor: "Advisor is planning",
  dev: "Developer is building",
  api_dev: "API Developer is building",
  qa: "QA is testing",
} as const;

/** What one agent is doing; in a two-lane build the UI lane's developer is the "UI Developer". */
function doingText(agent: { role?: keyof typeof DOING; title?: string; lane?: string }): string {
  if (!agent.role) return "";
  const what =
    agent.role === "dev" && agent.lane === "ui"
      ? "UI Developer is building"
      : agent.role === "qa" && agent.lane
        ? `QA is testing the ${agent.lane === "api" ? "API" : "UI"}`
        : DOING[agent.role];
  return `${what}${agent.title ? `: ${agent.title}` : ""}`;
}

/** The agent team at a glance: progress, who is working on what, and the task list. */
export default function TeamStrip({
  team,
  busy,
  onPause,
  onResume,
}: {
  team: TeamInfo;
  busy: boolean;
  onPause: () => void;
  onResume: (retryBlocked: boolean) => void;
}) {
  const [open, setOpen] = useState(team.state !== "done");
  const passed = team.tasks.filter((t) => t.status === "passed").length;
  const total = team.tasks.length;
  // Two developers at once (UI + dedicated API): one line each; otherwise the one agent at work.
  const working = team.lanes?.length ? team.lanes : team.current.role ? [team.current] : [];
  const doing = working.map(doingText).filter(Boolean).join("  ·  ");
  const activeTasks = new Set(working.map((a) => a.task).filter(Boolean));

  return (
    <section className="mx-6 mb-3 rounded-2xl border border-line bg-surface [animation:rise-in_200ms_ease-out]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <UsersThree size={17} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            Agent team
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATE[team.state].className}`}>
              {STATE[team.state].label}
            </span>
            <span className="text-xs font-normal text-muted">
              {passed} of {total} task{total === 1 ? "" : "s"} passed
            </span>
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out"
              style={{ width: total ? `${(passed / total) * 100}%` : "0%" }}
            />
          </div>
        </div>
        {team.state === "running" ? (
          <ActionButton icon={Pause} label="Pause" onClick={onPause} disabled={busy} />
        ) : team.state === "blocked" ? (
          <ActionButton icon={ArrowClockwise} label="Try again" onClick={() => onResume(true)} disabled={busy} />
        ) : team.state !== "done" ? (
          <ActionButton icon={Play} label="Resume" onClick={() => onResume(false)} disabled={busy} />
        ) : null}
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? "Hide tasks" : "Show tasks"}
          className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <CaretDown size={15} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {(doing || team.message) && (
        <p className="border-t border-line px-4 py-2 text-xs text-muted" aria-live="polite">
          {doing && <span className="font-medium text-ink">{doing}</span>}
          {doing && team.message ? " · " : ""}
          {team.message}
          {team.inbox > 0 && ` · ${team.inbox} message${team.inbox === 1 ? "" : "s"} for the Advisor`}
        </p>
      )}

      {open && total > 0 && (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto border-t border-line">
          {team.tasks.map((task) => (
            <TaskRow key={task.id} task={task} maxAttempts={team.max_attempts} active={activeTasks.has(task.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TaskRow({ task, maxAttempts, active }: { task: TeamTask; maxAttempts: number; active: boolean }) {
  const [open, setOpen] = useState(false);
  const status = STATUS[task.status] ?? STATUS.todo;
  const openBugs = task.bugs.filter((b) => b.status === "open");
  return (
    <li className={active ? "bg-accent-soft/40" : ""}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition hover:bg-surface-2"
      >
        <span className={`size-2 shrink-0 rounded-full ${status.dot}`} />
        <span className="w-9 shrink-0 text-xs tabular-nums text-faint">{task.id}</span>
        {task.lane && (
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              task.lane === "api" ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700"
            }`}
            title={task.lane === "api" ? "Built by the API Developer" : "Built by the UI Developer"}
          >
            {task.lane === "api" ? "API" : "UI"}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{task.title}</span>
        {openBugs.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-800">
            <Bug size={12} />
            {openBugs.length}
          </span>
        )}
        {task.attempts > 0 && task.status !== "passed" && (
          <span className="text-xs text-faint">
            try {Math.min(task.attempts + 1, maxAttempts)} of {maxAttempts}
          </span>
        )}
        <span className={`shrink-0 text-xs font-medium ${status.text}`}>{status.label}</span>
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-3 pl-[4.25rem] text-xs leading-relaxed [animation:rise-in_160ms_ease-out]">
          {task.acceptance.length > 0 && (
            <div>
              <p className="font-semibold text-muted">Done when</p>
              <ul className="mt-1 space-y-0.5">
                {task.acceptance.map((a) => (
                  <li key={a} className="flex gap-1.5">
                    <CheckCircle
                      size={13}
                      className={`mt-0.5 shrink-0 ${task.status === "passed" ? "text-emerald-500" : "text-faint"}`}
                    />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {task.bugs.length > 0 && (
            <div>
              <p className="font-semibold text-muted">Problems found</p>
              <ul className="mt-1 space-y-1.5">
                {task.bugs.map((bug) => (
                  <li key={bug.id} className="rounded-lg bg-surface-2 px-2.5 py-1.5">
                    <p className="font-medium">
                      {bug.title}
                      <span className="ml-1.5 font-normal text-faint">
                        {bug.status === "open" ? "open" : bug.status === "verified" ? "checked again" : bug.status.replace("_", " ")}
                      </span>
                    </p>
                    {bug.actual && <p className="text-muted">Happens: {bug.actual}</p>}
                    {bug.expected && <p className="text-muted">Should: {bug.expected}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function ActionButton({
  icon: ButtonIcon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Pause;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-semibold transition duration-200 hover:border-accent hover:text-accent-ink active:scale-[0.98] disabled:opacity-50"
    >
      <ButtonIcon size={13} weight="bold" />
      {label}
    </button>
  );
}
