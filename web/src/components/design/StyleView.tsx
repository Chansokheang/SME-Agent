"use client";

import {
  ArrowLeft,
  ArrowUp,
  ArrowsOutLineHorizontal,
  CircleNotch,
  CursorClick,
  DeviceMobile,
  MagicWand,
  Stack,
  Swatches,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CommentTray, TargetChips, targetPhrase, type SectionComment } from "@/components/design/PageComments";
import ScaledFrame, { type PickEvent, type PickTarget } from "@/components/design/ScaledFrame";
import { api, type DesignArtifact, type DesignComponent, type DesignPalette } from "@/lib/api";

const GROUP_ORDER = ["Foundations", "Navigation", "Buttons", "Forms", "Cards", "Sections", "Feedback"];
const COLOR_ROLES: Record<string, string> = {
  background: "Page background",
  surface: "Cards and panels",
  text: "Main text",
  muted: "Secondary text",
  primary: "Buttons and links",
  primary_text: "Text on buttons",
  accent: "Highlights",
  border: "Lines and borders",
};
// Components that read best across the full width of the gallery.
const WIDE = /^buttons?$|header|footer|band|gallery|tabs|form|editor|row|map|hours|summary|list|section|filter|screen/;

/**
 * The design system as one document (colours, typography, components), like Claude Design.
 * Clicking a component card drills into it: a specimen view and a box to change it.
 */
export default function StyleView({
  projectId,
  artifact,
  running,
  approved,
  refreshKey,
  onAsk,
}: {
  projectId: string;
  artifact: DesignArtifact;
  running: boolean;
  approved: boolean;
  refreshKey: number;
  onAsk: (message: string) => Promise<boolean>;
}) {
  const tokens = artifact.tokens;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const components = useMemo(
    () =>
      [...artifact.components].sort(
        (a, b) => rank(a.group) - rank(b.group) || artifact.components.indexOf(a) - artifact.components.indexOf(b),
      ),
    [artifact.components],
  );
  const selected = components.find((c) => c.id === selectedId) ?? null;
  const pageName = (slug: string) => artifact.pages.find((p) => p.slug === slug)?.name ?? slug;
  useWebFonts(tokens?.fonts);

  if (!tokens?.palette) {
    return (
      <Placeholder
        icon={Swatches}
        title="No style chosen yet"
        text="After you pick a direction, its colours, fonts and every component appear here."
      />
    );
  }

  if (selected && artifact.components_file) {
    const index = components.indexOf(selected);
    return (
      <ComponentDetail
        key={selected.id}
        projectId={projectId}
        component={selected}
        file={artifact.components_file}
        palette={tokens.palette}
        refreshKey={refreshKey}
        pageName={pageName}
        running={running}
        approved={approved}
        onAsk={onAsk}
        onBack={() => setSelectedId(null)}
        onPrev={index > 0 ? () => setSelectedId(components[index - 1].id) : undefined}
        onNext={index < components.length - 1 ? () => setSelectedId(components[index + 1].id) : undefined}
      />
    );
  }

  return (
    <div className="space-y-10 pb-4">
      <SystemHeader artifact={artifact} running={running} approved={approved} onAsk={onAsk} />

      <section>
        <SectionTitle title="Colors" count={Object.keys(tokens.palette).length} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.entries(tokens.palette) as [string, string][]).map(([name, value]) => (
            <div key={name} className="group overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="h-20 transition-transform duration-500 group-hover:scale-105" style={{ background: value }} />
              <div className="border-t border-line px-3 py-2.5">
                <p className="text-sm font-medium">{COLOR_ROLES[name] ?? name}</p>
                <p className="mt-0.5 flex justify-between gap-2 font-mono text-[11px] text-faint">
                  <span>{name}</span>
                  <span className="uppercase">{value}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle title="Typography" count={2} />
        <TypeSpecimens fonts={tokens.fonts} palette={tokens.palette} />
      </section>

      <section>
        <SectionTitle title="Components" count={components.length} />
        {!artifact.components_file ? (
          <LibraryMissing
            running={running}
            approved={approved}
            hasPages={artifact.pages.some((p) => p.exists)}
            onCreate={() =>
              onAsk(
                "Please create the component library (docs/03-design/components.html and components.json) from the pages you already designed. Don't change the pages.",
              )
            }
          />
        ) : (
          <ComponentGallery
            projectId={projectId}
            file={artifact.components_file}
            components={components}
            refreshKey={refreshKey}
            onSelect={setSelectedId}
          />
        )}
      </section>
    </div>
  );
}

function rank(group: string) {
  const index = GROUP_ORDER.indexOf(group);
  return index === -1 ? GROUP_ORDER.length : index;
}

/** Loads the design's fonts into this app, so the typography specimens show the real faces. */
function useWebFonts(fonts: { display: string; body: string } | undefined) {
  useEffect(() => {
    if (!fonts) return;
    for (const family of new Set([fonts.display, fonts.body])) {
      if (!family) continue;
      const id = `gs-font-${family.replace(/\s+/g, "-")}`;
      if (document.getElementById(id)) continue;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = /pretendard/i.test(family)
        ? "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        : `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
      document.head.appendChild(link);
    }
  }, [fonts]);
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-4 flex items-baseline gap-2 border-b border-line pb-2.5">
      <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
      <span className="text-xs text-faint">{count}</span>
    </div>
  );
}

