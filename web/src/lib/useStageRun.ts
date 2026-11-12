"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ChatFile, type Message, type ReplyStep, type RunEvent } from "@/lib/api";

export interface LiveTurn {
  text: string;
  tools: string[];
  /** What it wrote and the tools it used, in order, as they stream in. */
  steps: ReplyStep[];
  status: string;
}

/** Streamed words go onto the text step being written, or start a new one after a tool call. */
function addText(steps: ReplyStep[], text: string): ReplyStep[] {
  const last = steps[steps.length - 1];
  if (last?.t === "text") return [...steps.slice(0, -1), { t: "text", text: last.text + text }];
  return [...steps, { t: "text", text }];
}

/**
 * Chat state for one stage: stored messages, the live streaming turn, and sending.
 * `onArtifactChange` fires whenever the stage's output files may have changed.
 */
export function useStageRun({
  projectId,
  stageKey,
  activeRunId,
  onArtifactChange,
  onDone,
}: {
  projectId: string;
  stageKey: string;
  activeRunId: string | null;
  onArtifactChange: () => void;
  onDone: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [live, setLive] = useState<LiveTurn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const runIdRef = useRef<string | null>(null);
  const [stopping, setStopping] = useState(false);

  const loadMessages = useCallback(
    () => api.getMessages(projectId, stageKey).then(setMessages),
    [projectId, stageKey],
  );

  const follow = useCallback(
    (runId: string) => {
      sourceRef.current?.close();
      runIdRef.current = runId;
      setStopping(false);
      setLive({ text: "", tools: [], steps: [], status: "Getting started..." });
      const source = new EventSource(api.eventsUrl(runId));
      sourceRef.current = source;
      const finish = () => {
        source.close();
        runIdRef.current = null;
        setStopping(false);
        onArtifactChange();
        loadMessages().finally(() => setLive(null));
      };

      source.onmessage = (message) => {
        const event = JSON.parse(message.data) as RunEvent;
        switch (event.type) {
          case "queued":
            setLive((t) => t && { ...t, status: "Waiting for another run to finish..." });
            break;
          case "started":
          case "init":
            setLive((t) => t && { ...t, status: "Thinking..." });
            break;
          case "message_start":
            // A new assistant message means the previous tool call finished: output files may have changed.
            onArtifactChange();
            // A new message also starts a new text step (so words from two messages don't run together).
            setLive(
              (t) =>
                t && {
                  ...t,
                  text: t.text && !t.text.endsWith("\n\n") ? t.text + "\n\n" : t.text,
                  steps: t.steps.length && t.steps[t.steps.length - 1].t === "text" ? [...t.steps, { t: "text", text: "" }] : t.steps,
                },
            );
            break;
          case "text_delta":
            setLive((t) => t && { ...t, text: t.text + event.text, steps: addText(t.steps, event.text), status: "Writing..." });
            break;
          case "tool_use":
            setLive(
              (t) =>
                t && {
                  ...t,
                  tools: [...t.tools, event.summary],
                  steps: [...t.steps, { t: "tool", name: event.name ?? "", summary: event.summary }],
                  status: "Working on it...",
                },
            );
            break;
          case "done":
            finish();
            onDone();
            break;
        }
      };
      // The stream ends when the run finishes; if it drops early, reload what was saved.
      source.onerror = finish;
    },
    [loadMessages, onArtifactChange, onDone],
  );

  useEffect(() => {
    loadMessages();
    if (activeRunId) follow(activeRunId);
    return () => sourceRef.current?.close();
    // Only on mount: activeRunId comes from the first project load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, stageKey]);

  // A run started somewhere else (another tab, the team build, a Resume): follow it too.
  useEffect(() => {
    if (activeRunId && activeRunId !== runIdRef.current && !live) follow(activeRunId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId]);

  // "Still working" is only true while it lasts: once the run ends (or new replies arrive), drop it.
  useEffect(() => {
    if (!live) setError((e) => (e?.startsWith("Gagesite is still working") ? null : e));
  }, [live, messages]);

  const send = useCallback(
    async (text: string, files: ChatFile[] = []) => {
      const content = text.trim();
      if ((!content && !files.length) || live) return false;
      setError(null);
      setMessages((m) => [
        ...m,
        {
          id: -Date.now(),
          role: "user",
          content: content || "Please look at the attached " + (files.length === 1 ? "file." : "files."),
          created_at: new Date().toISOString(),
          attachments: files.length ? JSON.stringify(files) : null,
        },
      ]);
      try {
        const { run_id } = await api.sendMessage(projectId, stageKey, content, files.map((f) => f.file));
        // A team build queues the message for its Advisor: no run of its own to follow.
        if (run_id) follow(run_id);
        else loadMessages();
        return true;
      } catch (e) {
        setError((e as Error).message);
        loadMessages();
        return false;
      }
    },
    [follow, live, loadMessages, projectId, stageKey],
  );

  /** End the run Gagesite is working on; what it already wrote is kept. */
  const stop = useCallback(async () => {
    const runId = runIdRef.current;
    if (!runId) return;
    setStopping(true);
    setLive((t) => t && { ...t, status: "Stopping..." });
    try {
      await api.stopRun(runId);
    } catch (e) {
      setStopping(false);
      setError((e as Error).message);
    }
  }, []);

  return {
    messages,
    live,
    running: live !== null,
    stopping,
    error,
    setError,
    send,
    stop,
    reload: loadMessages,
    follow,
  };
}
