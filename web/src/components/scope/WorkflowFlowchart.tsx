"use client";

import dagre from "@dagrejs/dagre";
import {
  ArrowClockwise,
  ArrowsOut,
  CircleNotch,
  FlowArrow,
  Question,
  Sparkle,
  Warning,
  X,
} from "@phosphor-icons/react";
import {
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Flowchart, type FlowchartInfo, type FlowchartNode } from "@/lib/api";

/*
 * Stage 1's workflow flowchart. The requirements come first (the chat); once the plan is ready the
 * owner asks Gagesite to analyse them, and an AI run writes docs/01-flowchart.json: the whole website
 * as one graph with steps, decision points and hand-offs. This file only draws it (dagre places the
 * boxes left to right; connectors are right-angle with rounded bends).
 */

const SIZE = {
  step: { w: 176, h: 76 },
  decision: { w: 120, h: 120 },
  start: { w: 148, h: 44 },
  end: { w: 148, h: 44 },
} as const;

type NodeData = { node: FlowchartNode };

function Handles() {
  return (
    <>
      <Handle id="l" type="target" position={Position.Left} className="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-transparent" />
      <Handle id="r" type="source" position={Position.Right} className="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-transparent" />
      <Handle id="bt" type="target" position={Position.Bottom} className="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-transparent" />
      <Handle id="bs" type="source" position={Position.Bottom} className="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-transparent" />
    </>
  );
}

function StepNode({ data }: NodeProps<Node<NodeData>>) {
  const { node } = data;
  const site = node.actor?.trim().toLowerCase() === "the site";
  return (
    <div
      title={[node.label, node.page && `On: ${node.page}`].filter(Boolean).join("\n")}
      className="flex flex-col justify-center rounded-md border border-line-strong bg-surface px-3 py-2"
      style={{ width: SIZE.step.w, height: SIZE.step.h }}
    >
      <Handles />
      <span
        className={`truncate text-[9.5px] font-semibold uppercase tracking-[0.08em] ${site ? "text-faint" : "text-accent-ink"}`}
      >
        {node.actor}
      </span>
      <span className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-4 text-ink">{node.label}</span>
      {node.page && <span className="mt-0.5 truncate text-[10.5px] text-faint">{node.page}</span>}
    </div>
  );
}

function DecisionNode({ data }: NodeProps<Node<NodeData>>) {
  const { w, h } = SIZE.decision;
  return (
    <div className="relative grid place-items-center" style={{ width: w, height: h }} title={data.node.label}>
      <Handles />
      <svg width={w} height={h} className="absolute inset-0" aria-hidden>
        <polygon
          points={`${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}`}
          fill="var(--color-accent-soft)"
          stroke="var(--color-accent)"
          strokeWidth={1}
        />
      </svg>
      <span className="relative line-clamp-3 w-[76px] text-center text-[11.5px] font-semibold leading-[14px] text-ink">
        {data.node.label}
      </span>
    </div>
  );
}

function TerminalNode({ data }: NodeProps<Node<NodeData>>) {
  const start = data.node.type === "start";
  return (
    <div
      className={`grid place-items-center rounded-full border px-4 text-center text-[12px] font-semibold leading-4 ${
        start ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink"
      }`}
      style={{ width: SIZE.start.w, height: SIZE.start.h }}
      title={data.node.label}
    >
      <Handles />
      <span className="line-clamp-2">{data.node.label}</span>
    </div>
  );
}

const nodeTypes = { step: StepNode, decision: DecisionNode, start: TerminalNode, end: TerminalNode };

function layout(chart: Flowchart) {
  const known = new Set(chart.nodes.map((n) => n.id));
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({ rankdir: "LR", nodesep: 36, ranksep: 72, edgesep: 20, marginx: 16, marginy: 16 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const n of chart.nodes) {
    const size = SIZE[n.type] ?? SIZE.step;
    graph.setNode(n.id, { width: size.w, height: size.h });
  }
  chart.edges.forEach((e, i) => {
    if (known.has(e.from) && known.has(e.to)) graph.setEdge(e.from, e.to, {}, String(i));
  });
  dagre.layout(graph);

  const nodes: Node<NodeData>[] = chart.nodes.map((n) => {
    const { x, y, width, height } = graph.node(n.id);
    return {
      id: n.id,
      type: SIZE[n.type] ? n.type : "step",
      position: { x: x - width / 2, y: y - height / 2 },
      data: { node: n },
      draggable: false,
      selectable: false,
    };
  });
  const xOf = new Map(nodes.map((n) => [n.id, n.position.x]));
  const edges: Edge[] = chart.edges
    .filter((e) => known.has(e.from) && known.has(e.to))
    .map((e, i) => {
      // Going back (a loop, "try again"): leave and enter from below, dashed, so it runs under the row.
      const back = (xOf.get(e.to) ?? 0) <= (xOf.get(e.from) ?? 0);
      const color = back ? "var(--color-accent)" : "var(--color-faint)";
      return {
        id: `${e.from}-${e.to}-${i}`,
        source: e.from,
        target: e.to,
        sourceHandle: back ? "bs" : "r",
        targetHandle: back ? "bt" : "l",
        type: "smoothstep",
        pathOptions: { borderRadius: 8, offset: back ? 28 : 16 },
        label: e.label || undefined,
        style: { stroke: color, strokeWidth: 1, strokeDasharray: back ? "5 4" : undefined },
        labelStyle: { fill: "var(--color-muted)", fontSize: 10, fontWeight: 600, letterSpacing: "0.04em" },
        labelBgStyle: { fill: "var(--color-surface)" },
        labelBgPadding: [5, 2] as [number, number],
        labelBgBorderRadius: 3,
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      };
    });
  return { nodes, edges };
}

function Chart({ chart, tall }: { chart: Flowchart; tall?: boolean }) {
  const { nodes, edges } = useMemo(() => layout(chart), [chart]);
  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-line bg-surface ${tall ? "h-full" : "h-[520px]"}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.25}
        maxZoom={1.6}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Controls showInteractive={false} className="!rounded-xl !border !border-line !shadow-sm" />
      </ReactFlow>
    </div>
  );
}