function SystemHeader({
  artifact,
  running,
  approved,
  onAsk,
}: {
  artifact: DesignArtifact;
  running: boolean;
  approved: boolean;
  onAsk: (message: string) => Promise<boolean>;
}) {
  const [remixing, setRemixing] = useState(false);
  const [text, setText] = useState("");
  const direction = artifact.directions.find((d) => d.id === artifact.chosen_direction);

  async function remix() {
    const change = text.trim();
    if (!change || running) return;
    const ok = await onAsk(
      `Remix the design system: ${change}. Update docs/03-design/tokens.json if colours, fonts or corners change, ` +
        `then the component library and every page, so everything stays consistent.`,
    );
    if (ok) {
      setText("");
      setRemixing(false);
    }
  }

  return (
    <header className="rounded-3xl bg-gradient-to-br from-accent-soft via-surface-2 to-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-accent-ink">Design system</p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">{direction?.name ?? "Your style"}</h2>
          {artifact.tokens?.style_notes && (
            <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-muted">{artifact.tokens.style_notes}</p>
          )}
        </div>
        {!approved && !remixing && (
          <button
            onClick={() => setRemixing(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/85 active:scale-[0.98]"
          >
            <MagicWand size={16} weight="bold" />
            Remix
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {remixing && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onSubmit={(e) => {
              e.preventDefault();
              remix();
            }}
            className="overflow-hidden"
          >
            <div className="mt-4 flex items-end gap-2 rounded-2xl border border-line-strong bg-surface p-2 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
              <label htmlFor="remix" className="sr-only">
                What should change in the whole design?
              </label>
              <textarea
                id="remix"
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    remix();
                  }
                  if (e.key === "Escape") setRemixing(false);
                }}
                rows={2}
                placeholder="Change the whole design, e.g. 'a bit more modern, with a deeper green accent'"
                className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-faint"
              />
              <button
                type="button"
                onClick={() => setRemixing(false)}
                aria-label="Cancel"
                className="grid size-9 place-items-center rounded-xl text-faint hover:bg-surface-2 hover:text-ink"
              >
                <X size={16} />
              </button>
              <button
                disabled={running || !text.trim()}
                aria-label="Send remix"
                className="grid size-9 place-items-center rounded-xl bg-accent text-white transition hover:bg-accent-hover disabled:bg-line-strong"
              >
                {running ? <CircleNotch size={16} className="animate-spin" /> : <ArrowUp size={16} weight="bold" />}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </header>
  );
}

function TypeSpecimens({ fonts, palette }: { fonts: { display: string; body: string }; palette: DesignPalette }) {
  const rows = [
    { label: "Display", family: fonts.display, size: 40, weight: 700, sample: "햇살 드는 오후, Good afternoon" },
    { label: "Heading", family: fonts.display, size: 26, weight: 700, sample: "다람쥐 헌 쳇바퀴에 타고파" },
    {
      label: "Body",
      family: fonts.body,
      size: 16,
      weight: 400,
      sample: "The quick brown fox jumps over the lazy dog. 동네 가게를 위한 따뜻한 웹사이트를 함께 만들어요.",
    },
    { label: "Small", family: fonts.body, size: 13, weight: 400, sample: "영업시간 10:00 - 22:00 · Opening hours" },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-line" style={{ background: palette.background }}>
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid gap-x-6 gap-y-1 border-b border-black/5 px-5 py-4 last:border-b-0 sm:grid-cols-[110px_minmax(0,1fr)]"
        >
          <div className="text-xs" style={{ color: palette.muted }}>
            <p className="font-semibold" style={{ color: palette.text }}>
              {row.label}
            </p>
            <p className="mt-0.5">
              {row.family} · {row.size}px
            </p>
          </div>
          <p
            className="min-w-0 truncate"
            style={{
              fontFamily: `"${row.family}", sans-serif`,
              fontSize: row.size,
              fontWeight: row.weight,
              color: palette.text,
              lineHeight: 1.25,
            }}
          >
            {row.sample}
          </p>
        </div>
      ))}
    </div>
  );
}

