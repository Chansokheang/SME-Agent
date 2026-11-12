"use client";

import dagre from "@dagrejs/dagre";
import { Key, LinkSimple } from "@phosphor-icons/react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useNodesState,
  type Edge,
  type ReactFlowInstance,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DatabaseSchema, DbTable } from "@/lib/api";
import { RELATION_SHORT, typeLabel } from "@/lib/dbTypes";

const NODE_WIDTH = 248;
const HEADER_HEIGHT = 56;
const ROW_HEIGHT = 30;

type TableNodeData = { table: DbTable; schema: DatabaseSchema; dimmed: boolean };

function TableNode({ data }: NodeProps<Node<TableNodeData>>) {
  const { table, schema, dimmed } = data;
  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-surface shadow-[0_12px_32px_-18px_rgba(14,42,87,0.45)] transition-all duration-300 ${
        dimmed ? "border-line opacity-40" : "border-line-strong hover:-translate-y-0.5 hover:border-accent"
      }`}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-accent" />
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-accent" />
      <div className="bg-gradient-to-r from-accent to-sky-500 px-4 py-2.5 text-white" style={{ height: HEADER_HEIGHT }}>
        <p className="truncate font-display text-[15px] font-bold leading-tight">{table.label || table.name}</p>
        <p className="truncate font-mono text-[10px] text-white/75">{table.name}</p>
      </div>
      <ul>
        {table.columns.map((column) => (
          <li
            key={column.name}
            title={column.description || undefined}
            className="flex items-center gap-2 border-t border-line px-3 text-xs"
            style={{ height: ROW_HEIGHT }}
          >
            <span className="grid w-3.5 shrink-0 place-items-center text-accent">
              {column.primary ? (
                <Key size={12} weight="fill" />
              ) : column.references ? (
                <LinkSimple size={12} weight="bold" />
              ) : null}
            </span>
            <span className={`min-w-0 flex-1 truncate ${column.primary ? "font-semibold" : ""}`}>
              {column.name}
              {!column.required && <span className="text-faint">?</span>}
            </span>
            <span className="max-w-[96px] shrink-0 truncate text-[10.5px] text-faint">{typeLabel(column, schema)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const nodeTypes = { table: TableNode };

const GAP = 40;
const tableHeight = (table: DbTable) => HEADER_HEIGHT + ROW_HEIGHT * table.columns.length;

/**
 * Linked tables are laid out as a tree by dagre; tables with no links (opening hours,
 * settings...) are wrapped into a compact grid underneath, instead of one long row.
 */
function layout(schema: DatabaseSchema) {
  const linked = new Set(schema.relations.flatMap((r) => [r.from_table, r.to_table]));
  const positions = new Map<string, { x: number; y: number }>();

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "TB", nodesep: GAP, ranksep: 90 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const table of schema.tables.filter((t) => linked.has(t.name))) {
    graph.setNode(table.name, { width: NODE_WIDTH, height: tableHeight(table) });
  }
  for (const relation of schema.relations) graph.setEdge(relation.from_table, relation.to_table);
  dagre.layout(graph);

  let treeWidth = 0;
  let treeBottom = 0;
  for (const name of graph.nodes()) {
    const { x, y, width, height } = graph.node(name);
    positions.set(name, { x: x - width / 2, y: y - height / 2 });
    treeWidth = Math.max(treeWidth, x + width / 2);
    treeBottom = Math.max(treeBottom, y + height / 2);
  }

  // A narrow tree gets the loose tables beside it; a wide one gets them underneath.
  const loose = schema.tables.filter((t) => !linked.has(t.name));
  const beside = treeWidth > 0 && treeWidth < NODE_WIDTH * 2 + GAP;
  const perRow = beside ? 2 : Math.max(2, Math.floor((treeWidth + GAP) / (NODE_WIDTH + GAP)));
  const left = beside ? treeWidth + GAP * 2 : 0;
  let rowTop = beside || !treeBottom ? 0 : treeBottom + GAP * 2;
  for (let i = 0; i < loose.length; i += perRow) {
    const row = loose.slice(i, i + perRow);
    row.forEach((table, j) => positions.set(table.name, { x: left + j * (NODE_WIDTH + GAP), y: rowTop }));
    rowTop += Math.max(...row.map(tableHeight)) + GAP;
  }

  return (name: string) => positions.get(name) ?? { x: 0, y: 0 };
}

export default function ErdDiagram({ schema }: { schema: DatabaseSchema }) {
  const [focus, setFocus] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<ReactFlowInstance<Node<TableNodeData>> | null>(null);

  // Re-fit when the panel changes size (e.g. the chat is hidden or shown).
  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.18, duration: 300 }));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  // Re-layout when the design changes, but keep tables the owner already dragged where they put them.
  useEffect(() => {
    const positionOf = layout(schema);
    setNodes((previous) => {
      const moved = new Map(previous.map((n) => [n.id, n.position]));
      return schema.tables.map((table) => ({
        id: table.name,
        type: "table",
        position: moved.get(table.name) ?? positionOf(table.name),
        data: { table, schema, dimmed: false },
      }));
    });
  }, [schema, setNodes]);

  const linked = useMemo(() => {
    if (!focus) return null;
    const names = new Set([focus]);
    for (const r of schema.relations) {
      if (r.from_table === focus) names.add(r.to_table);
      if (r.to_table === focus) names.add(r.from_table);
    }
    return names;
  }, [focus, schema.relations]);

  const shownNodes = nodes.map((node) => ({
    ...node,
    data: { ...node.data, dimmed: linked !== null && !linked.has(node.id) },
  }));

  const edges: Edge[] = schema.relations.map((relation, i) => {
    const active = !focus || relation.from_table === focus || relation.to_table === focus;
    return {
      id: `${relation.from_table}-${relation.to_table}-${i}`,
      source: relation.from_table,
      target: relation.to_table,
      type: "smoothstep",
      label: RELATION_SHORT[relation.type],
      animated: Boolean(focus) && active,
      style: { stroke: active ? "#2266d4" : "#c4d6ec", strokeWidth: active ? 2 : 1.5 },
      labelStyle: { fill: "#1a4f9e", fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: "#e5f0fd" },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 999,
      markerEnd: { type: MarkerType.ArrowClosed, color: active ? "#2266d4" : "#c4d6ec" },
    };
  });

  return (
    <div
      ref={wrapperRef}
      className="relative h-full min-h-[420px] w-full overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface-2 to-surface"
    >
      <ReactFlow
        onInit={(instance) => (flowRef.current = instance)}
        nodes={shownNodes}
        onNodesChange={onNodesChange}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.3}
        maxZoom={1.6}
        nodesConnectable={false}
        onNodeMouseEnter={(_, node) => setFocus(node.id)}
        onNodeMouseLeave={() => setFocus(null)}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.4} color="#c4d6ec" />
        <Controls showInteractive={false} className="!rounded-xl !border !border-line !shadow-sm" />
      </ReactFlow>
      <p className="pointer-events-none absolute left-4 top-3 text-xs text-faint">
        Drag tables to rearrange. Hover one to see what it links to.
      </p>
    </div>
  );
}