/** The flowchart across the whole window: on a laptop the plan panel is too narrow for it. */
function FullScreen({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How the whole site works"
      className="fixed inset-0 z-50 flex flex-col bg-canvas/95 p-4 backdrop-blur-sm sm:p-6"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold tracking-tight">How the whole site works</h3>
        <button
          onClick={onClose}
          autoFocus
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs font-medium transition hover:border-accent hover:text-accent-ink"
        >
          <X size={13} weight="bold" />
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export default function WorkflowFlowchart({
  projectId,
  details,
}: {
  projectId: string;
  /** More of the site map (who does what...), shown under the flowchart once it has been generated. */
  details?: React.ReactNode;
}) {
  const [info, setInfo] = useState<FlowchartInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [full, setFull] = useState(false);

  const load = useCallback(() => {
    api
      .getFlowchart(projectId)
      .then(setInfo)
      .catch(() => undefined);
  }, [projectId]);
  useEffect(() => load(), [load]);
  // While Gagesite works on it, check every few seconds.
  useEffect(() => {
    if (!info?.running) return;
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, [info?.running, load]);

  async function generate() {
    setStarting(true);
    setError(null);
    try {
      setInfo(await api.generateFlowchart(projectId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  if (!info) return <div className="h-40 animate-pulse rounded-xl bg-surface-2" aria-label="Loading flowchart" />;
  const chart = info.chart && Array.isArray(info.chart.nodes) && info.chart.nodes.length ? info.chart : null;
  const working = info.running || starting;

  const generateButton = (label: string, quiet?: boolean) => (
    <button
      onClick={generate}
      disabled={!info.can_generate || working}
      title={info.can_generate ? undefined : info.reason}
      className={
        quiet
          ? "inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1 text-xs font-medium text-muted transition hover:border-accent hover:text-accent-ink disabled:opacity-40"
          : "inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:opacity-40"
      }
    >
      {quiet ? <ArrowClockwise size={13} weight="bold" /> : <Sparkle size={16} weight="fill" />}
      {label}
    </button>
  );

  if (working) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-5 py-6 text-sm">
        <CircleNotch size={20} className="shrink-0 animate-spin text-accent" />
        <div>
          <p className="font-semibold">Gagesite is analysing your requirements...</p>
          <p className="text-muted">
            It works out every path through the website, including the decisions along the way. This takes a minute or
            two.
          </p>
        </div>
      </div>
    );
  }

  if (!chart) {
    return (
      <div className="rounded-xl border border-line bg-surface-2 px-5 py-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <FlowArrow size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">The whole website as one flowchart</p>
            <p className="mt-0.5 text-sm text-muted">
              {info.can_generate
                ? "Your requirements are gathered. Gagesite can now analyse them and draw every path through the website, from opening it to leaving, with the decisions along the way."
                : info.reason}
            </p>
            {(info.failed || info.error || error) && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-danger">
                <Warning size={14} weight="fill" />
                {error || info.error || "The last try didn't finish. Try again."}
              </p>
            )}
            <div className="mt-3">{generateButton(info.failed ? "Try again" : "Generate flowchart")}</div>
          </div>
        </div>
      </div>
    );
  }

  const gaps = (chart.gaps ?? []).filter((g) => g.question);
  return (
    <div className="space-y-3">
      {info.stale && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
          <Warning size={16} weight="fill" className="shrink-0 text-amber-500" />
          <p className="min-w-0 flex-1">The plan changed after this flowchart was made.</p>
          {generateButton("Make it again", true)}
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {chart.summary && <p className="min-w-0 max-w-[48rem] flex-1 text-sm text-muted">{chart.summary}</p>}
        <div className="flex shrink-0 gap-2">
          {!info.stale && generateButton("Make it again", true)}
          <button
            onClick={() => setFull(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1 text-xs font-medium text-muted transition hover:border-accent hover:text-accent-ink"
          >
            <ArrowsOut size={13} weight="bold" />
            Full screen
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Chart chart={chart} />
      {gaps.length > 0 && (
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Question size={16} className="text-accent" />
            Questions the flowchart raised
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {gaps.map((g) => (
              <li key={g.question}>
                {g.question}
                {g.why && <span className="text-muted"> ({g.why})</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-faint">Answer them in the chat, then make the flowchart again.</p>
        </div>
      )}
      {details && <div className="space-y-6 pt-3">{details}</div>}
      {full && (
        <FullScreen onClose={() => setFull(false)}>
          <Chart chart={chart} tall />
        </FullScreen>
      )}
    </div>
  );
}