function ComponentGallery({
  projectId,
  file,
  components,
  refreshKey,
  onSelect,
}: {
  projectId: string;
  file: string;
  components: DesignComponent[];
  refreshKey: number;
  onSelect: (id: string) => void;
}) {
  const messages = useMemo(
    () => [
      {
        type: "gs-gallery",
        items: components.map((c) => ({
          id: c.id,
          name: c.name,
          group: c.group,
          used: c.used_on.length,
          wide: c.group === "Navigation" || c.group === "Sections" || WIDE.test(c.id),
        })),
      },
    ],
    [components],
  );
  const onFrameMessage = useCallback(
    (data: Record<string, unknown>) => {
      if (data.type === "gs-select" && typeof data.id === "string") onSelect(data.id);
    },
    [onSelect],
  );
  return (
    <div className="rounded-3xl border border-line bg-surface-2 p-4 sm:p-5">
      <ScaledFrame
        src={api.previewUrl(projectId, `docs/03-design/${file}?gallery=1`)}
        title="Component gallery"
        // deviceWidth 1: never scale down; cards show components at real size.
        deviceWidth={1}
        version={refreshKey}
        messages={messages}
        autoHeight
        transparent
        onFrameMessage={onFrameMessage}
      />
    </div>
  );
}

function ComponentDetail({
  projectId,
  component,
  file,
  palette,
  refreshKey,
  pageName,
  running,
  approved,
  onAsk,
  onBack,
  onPrev,
  onNext,
}: {
  projectId: string;
  component: DesignComponent;
  file: string;
  palette: DesignPalette;
  refreshKey: number;
  pageName: (slug: string) => string;
  running: boolean;
  approved: boolean;
  onAsk: (message: string) => Promise<boolean>;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const reduce = useReducedMotion();
  // Point-and-comment: click a part of the component, say what should change, send them together.
  const [commenting, setCommenting] = useState(false);
  const [draft, setDraft] = useState<PickEvent | null>(null);
  const [target, setTarget] = useState<PickTarget | null>(null);
  const [comments, setComments] = useState<SectionComment[]>([]);
  const marks = useMemo(() => comments.map((c) => ({ n: c.n, selector: c.selector })), [comments]);
  const onPick = useCallback((event: PickEvent) => {
    setDraft(event);
    setTarget(event.chain[0]);
  }, []);

  function addComment(text: string) {
    if (!draft || !target) return;
    const n = (comments.at(-1)?.n ?? 0) + 1;
    setComments([
      ...comments,
      {
        n,
        pageSlug: component.id,
        pageName: component.name,
        selector: target.selector,
        label: target.label,
        kind: target.kind,
        text,
      },
    ]);
    setDraft(null);
  }

  async function sendComments() {
    const ok = await onAsk(componentCommentsMessage(component, comments));
    if (ok) {
      setComments([]);
      setCommenting(false);
    }
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <ArrowLeft size={15} weight="bold" />
          All components
        </button>
        <div className="flex gap-1">
          <button
            onClick={onPrev}
            disabled={!onPrev}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-30"
          >
            Previous
          </button>
          <button
            onClick={onNext}
            disabled={!onNext}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>

      <header>
        <p className="text-xs font-medium text-accent-ink">{component.group}</p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3">
          <h3 className="font-display text-2xl font-bold tracking-tight">{component.name}</h3>
          <span className="font-mono text-xs text-faint">{component.id}</span>
        </div>
        {component.description && <p className="mt-1 max-w-[70ch] text-sm leading-relaxed text-muted">{component.description}</p>}
        {component.used_on.length > 0 && (
          <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-faint">
            Used on
            {component.used_on.map((slug, i) => (
              <span key={`${slug}-${i}`} className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                {pageName(slug)}
              </span>
            ))}
          </p>
        )}
      </header>

      <ComponentPreview
        projectId={projectId}
        file={file}
        componentId={component.id}
        refreshKey={refreshKey}
        palette={palette}
        canComment={!approved}
        commenting={commenting}
        onCommentingChange={(on) => {
          setCommenting(on);
          setDraft(null);
        }}
        marks={marks}
        onPick={onPick}
        focusSelector={draft && target ? target.selector : null}
      />
      <AnimatePresence initial={false}>
        {draft && target && (
          <PartComment
            key={`${draft.selector}-${draft.x}-${draft.y}`}
            pick={draft}
            target={target}
            onTarget={setTarget}
            onAdd={addComment}
            onCancel={() => setDraft(null)}
          />
        )}
      </AnimatePresence>
      <CommentTray
        comments={comments}
        running={running}
        onRemove={(n) => setComments(comments.filter((c) => c.n !== n))}
        onSend={sendComments}
      />
      {!approved && <ChangeBox component={component} running={running} onAsk={onAsk} />}
    </motion.div>
  );
}

/** One change request for a component: each comment names the exact part (its CSS path in the library file). */
function componentCommentsMessage(component: DesignComponent, comments: SectionComment[]) {
  const pages = component.used_on.length ? component.used_on.join(", ") : "every page that uses it";
  const lines = comments.map((c) => `${c.n}. ${targetPhrase(c)} (CSS path in components.html: \`${c.selector}\`): ${c.text}`);
  return (
    `Change the component "${component.name}" (id ${component.id}, in docs/03-design/components.html). ` +
    `The owner pointed at these parts of it:\n\n${lines.join("\n")}\n\n` +
    `Update the component library and apply the same changes on every page that uses it (${pages}). ` +
    `Change only the parts mentioned and keep everything else the same.`
  );
}

/** Comment box for the part the owner clicked, shown under the preview so a small component never clips it. */
function PartComment({
  pick,
  target,
  onTarget,
  onAdd,
  onCancel,
}: {
  pick: PickEvent;
  target: PickTarget;
  onTarget: (target: PickTarget) => void;
  onAdd: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const reduce = useReducedMotion();
  return (
    <motion.form
      initial={reduce ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onAdd(text.trim());
      }}
      className="rounded-2xl border border-accent bg-surface p-3 ring-4 ring-accent-soft"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5 text-xs text-muted">
          <span className="mt-0.5 flex shrink-0 items-center gap-1.5 font-medium text-ink">
            <CursorClick size={13} weight="bold" className="text-accent" />
            Commenting on
          </span>
          <TargetChips chain={pick.chain} value={target} onChange={onTarget} />
        </div>
        <button type="button" onClick={onCancel} aria-label="Cancel comment" className="shrink-0 text-faint hover:text-ink">
          <X size={14} />
        </button>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <label htmlFor="part-comment" className="sr-only">
          What should change here?
        </label>
        <textarea
          id="part-comment"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (text.trim()) onAdd(text.trim());
            }
            if (e.key === "Escape") onCancel();
          }}
          rows={2}
          placeholder='What should change here? e.g. "make this button bigger"'
          className="min-h-9 flex-1 resize-none rounded-xl border border-line-strong px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
        />
        <button
          disabled={!text.trim()}
          className="shrink-0 rounded-xl bg-accent px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:bg-line-strong"
        >
          Add comment
        </button>
      </div>
    </motion.form>
  );
}

