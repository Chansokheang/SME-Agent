"use client";

import { useId } from "react";
import type { ScopeFlow, ScopeLifecycle } from "@/lib/api";

/*
 * Static diagrams for the plan, drawn from the scope file so they update as the chat fills it in.
 * Style follows editorial diagram rules: right-angle connectors with rounded r=8 bends, hairline
 * borders, no shadows, one accent for the focal element, geometry on a 4px grid, and the text in
 * the owner's own words (full text in each box's tooltip). Wide diagrams scroll inside their own
 * box instead of shrinking.
 */

const C = {
  paper: "var(--color-surface)",
  lane: "var(--color-surface-2)",
  line: "var(--color-line)",
  lineStrong: "var(--color-line-strong)",
  ink: "var(--color-ink)",
  muted: "var(--color-muted)",
  faint: "var(--color-faint)",
  accent: "var(--color-accent)",
  accentSoft: "var(--color-accent-soft)",
};
const R = 8;

/** An orthogonal path through the given points, each bend rounded with radius r. */
function elbow(points: [number, number][], r = R): string {
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    const inLen = Math.abs(x - px) + Math.abs(y - py);
    const outLen = Math.abs(nx - x) + Math.abs(ny - y);
    const rr = Math.min(r, inLen / 2, outLen / 2);
    if (rr <= 0) {
      d += ` L ${x} ${y}`;
      continue;
    }
    const ax = x - Math.sign(x - px) * rr;
    const ay = y - Math.sign(y - py) * rr;
    const bx = x + Math.sign(nx - x) * rr;
    const by = y + Math.sign(ny - y) * rr;
    d += ` L ${ax} ${ay} Q ${x} ${y} ${bx} ${by}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L ${lx} ${ly}`;
}

