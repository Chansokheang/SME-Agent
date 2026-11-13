"use client";

import {
  ArrowRight,
  CaretDown,
  CircleNotch,
  DeviceMobile,
  FilmSlate,
  Hammer,
  ImageSquare,
  Sparkle,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type {
  Direction,
  Directions,
  Storyboard,
  StoryboardSection,
} from "@/lib/api";

/**
 * A landing page's scroll storyboard (the Motion Director's), for the owner to read before any
 * code exists: the concept, the big idea, the mood, every section on a scroll timeline, and the
 * page's decisions. Changes are asked for in the chat; "Build from this storyboard" starts the builder.
 */
export default function StoryboardPanel({
  board,
  directions,
  running,
  busy,
  onBuild,
  onChoose,
}: {
  board: Storyboard | null;
  directions: Directions | null;
  running: boolean;
  busy: boolean;
  onBuild: () => void;
  onChoose: (id: string, note: string) => void;
}) {
  const [systemOpen, setSystemOpen] = useState(false);
  const chosen =
    directions?.status === "chosen"
      ? directions.directions.find((d) => d.id === directions.chosen)
      : undefined;

  // First the Director offers a few different looks; the storyboard is made in the one picked.
  if (!board && directions?.status === "choose" && !running) {
    return (
      <DirectionPicker
        directions={directions.directions}
        busy={busy}
        onChoose={onChoose}
      />
    );
  }

  if (!board) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            {running ? (
              <CircleNotch size={22} className="animate-spin" />
            ) : (
              <FilmSlate size={22} weight="duotone" />
            )}
          </span>
          <h3 className="mt-4 font-display text-lg font-bold">
            {running
              ? chosen
                ? `Storyboarding your page in "${chosen.name}"...`
                : "Gagesite is preparing a few different looks..."
              : "No storyboard yet"}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {running && !chosen
              ? "Two or three clearly different directions for your page: type, colours, layout and the signature motion. You pick one; then the scroll story is planned in it."
              : "Before any code, the scroll story is planned: the big idea, what moves in each section and how it feels on a phone. You can change it before it's built."}
          </p>
        </div>
      </div>
    );
  }

  const sections = board.sections ?? [];
  const palette = board.mood?.palette ?? [];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 [scrollbar-width:thin] @container">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-ink">
          Scroll storyboard
          {chosen && (
            <span className="ml-2 font-normal normal-case tracking-normal text-muted">
              in &ldquo;{chosen.name}&rdquo;
            </span>
          )}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight">
          {board.concept}
        </h2>
        <div className="mt-4 rounded-2xl border border-accent/30 bg-accent-soft/40 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-ink">
            <Sparkle size={14} weight="fill" /> The big idea
          </p>
          <p className="mt-1 text-sm leading-relaxed">{board.big_idea}</p>
        </div>

        {(palette.length > 0 || board.mood?.type || board.mood?.light) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
            {palette.length > 0 && (
              <span className="flex items-center gap-1">
                {palette.slice(0, 6).map((c) => (
                  <span
                    key={c}
                    title={c}
                    className="size-5 rounded-full border border-line"
                    style={{ background: c }}
                  />
                ))}
              </span>
            )}
            {board.mood?.light && <span>{board.mood.light}</span>}
            {board.mood?.type && <span>{board.mood.type}</span>}
            {board.mood?.pace && <span>Pace: {board.mood.pace}</span>}
          </div>
        )}

        <h3 className="mt-6 text-sm font-semibold">As the visitor scrolls</h3>
        <ol className="mt-2 space-y-2">
          {sections.map((s, i) => (
            <SectionRow key={s.id ?? i} section={s} index={i} />
          ))}
        </ol>

        {board.system && (
          <section className="mt-5 rounded-2xl border border-line">
            <button
              type="button"
              onClick={() => setSystemOpen(!systemOpen)}
              aria-expanded={systemOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span>
                <span className="block text-sm font-semibold">
                  The page&apos;s decisions
                </span>
                <span className="block text-xs text-muted">
                  Motion timing, layout grid, components, interaction and screen
                  sizes, decided once for the whole page
                </span>
              </span>
              <CaretDown
                size={15}
                className={`shrink-0 text-muted transition ${systemOpen ? "rotate-180" : ""}`}
              />
            </button>
            {systemOpen && (
              <dl className="space-y-3 border-t border-line px-4 py-3 text-xs leading-relaxed">
                {(
                  [
                    "motion",
                    "layout",
                    "components",
                    "interaction",
                    "responsive",
                  ] as const
                ).map((key) =>
                  board.system?.[key] ? (
                    <div key={key}>
                      <dt className="font-semibold capitalize">{key}</dt>
                      <dd className="mt-0.5 text-muted">
                        {describe(board.system[key])}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
            )}
          </section>
        )}

        {!!board.assets_needed?.length && (
          <section className="mt-4 rounded-2xl bg-surface-2 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <ImageSquare size={14} /> What would make it better
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs leading-relaxed text-muted">
              {board.assets_needed.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
            Want something different? Ask in the chat
            {directions ? " (or ask for new directions)" : ""}. When it feels
            right, build it.
          </p>
          <button
            type="button"
            onClick={onBuild}
            disabled={running || busy}
            className="group inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? (
              <CircleNotch size={16} className="animate-spin" />
            ) : (
              <Hammer size={16} weight="bold" />
            )}
            Build from this storyboard
            <ArrowRight
              size={15}
              weight="bold"
              className="transition group-hover:translate-x-0.5"
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionRow({
  section: s,
  index,
}: {
  section: StoryboardSection;
  index: number;
}) {
  const [open, setOpen] = useState(index < 2);
  const [start, end] = s.scroll ?? [0, 0];
  return (
    <li className="rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs font-semibold">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{s.name}</span>
          {/* Where this section sits in the page's scroll. */}
          <span className="relative mt-1.5 block h-1 rounded-full bg-surface-2">
            <span
              className="absolute inset-y-0 rounded-full bg-accent/70"
              style={{
                left: `${start}%`,
                width: `${Math.max(2, end - start)}%`,
              }}
            />
          </span>
        </span>
        <span className="shrink-0 text-[11px] text-faint">
          {start}-{end}%
        </span>
        <CaretDown
          size={14}
          className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <dl className="grid gap-2 border-t border-line px-4 py-3 text-xs leading-relaxed">
          {s.visual && <Field label="You see" text={s.visual} />}
          {s.motion && <Field label="As you scroll" text={s.motion} />}
          {s.interaction && <Field label="You can" text={s.interaction} />}
          {s.content && <Field label="Content" text={s.content} />}
          {s.phone && (
            <div className="flex gap-2 text-muted">
              <DeviceMobile size={14} className="mt-0.5 shrink-0" />
              <span>{s.phone}</span>
            </div>
          )}
        </dl>
      )}
    </li>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <dt className="font-semibold">{label}</dt>
      <dd className="text-muted">{text}</dd>
    </div>
  );
}

/** Readable text for one block of decisions (strings, lists or small objects). */
function describe(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value
      .map((v) =>
        typeof v === "object" && v
          ? `${(v as { name?: string }).name ?? ""}: ${(v as { does?: string }).does ?? describe(v)}`
          : String(v),
      )
      .join(" · ");
  if (value && typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .map(
        ([k, v]) =>
          `${k.replace(/_/g, " ")}: ${typeof v === "object" ? describe(v) : String(v)}`,
      )
      .join(" · ");
  return String(value ?? "");
}

/** Loads a direction's display font from Google Fonts, so each card shows its own type. */
function useGoogleFont(family: string | undefined) {
  useEffect(() => {
    const name = family?.split(/[,(]/)[0].trim();
    if (!name || /^(inter|roboto|arial|helvetica|system)/i.test(name)) return;
    const id = `gf-${name.replace(/\s+/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }, [family]);
}

function DirectionPicker({
  directions,
  busy,
  onChoose,
}: {
  directions: Direction[];
  busy: boolean;
  onChoose: (id: string, note: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const current = directions.find((d) => d.id === picked);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 [scrollbar-width:thin] @container">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-ink">
          Choose a direction
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight">
          {directions.length} different looks for your page
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Each has its own type, colours, layout and signature motion. Pick one;
          the scroll story is then planned in it. You can mix in something from
          another with a note.
        </p>
        <div
          className="mt-4 grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3"
          role="radiogroup"
        >
          {directions.map((d) => (
            <DirectionCard
              key={d.id}
              direction={d}
              selected={picked === d.id}
              onSelect={() => setPicked(d.id)}
            />
          ))}
        </div>
      </div>
      <div className="shrink-0 space-y-2 border-t border-line bg-surface px-5 py-3">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          placeholder="Optional note, e.g. 'B, but with the hero from A'"
          className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-sm outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
            None fits? Ask in the chat for new directions.
          </p>
          <button
            type="button"
            onClick={() => picked && onChoose(picked, note)}
            disabled={!picked || busy}
            className="group inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? (
              <CircleNotch size={16} className="animate-spin" />
            ) : (
              <FilmSlate size={16} weight="bold" />
            )}
            {current ? `Storyboard "${current.name}"` : "Pick a direction"}
            <ArrowRight
              size={15}
              weight="bold"
              className="transition group-hover:translate-x-0.5"
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function DirectionCard({
  direction: d,
  selected,
  onSelect,
}: {
  direction: Direction;
  selected: boolean;
  onSelect: () => void;
}) {
  useGoogleFont(d.type?.display);
  const palette = d.palette ?? [];
  // The swatch: the first colour as the base, the palette colour that reads best on it as the
  // type, and the most colourful remaining one as the accent.
  const base = palette[0] ?? "#f4f4f2";
  const others = palette.slice(1);
  const ink =
    [...others, "#111111", "#ffffff"]
      .sort((a, b) => contrast(b, base) - contrast(a, base))
      .find((c) => contrast(c, base) >= 4.5) ?? "#111111";
  const accent =
    others
      .filter((c) => c !== ink)
      .sort((a, b) => saturation(b) - saturation(a))[0] ?? ink;
  const display = d.type?.display?.split(/[,(]/)[0].trim();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex flex-col overflow-hidden rounded-2xl border text-left transition active:scale-[0.99] ${
        selected
          ? "border-accent ring-4 ring-accent-soft"
          : "border-line hover:border-accent"
      }`}
    >
      {/* A small swatch of the look: its base, its type and its accent. */}
      <div
        className="relative h-28 px-4 py-3"
        style={{ background: base, color: ink }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
          Direction {d.id}
        </span>
        <p
          className="mt-1 line-clamp-2 text-2xl font-bold leading-[1.05]"
          style={{ fontFamily: display ? `"${display}", serif` : undefined }}
        >
          {d.name}
        </p>
        <span
          className="absolute bottom-3 right-4 h-2 w-10 rounded-full"
          style={{ background: accent }}
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-3 text-xs leading-relaxed">
        <p className="text-sm font-medium text-ink">{d.line}</p>
        <div className="flex items-center gap-1">
          {palette.slice(0, 6).map((c) => (
            <span
              key={c}
              title={c}
              className="size-4 shrink-0 rounded-full border border-line"
              style={{ background: c }}
            />
          ))}
          {d.type && (
            <span className="ml-2 truncate text-muted">
              {[d.type.display, d.type.body]
                .filter(Boolean)
                .map((f) => f!.split(/[,(]/)[0].trim())
                .join(" + ")}
            </span>
          )}
        </div>
        <Field label="The idea" text={d.big_idea} />
        {d.hero && <Field label="Hero" text={d.hero} />}
        {d.signature_motion && (
          <Field label="Signature motion" text={d.signature_motion} />
        )}
        {d.layout && <Field label="Layout" text={d.layout} />}
      </div>
    </button>
  );
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.slice(0, 6);
  const n = parseInt(full, 16);
  return Number.isNaN(n)
    ? [0, 0, 0]
    : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function saturation(hex: string) {
  const [r, g, b] = rgb(hex);
  return Math.max(r, g, b) - Math.min(r, g, b);
}