const PREVIEW_SIZES = [
  { key: "full", label: "Full width", icon: ArrowsOutLineHorizontal },
  { key: "phone", label: "Phone", icon: DeviceMobile },
];

function ComponentPreview({
  projectId,
  file,
  componentId,
  refreshKey,
  palette,
  canComment,
  commenting,
  onCommentingChange,
  marks,
  onPick,
  focusSelector,
}: {
  projectId: string;
  file: string;
  componentId: string;
  refreshKey: number;
  palette: DesignPalette;
  canComment: boolean;
  commenting: boolean;
  onCommentingChange: (on: boolean) => void;
  marks: { n: number; selector: string }[];
  onPick: (event: PickEvent) => void;
  focusSelector: string | null;
}) {
  const backgrounds = [
    { key: "page", label: "Page", value: palette.background },
    { key: "surface", label: "Surface", value: palette.surface },
    { key: "white", label: "White", value: "#ffffff" },
    { key: "dark", label: "Dark", value: palette.text },
  ];
  const [size, setSize] = useState(PREVIEW_SIZES[0]);
  const [background, setBackground] = useState(backgrounds[0]);
  const messages = useMemo(
    () => [
      { type: "gs-show", id: componentId },
      { type: "gs-bg", value: background.value },
      { type: "gs-focus", selector: focusSelector },
    ],
    [componentId, background.value, focusSelector],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2">
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Preview background">
          {backgrounds.map((b) => (
            <button
              key={b.key}
              role="radio"
              aria-checked={background.key === b.key}
              onClick={() => setBackground(b)}
              title={`${b.label} background`}
              className={`grid size-7 place-items-center rounded-full transition ${
                background.key === b.key ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "hover:scale-110"
              }`}
            >
              <span className="size-5 rounded-full border border-line-strong" style={{ background: b.value }} />
            </button>
          ))}
          <span className="ml-1 text-xs text-faint">{background.label}</span>
        </div>
        <div className="flex items-center gap-1">
          {canComment && (
            <button
              onClick={() => onCommentingChange(!commenting)}
              aria-pressed={commenting}
              className={`mr-1 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-[0.97] ${
                commenting
                  ? "bg-accent text-white shadow-[0_6px_16px_-6px_rgba(34,102,212,0.7)]"
                  : "border border-line-strong text-ink hover:border-accent hover:text-accent-ink"
              }`}
            >
              <CursorClick size={14} weight="bold" />
              {commenting ? "Done commenting" : "Comment"}
            </button>
          )}
          {PREVIEW_SIZES.map((s) => (
            <button
              key={s.key}
              onClick={() => setSize(s)}
              aria-pressed={size.key === s.key}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                size.key === s.key ? "bg-ink text-white" : "text-muted hover:bg-surface-2"
              }`}
            >
              <s.icon size={14} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {commenting && (
        <p className="flex items-center gap-2 border-b border-line bg-accent-soft px-3 py-2 text-xs text-accent-ink">
          <CursorClick size={14} weight="bold" />
          Click any part of the component (a button, a link, a label) to comment on it.
        </p>
      )}

      {/* Dot-grid canvas; the specimen card hugs the component's real height. */}
      <div className="max-h-[560px] overflow-auto bg-surface-2 bg-[radial-gradient(circle,var(--color-line-strong)_1px,transparent_1px)] p-6 [background-size:18px_18px]">
        <div
          className="mx-auto overflow-hidden rounded-2xl shadow-[0_24px_50px_-28px_rgba(14,42,87,0.45),0_0_0_1px_rgba(14,42,87,0.06)] transition-[width] duration-500"
          style={{ width: size.key === "phone" ? 390 : "100%", background: background.value }}
        >
          <ScaledFrame
            src={api.previewUrl(projectId, `docs/03-design/${file}?isolate=1`)}
            title="Component preview"
            deviceWidth={1}
            version={refreshKey}
            messages={messages}
            autoHeight
            pick={commenting}
            marks={marks}
            onPick={onPick}
          />
        </div>
      </div>
    </div>
  );
}

function ChangeBox({
  component,
  running,
  onAsk,
}: {
  component: DesignComponent;
  running: boolean;
  onAsk: (message: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const reduce = useReducedMotion();

  async function submit() {
    const change = text.trim();
    if (!change || running) return;
    const pages = component.used_on.length ? component.used_on.join(", ") : "every page that uses it";
    const ok = await onAsk(
      `Change the component "${component.name}" (id ${component.id}, in docs/03-design/components.html): ${change}. ` +
        `Update the component library and apply the same change on every page that uses it (${pages}). Keep everything else the same.`,
    );
    if (ok) {
      setText("");
      setSent(true);
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface p-2 transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft"
      >
        <label htmlFor="component-change" className="sr-only">
          Change this component
        </label>
        <textarea
          id="component-change"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSent(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={`Change the ${component.name.toLowerCase()}, e.g. "make it more rounded"`}
          className="min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-faint"
        />
        <button
          disabled={running || !text.trim()}
          aria-label="Send change"
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-white transition hover:bg-accent-hover active:scale-95 disabled:bg-line-strong"
        >
          {running ? <CircleNotch size={16} className="animate-spin" /> : <ArrowUp size={16} weight="bold" />}
        </button>
      </form>
      <AnimatePresence>
        {sent && (
          <motion.p
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-xs text-accent-ink"
          >
            Sent. Gagesite updates this component and every page that uses it.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function LibraryMissing({
  running,
  approved,
  hasPages,
  onCreate,
}: {
  running: boolean;
  approved: boolean;
  hasPages: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="grid min-h-[260px] place-items-center rounded-3xl border border-dashed border-line-strong bg-gradient-to-br from-surface-2 to-surface text-center">
      <div className="max-w-sm px-6 py-8">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface text-accent shadow-sm">
          {running ? <CircleNotch size={26} className="animate-spin" /> : <Stack size={26} weight="duotone" />}
        </span>
        <p className="mt-4 font-display text-lg font-bold">{running ? "Gagesite is working..." : "Your component library"}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Every button, form, card and section your site uses, in one place. Change one and it changes on every page.
        </p>
        {hasPages && !approved && !running && (
          <button
            onClick={onCreate}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98]"
          >
            <Stack size={16} weight="bold" />
            Create component library
          </button>
        )}
      </div>
    </div>
  );
}

function Placeholder({ icon: Icon, title, text }: { icon: typeof Stack; title: string; text: string }) {
  return (
    <div className="grid min-h-[420px] flex-1 place-items-center rounded-3xl border border-dashed border-line-strong bg-gradient-to-br from-surface-2 to-surface text-center">
      <div className="max-w-xs px-6">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface text-accent shadow-sm">
          <Icon size={26} weight="duotone" />
        </span>
        <p className="mt-4 font-display text-lg font-bold">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
      </div>
    </div>
  );
}