function Markers({ id }: { id: string }) {
  return (
    <defs>
      {[
        ["arrow", C.faint],
        ["arrow-ink", C.ink],
        ["arrow-accent", C.accent],
      ].map(([name, fill]) => (
        <marker key={name} id={`${id}-${name}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={fill} />
        </marker>
      ))}
    </defs>
  );
}

/** HTML text inside the SVG, so long wording wraps and clamps instead of overflowing. */
function Text({
  x,
  y,
  w,
  h,
  children,
  className = "",
  title,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <foreignObject x={x} y={y} width={w} height={h}>
      <div title={title} className={`flex h-full w-full flex-col justify-center ${className}`}>
        {children}
      </div>
    </foreignObject>
  );
}

function Frame({
  id,
  width,
  height,
  title,
  desc,
  children,
  fit,
}: {
  id: string;
  width: number;
  height: number;
  title: string;
  desc: string;
  children: React.ReactNode;
  /** Shrink to the available width, but never below 80% (smaller text stops being readable); scroll past that. */
  fit?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={fit ? "100%" : width}
        height={fit ? undefined : height}
        style={fit ? { maxWidth: width, minWidth: Math.round(width * 0.8) } : { minWidth: width }}
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
        className="block"
      >
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-desc`}>{desc}</desc>
        <Markers id={id} />
        {children}
      </svg>
    </div>
  );
}

const clamp = (lines: number) =>
  ({
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  }) as const;

// ---------------------------------------------------------------------------------------------
// Swimlane: one lane per actor, one column per step, hand-offs between lanes drawn darker.

// Sized so a typical 4-step flow fits the plan's text column (about 700px) without scrolling.
const SW = { label: 88, col: 148, box: 132, boxH: 76, laneH: 100, pad: 12 };

export function FlowSwimlane({ flow }: { flow: ScopeFlow }) {
  const id = `flow-${useId().replace(/:/g, "")}`;
  const steps = flow.steps.filter((s) => s.action || s.actor);
  if (steps.length === 0) return null;

  // Lanes in order of appearance, starting with the role that begins the flow.
  const lanes: string[] = [];
  const key = (a: string) => a.trim().toLowerCase();
  for (const actor of [flow.role, ...steps.map((s) => s.actor)]) {
    if (actor && !lanes.some((l) => key(l) === key(actor))) lanes.push(actor.trim());
  }
  if (!steps.every((s) => lanes.some((l) => key(l) === key(s.actor)))) lanes.push("Someone");
  const laneOf = (actor: string) => {
    const i = lanes.findIndex((l) => key(l) === key(actor));
    return i === -1 ? lanes.length - 1 : i;
  };

  const width = SW.label + steps.length * SW.col + SW.pad;
  const height = lanes.length * SW.laneH;
  const boxX = (i: number) => SW.label + i * SW.col + (SW.col - SW.box) / 2;
  const boxY = (lane: number) => lane * SW.laneH + (SW.laneH - SW.boxH) / 2;
  const last = steps.length - 1;

  return (
    <Frame
      id={id}
      width={width}
      height={height}
      title={flow.name}
      desc={`${flow.name}: ${steps.length} steps across ${lanes.join(", ")}.`}
    >
      {/* Lanes */}
      {lanes.map((lane, i) => (
        <g key={lane}>
          <rect x={0} y={i * SW.laneH} width={width} height={SW.laneH} fill={i % 2 ? C.paper : C.lane} />
          {i > 0 && <line x1={0} x2={width} y1={i * SW.laneH} y2={i * SW.laneH} stroke={C.line} strokeWidth={1} />}
          <Text x={12} y={i * SW.laneH} w={SW.label - 20} h={SW.laneH}>
            <span className="text-[10px] font-semibold uppercase leading-snug tracking-[0.12em] text-muted">
              {lane}
            </span>
          </Text>
        </g>
      ))}
      <line x1={SW.label} x2={SW.label} y1={0} y2={height} stroke={C.line} strokeWidth={1} />

      {/* Connectors first, so boxes sit on top of them. */}
      {steps.slice(1).map((step, k) => {
        const i = k + 1;
        const from = laneOf(steps[i - 1].actor);
        const to = laneOf(step.actor);
        const sx = boxX(i - 1) + SW.box;
        const sy = boxY(from) + SW.boxH / 2;
        const tx = boxX(i);
        const ty = boxY(to) + SW.boxH / 2;
        const handoff = from !== to;
        const mid = sx + (tx - sx) / 2;
        return (
          <path
            key={i}
            d={
              handoff
                ? elbow([
                    [sx, sy],
                    [mid, sy],
                    [mid, ty],
                    [tx - 2, ty],
                  ])
                : elbow([
                    [sx, sy],
                    [tx - 2, ty],
                  ])
            }
            fill="none"
            stroke={handoff ? C.ink : C.faint}
            strokeWidth={1}
            markerEnd={`url(#${id}-${handoff ? "arrow-ink" : "arrow"})`}
          />
        );
      })}

      {/* Steps */}
      {steps.map((step, i) => {
        const x = boxX(i);
        const y = boxY(laneOf(step.actor));
        const focal = i === last;
        const tip = [step.action, step.page && `On: ${step.page}`, step.result && `Then: ${step.result}`]
          .filter(Boolean)
          .join("\n");
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={SW.box}
              height={SW.boxH}
              rx={6}
              fill={focal ? C.accentSoft : C.paper}
              stroke={focal ? C.accent : C.lineStrong}
              strokeWidth={1}
            />
            <Text x={x + 10} y={y + 6} w={SW.box - 20} h={SW.boxH - 12} title={tip}>
              <span className="text-[12px] font-semibold leading-4 text-ink" style={clamp(step.page ? 2 : 3)}>
                {step.action || step.actor}
              </span>
              {step.page && <span className="mt-1 truncate text-[10.5px] leading-4 text-muted">{step.page}</span>}
            </Text>
          </g>
        );
      })}
    </Frame>
  );
}

// ---------------------------------------------------------------------------------------------
// Lifecycle: drawn top to bottom, so a long lifecycle grows down the page instead of off its
// side. States sit on levels in the order they are reached; a second state reached from the
// same one goes in a lane to the right. A step to the next level runs straight down (or bends
// once into the lane to the right); any other change (going back, skipping ahead) runs through
// a dashed channel beside the diagram, with its label next to it.

const LC = {
  box: 156,
  boxH: 56,
  level: 64, // vertical gap between levels: room for a two-line label beside the arrow
  lane: 72, // horizontal gap between lanes
  channel: 16, // spacing between side channels
  labelW: 132, // width of a label beside a side channel
  labelH: 28,
  padTop: 32,
};

type Placed = { name: string; meaning: string; level: number; lane: number };

function placeStates(cycle: ScopeLifecycle): Placed[] {
  const key = (s: string) => s.trim().toLowerCase();
  const states = cycle.states.filter((s) => s.name);
  const byKey = new Map(states.map((s) => [key(s.name), s]));
  // Start: what a change "from" nothing leads to, else the first state listed.
  const start = cycle.changes.find((c) => !c.from && byKey.has(key(c.to)))?.to ?? states[0]?.name;
  const level = new Map<string, number>();
  if (start) level.set(key(start), 0);
  const queue = start ? [key(start)] : [];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const c of cycle.changes) {
      const to = key(c.to);
      if (key(c.from) === cur && byKey.has(to) && !level.has(to)) {
        level.set(to, level.get(cur)! + 1);
        queue.push(to);
      }
    }
  }
  // Anything never reached goes at the end of the main lane.
  let next = Math.max(-1, ...level.values()) + 1;
  for (const s of states) if (!level.has(key(s.name))) level.set(key(s.name), next++);
  const used = new Map<number, number>();
  return states.map((s) => {
    const l = level.get(key(s.name))!;
    const lane = used.get(l) ?? 0;
    used.set(l, lane + 1);
    return { name: s.name, meaning: s.meaning, level: l, lane };
  });
}

