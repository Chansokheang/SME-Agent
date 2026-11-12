"use client";

import { useEffect, useRef, useState } from "react";
import { api, type ReplyStep, type RunEvent, type TeamInfo } from "@/lib/api";

const ROLE_LABEL = { advisor: "Advisor", dev: "Developer", api_dev: "API Developer", qa: "QA" } as const;

/** One agent at work in a team build: who, on which task, and its steps so far. */
export interface LiveGroup {
  runId: string;
  label: string;
  /** The task it works on (e.g. "T10"); none for the Advisor's planning. */
  task?: string;
  steps: ReplyStep[];
  status: string;
}

type Agent = { run_id?: string; role?: string; title?: string; task?: string; lane?: string };

function agentLabel(a: Agent) {
  const name = a.role === "dev" && a.lane === "ui" ? "UI Developer" : ROLE_LABEL[a.role as keyof typeof ROLE_LABEL] ?? "Gagesite";
  const task = a.title || a.task;
  return task ? `${name} · ${task}` : name;
}

function addText(steps: ReplyStep[], text: string): ReplyStep[] {
  const last = steps[steps.length - 1];
  if (last?.t === "text") return [...steps.slice(0, -1), { t: "text", text: last.text + text }];
  return [...steps, { t: "text", text }];
}

/**
 * A team build has up to two agents at work at once (an API and a UI developer, or QA in a lane).
 * Follows every one of their runs, so the chat shows one folded line per task instead of one long run.
 * `onRunDone` fires when one of them finishes (its reply is saved by then).
 */
export function useTeamLive(team: TeamInfo | null, onRunDone: () => void) {
  const [groups, setGroups] = useState<Record<string, LiveGroup>>({});
  const sources = useRef<Record<string, EventSource>>({});
  const doneRef = useRef(onRunDone);
  doneRef.current = onRunDone;

  const running = team?.state === "running";
  const agents: Agent[] = running ? (team?.lanes?.length ? team.lanes : team?.current?.run_id ? [team.current] : []) : [];
  const key = agents.map((a) => `${a.run_id}|${agentLabel(a)}`).join(",");

  useEffect(() => {
    const wanted = new Map(agents.filter((a) => a.run_id).map((a) => [a.run_id as string, a]));
    // New agents: follow their runs.
    for (const [runId, agent] of wanted) {
      if (sources.current[runId]) continue;
      const label = agentLabel(agent);
      setGroups((g) => ({ ...g, [runId]: { runId, label, task: agent.task || undefined, steps: [], status: "Getting started..." } }));
      const source = new EventSource(api.eventsUrl(runId));
      sources.current[runId] = source;
      const update = (fn: (g: LiveGroup) => LiveGroup) =>
        setGroups((all) => (all[runId] ? { ...all, [runId]: fn(all[runId]) } : all));
      const end = () => {
        source.close();
        delete sources.current[runId];
        setGroups((all) => {
          const rest = { ...all };
          delete rest[runId];
          return rest;
        });
        doneRef.current();
      };
      source.onmessage = (message) => {
        const event = JSON.parse(message.data) as RunEvent;
        switch (event.type) {
          case "started":
          case "init":
            update((g) => ({ ...g, status: "Thinking..." }));
            break;
          case "message_start":
            update((g) => ({
              ...g,
              steps: g.steps.length && g.steps[g.steps.length - 1].t === "text" ? [...g.steps, { t: "text", text: "" }] : g.steps,
            }));
            break;
          case "text_delta":
            update((g) => ({ ...g, steps: addText(g.steps, event.text), status: "Writing..." }));
            break;
          case "tool_use":
            update((g) => ({
              ...g,
              steps: [...g.steps, { t: "tool", name: event.name ?? "", summary: event.summary }],
              status: "Working on it...",
            }));
            break;
          case "done":
            end();
            break;
        }
      };
      source.onerror = end;
    }
    // Agents no longer listed (the team paused or moved on) keep streaming until their run ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Leaving the page: stop following.
  useEffect(
    () => () => {
      Object.values(sources.current).forEach((s) => s.close());
      sources.current = {};
    },
    [],
  );

  return Object.values(groups);
}