type Side = "l" | "r" | "t" | "b";

export function LifecycleDiagram({ cycle }: { cycle: ScopeLifecycle }) {
  const id = `life-${useId().replace(/:/g, "")}`;
  const placed = placeStates(cycle);
  if (placed.length === 0) return null;

  const key = (s: string) => s.trim().toLowerCase();
  const find = (name: string) => placed.find((p) => key(p.name) === key(name));
  const levels = Math.max(...placed.map((p) => p.level)) + 1;
  const lanes = Math.max(...placed.map((p) => p.lane)) + 1;

  const changes = cycle.changes
    .map((c) => ({
      trigger: c.trigger,
      a: c.from ? find(c.from) : undefined,
      b: find(c.to),
    }))
    .filter((c): c is { trigger: string; a: Placed; b: Placed } => !!c.a && !!c.b && c.a !== c.b);
  type Change = (typeof changes)[number];
  // Straight down within a lane, or from the main lane down into a lane to its right.
  const direct = (c: Change) => c.b.level === c.a.level + 1 && (c.b.lane === c.a.lane || c.a.lane === 0);
  const around = changes.filter((c) => !direct(c));
  // Changes that stay in the main lane go round its left; anything touching another lane goes round the right.
  const left = around.filter((c) => c.a.lane === 0 && c.b.lane === 0);
  const right = around.filter((c) => !left.includes(c));

  const leftW = left.length ? LC.labelW + left.length * LC.channel + 24 : 40;
  const x = (p: Placed) => leftW + p.lane * (LC.box + LC.lane);
  const y = (p: Placed) => LC.padTop + p.level * (LC.boxH + LC.level);
  const bodyRight = leftW + lanes * LC.box + (lanes - 1) * LC.lane;
  // With no side channel on the right, leave room there for the labels beside the downward arrows.
  const rightPad = right.length ? 0 : 96;
  const width = bodyRight + (right.length ? right.length * LC.channel + 8 + LC.labelW : rightPad);
  const height = LC.padTop + levels * LC.boxH + (levels - 1) * LC.level + 24;

  // Fan the attach points on each side of a box so no two connectors share one.
  const ports = new Map<string, number[]>();
  const claim = (p: Placed, side: Side, idx: number) => {
    const k = `${p.name}|${side}`;
    const list = ports.get(k) ?? [];
    if (!list.includes(idx)) list.push(idx);
    ports.set(k, list);
  };
  changes.forEach((c, i) => {
    if (direct(c)) {
      claim(c.a, c.b.lane === c.a.lane ? "b" : "r", i);
      claim(c.b, "t", i);
    } else {
      const side: Side = left.includes(c) ? "l" : "r";
      claim(c.a, side, i);
      claim(c.b, side, i);
    }
  });
  const port = (p: Placed, side: Side, idx: number): [number, number] => {
    const list = ports.get(`${p.name}|${side}`) ?? [idx];
    const k = list.indexOf(idx) + 1;
    const n = list.length;
    if (side === "l" || side === "r") return [x(p) + (side === "r" ? LC.box : 0), y(p) + (LC.boxH * k) / (n + 1)];
    return [x(p) + (LC.box * k) / (n + 1), y(p) + (side === "b" ? LC.boxH : 0)];
  };

  const first = placed.find((p) => p.level === 0 && p.lane === 0)!;
  const startX = x(first) + LC.box / 2;

  return (
    <Frame
      id={id}
      width={width}
      height={height}
      title={`${cycle.thing}: how it changes`}
      desc={`${cycle.thing} moves between ${placed.map((p) => p.name).join(", ")}.`}
    >
      <rect width="100%" height="100%" fill={C.paper} />
      {/* Start dot */}
      <circle cx={startX} cy={10} r={5} fill={C.ink} />
      <path
        d={elbow([
          [startX, 16],
          [startX, LC.padTop - 2],
        ])}
        stroke={C.faint}
        markerEnd={`url(#${id}-arrow)`}
      />

      {changes.map((c, i) => {
        const { a, b } = c;
        let d: string;
        let label: { x: number; y: number; w: number; align: "left" | "right" };
        if (direct(c) && b.lane === a.lane) {
          const [sx, sy] = port(a, "b", i);
          const [tx, ty] = port(b, "t", i);
          d = elbow([
            [sx, sy],
            [sx, sy + (ty - sy) / 2],
            [tx, sy + (ty - sy) / 2],
            [tx, ty - 2],
          ]);
          // Beside the arrow, on its right, inside the gap between the two levels.
          const roomRight = x(a) + LC.box + (a.lane < lanes - 1 ? LC.lane : rightPad || 8) - sx - 16;
          label = {
            x: sx + 8,
            y: sy + (LC.level - LC.labelH) / 2,
            w: Math.max(96, roomRight),
            align: "left",
          };
        } else if (direct(c)) {
          // From the main lane into a lane to its right: out of the side, across, then down.
          const [sx, sy] = port(a, "r", i);
          const [tx, ty] = port(b, "t", i);
          d = elbow([
            [sx, sy],
            [tx, sy],
            [tx, ty - 2],
          ]);
          label = {
            x: tx + 8,
            y: y(a) + LC.boxH + (LC.level - LC.labelH) / 2,
            w: LC.box / 2 + LC.lane - 16,
            align: "left",
          };
        } else {
          const onLeft = left.includes(c);
          const lane = (onLeft ? left : right).indexOf(c);
          const side: Side = onLeft ? "l" : "r";
          const [sx, sy] = port(a, side, i);
          const [tx, ty] = port(b, side, i);
          const cx = onLeft ? leftW - 8 - (lane + 1) * LC.channel : bodyRight + 8 + (lane + 1) * LC.channel - 8;
          d = elbow([
            [sx, sy],
            [cx, sy],
            [cx, ty],
            [tx + (onLeft ? -2 : 2), ty],
          ]);
          const midY = (sy + ty) / 2 - LC.labelH / 2;
          label = onLeft
            ? { x: cx - LC.labelW - 8, y: midY, w: LC.labelW, align: "right" }
            : { x: cx + 8, y: midY, w: LC.labelW, align: "left" };
          // Only the outermost channel has open space beside it; inner ones put the label at the source.
          if (lane !== (onLeft ? left : right).length - 1) {
            const outer = onLeft
              ? leftW - 8 - (onLeft ? left : right).length * LC.channel
              : bodyRight + (onLeft ? left : right).length * LC.channel;
            label = onLeft
              ? {
                  x: outer - LC.labelW - 8,
                  y: sy - LC.labelH / 2,
                  w: LC.labelW,
                  align: "right",
                }
              : {
                  x: outer + 8,
                  y: sy - LC.labelH / 2,
                  w: LC.labelW,
                  align: "left",
                };
          }
        }
        return (
          <g key={i}>
            <path
              d={d}
              fill="none"
              stroke={C.faint}
              strokeWidth={1}
              strokeDasharray={direct(c) ? undefined : "5 4"}
              markerEnd={`url(#${id}-arrow)`}
            />
            {c.trigger && (
              <Text x={label.x} y={label.y} w={label.w} h={LC.labelH} title={c.trigger}>
                <span
                  className={`text-[10.5px] leading-[13px] text-muted ${label.align === "right" ? "text-right" : ""}`}
                  style={clamp(2)}
                >
                  {c.trigger}
                </span>
              </Text>
            )}
          </g>
        );
      })}

      {placed.map((p) => (
        <g key={p.name}>
          <rect x={x(p)} y={y(p)} width={LC.box} height={LC.boxH} rx={8} fill={C.paper} stroke={C.lineStrong} />
          <Text x={x(p) + 10} y={y(p) + 4} w={LC.box - 20} h={LC.boxH - 8} title={p.meaning || p.name}>
            <span className="truncate text-center text-[12px] font-semibold leading-4 text-ink">{p.name}</span>
            {p.meaning && (
              <span className="mt-0.5 text-center text-[10.5px] leading-[13px] text-muted" style={clamp(2)}>
                {p.meaning}
              </span>
            )}
          </Text>
        </g>
      ))}
    </Frame>
  );
}
