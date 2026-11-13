"use client";

import {
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  CircleNotch,
  CursorClick,
  Desktop,
  DeviceMobile,
  DeviceTablet,
  PaintBrush,
  type Icon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CommentPopover, CommentTray, type SectionComment } from "@/components/design/PageComments";
import ScaledFrame, { type PickEvent, type PickTarget } from "@/components/design/ScaledFrame";
import KitSummary from "@/components/design/KitSummary";
import PlanView from "@/components/design/PlanView";
import StyleView from "@/components/design/StyleView";
import ApprovalBar from "@/components/stage/ApprovalBar";
import { api, type DesignArtifact, type DesignKit, type DesignPalette } from "@/lib/api";

type Tab = "plan" | "directions" | "pages" | "style" | "summary" | "input";
const DEVICES: { key: string; icon: Icon; label: string; width: number }[] = [
  { key: "desktop", icon: Desktop, label: "Desktop", width: 1280 },
  { key: "tablet", icon: DeviceTablet, label: "Tablet", width: 768 },
  { key: "phone", icon: DeviceMobile, label: "Phone", width: 390 },
];

export default function DesignPanel({
  projectId,
  artifact,
  approved,
  approvedAt,
  running,
  busy,
  refreshKey,
  onChoose,
  onApprove,
  onReopen,
  onSendComments,
  onAsk,
  kit,
}: {
  projectId: string;
  artifact: DesignArtifact | null;
  approved: boolean;
  approvedAt: string | null;
  running: boolean;
  busy: boolean;
  /** Bumped whenever Claude may have changed files, so previews reload. */
  refreshKey: number;
  /** Resolves false when the choice couldn't be sent. */
  onChoose: (direction: DesignArtifact["directions"][number]) => Promise<boolean>;
  onApprove: () => void;
  onReopen: () => void;
  /** Sends the collected section comments to Claude; resolves true when sent. */
  onSendComments: (comments: SectionComment[]) => Promise<boolean>;
  /** Sends a message to Claude (component changes, creating the library). */
  onAsk: (message: string) => Promise<boolean>;
  /** What the owner gave at the start (colours, logo, notes...), shown on the "Your input" tab. */
  kit: DesignKit | null;
}) {
  const [tab, setTab] = useState<Tab>("directions");
  // The direction just clicked: Gagesite records the choice only once it starts on the pages,
  // so this shows it as chosen (and the Pages tab as in progress) right away.
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(null);
  const choose = (direction: DesignArtifact["directions"][number]) => {
    setPicked({ id: direction.id, name: direction.name });
    setTab("pages");
    onChoose(direction).then((sent) => {
      if (sent) return;
      setPicked(null);
      setTab("directions");
    });
  };
  const [comments, setComments] = useState<SectionComment[]>([]);
  const status = artifact?.status ?? null;
  // The layout plan (products to follow, layout, navigation): written just before the styles and
  // shown beside them. Nothing to approve: changes are asked for in the chat.
  const [plan, setPlan] = useState<{ exists: boolean; needed: boolean } | null>(null);
  useEffect(() => {
    api
      .getDesignPlan(projectId)
      .then((info) => setPlan({ exists: !!info.plan, needed: info.needed }))
      .catch(() => setPlan(null));
  }, [projectId, refreshKey, running]);
  const drawnStyles = artifact?.directions.length ?? 0;
  // While the styles are still being drawn, show the plan they follow; then the styles.
  useEffect(() => {
    if (plan?.exists && !drawnStyles) setTab("plan");
    else if (drawnStyles) setTab((t) => (t === "plan" ? "directions" : t));
  }, [plan?.exists, drawnStyles]);
  const pagesDone = artifact?.pages.filter((p) => p.exists).length ?? 0;

  // Follow the work: once Claude starts on pages, show them.
  useEffect(() => {
    if (status === "designing" || status === "ready") setTab("pages");
  }, [status]);

  const tabs: { key: Tab; label: string; badge?: string }[] = [
    {
      key: "directions",
      // While choosing between several styles, say so on the tab itself.
      label: status === "choosing" && (artifact?.directions.length ?? 0) > 1 ? "Looks" : "Look",
      badge: status === "choosing" && (artifact?.directions.length ?? 0) > 1 ? `${artifact?.directions.length}` : undefined,
    },
    ...(plan?.exists ? [{ key: "plan" as Tab, label: "Layout plan" }] : []),
    { key: "style", label: "Components" },
    { key: "pages", label: "Key pages", badge: artifact?.pages.length ? `${pagesDone}/${artifact.pages.length}` : undefined },
    { key: "summary", label: "Summary" },
    { key: "input", label: "Your input" },
  ];

  return (
    <section className="flex h-full min-h-0 w-full flex-col border-line bg-surface lg:border-l">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 pb-3 pt-5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-lg font-bold tracking-tight">Design</h2>
          {running && <span className="text-xs text-accent-ink">Gagesite is working...</span>}
        </div>
        <div className="flex overflow-x-auto rounded-xl bg-surface-2 p-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                tab === t.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.badge && <span className="rounded-full bg-accent-soft px-1.5 text-[10px] text-accent-ink">{t.badge}</span>}
            </button>
          ))}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6">
        {artifact && artifact.errors.length > 0 && (
          <div className="mb-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {artifact.errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}
        {artifact === null ? (
          <div className="h-full min-h-[420px] animate-pulse rounded-3xl bg-surface-2" aria-label="Loading design" />
        ) : tab === "plan" ? (
          <PlanView projectId={projectId} running={running} approved={approved} refreshKey={refreshKey} />
        ) : tab === "directions" ? (
          <>
            <DirectionsView
              projectId={projectId}
              artifact={artifact}
              running={running}
              refreshKey={refreshKey}
              approved={approved}
              pickedId={artifact.status === "choosing" ? (picked?.id ?? null) : null}
              onChoose={choose}
            />
          </>
        ) : tab === "pages" ? (
          <PagesView
            projectId={projectId}
            artifact={artifact}
            running={running}
            pickedName={artifact.status === "choosing" ? (picked?.name ?? null) : null}
            refreshKey={refreshKey}
            approved={approved}
            comments={comments}
            onCommentsChange={setComments}
            onSendComments={async () => {
              if (await onSendComments(comments)) setComments([]);
            }}
          />
        ) : tab === "style" ? (
          <StyleView
            projectId={projectId}
            artifact={artifact}
            running={running}
            approved={approved}
            refreshKey={refreshKey}
            onAsk={onAsk}
          />
        ) : tab === "input" ? (
          <KitSummary projectId={projectId} kit={kit} />
        ) : artifact.markdown ? (
          <div className="prose-doc text-[15px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.markdown}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted">Gagesite writes a short description of the look once every page is done.</p>
        )}
      </div>

      <ApprovalBar
        approved={approved}
        approvedAt={approvedAt}
        ready={artifact?.ready ?? false}
        openCount={artifact?.open_questions.length ?? 0}
        running={running}
        busy={busy}
        approveLabel="Approve design"
        approvedLabel="Design approved"
        readyHint="Approving unlocks building the real website."
        draftHint={
          status === "choosing"
            ? picked
              ? `Gagesite is building your components and key pages in the ${picked.name} style.`
              : "Ask for changes in the chat, or use this style to continue."
            : status === "designing"
              ? `Gagesite is designing your pages (${pagesDone} of ${artifact?.pages.length ?? 0} done).`
              : artifact && artifact.pages.every((p) => p.exists) && !artifact.components_file
                ? "One step left: create the component library on the Style tab."
                : "Gagesite marks the design ready once every page is done."
        }
        onApprove={onApprove}
        onReopen={onReopen}
      />
    </section>
  );
}

function Empty({ running, title, text }: { running: boolean; title: string; text: string }) {
  return (
    <div className="grid min-h-[420px] flex-1 place-items-center rounded-3xl border border-dashed border-line-strong bg-gradient-to-br from-surface-2 to-surface text-center">
      <div className="max-w-xs px-6">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface text-accent shadow-sm">
          {running ? <CircleNotch size={26} className="animate-spin" /> : <PaintBrush size={26} weight="duotone" />}
        </span>
        <p className="mt-4 font-display text-lg font-bold">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
      </div>
    </div>
  );
}

type Direction = DesignArtifact["directions"][number];
const SWATCHES: (keyof DesignPalette)[] = ["background", "surface", "primary", "accent", "text"];

function DirectionsView({
  projectId,
  artifact,
  running,
  refreshKey,
  approved,
  pickedId,
  onChoose,
}: {
  projectId: string;
  artifact: DesignArtifact;
  running: boolean;
  refreshKey: number;
  approved: boolean;
  /** Just clicked, before Gagesite has recorded it. */
  pickedId: number | null;
  onChoose: (direction: Direction) => void;
}) {
  const directions = artifact.directions;
  const chosenId = pickedId ?? artifact.chosen_direction;
  // Open on the style in use, else the recommended one, else the first.
  const [viewing, setViewing] = useState<number | null>(null);
  // A style Google Stitch drew can be seen as Stitch drew it, next to Gagesite's version.
  const [source, setSource] = useState<"gagesite" | "stitch">("gagesite");
  const current =
    directions.find((d) => d.id === viewing) ??
    directions.find((d) => d.id === chosenId) ??
    directions.find((d) => d.recommended) ??
    directions[0];

  if (!current) {
    return (
      <Empty
        running={running}
        title={running ? "Designing three styles for you..." : "Your styles will appear here"}
        text={
          running
            ? "Gagesite is drawing three different looks, each with the top of your home page and the main building blocks (buttons, cards, forms), using your logo, colours and notes. They appear one by one; this takes a few minutes."
            : "Gagesite drafts three different looks on your own content. Pick one, ask for changes, or mix them in the chat."
        }
      />
    );
  }

  const index = directions.indexOf(current);
  const several = directions.length > 1;
  const go = (step: number) => setViewing(directions[(index + step + directions.length) % directions.length].id);
  const chosen = chosenId === current.id;
  const original = current.made_with === "stitch" ? current.stitch_original : null;
  const showStitch = source === "stitch" && !!original;
  const stitchImage = original?.image ? api.stitchOriginalUrl(projectId, original.image) : null;
  const stitchPage = original?.html ? api.stitchOriginalUrl(projectId, original.html) : null;
  const url = showStitch
    ? (stitchPage ?? stitchImage ?? "")
    : api.previewUrl(projectId, `docs/03-design/${current.file}`);

  return (
    <div className="space-y-3">
      {several && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div
            role="tablist"
            aria-label="Styles to choose from"
            className="flex flex-wrap gap-1.5 rounded-2xl bg-surface-2 p-1.5"
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                go(e.key === "ArrowRight" ? 1 : -1);
              }
            }}
          >
            {directions.map((direction, i) => (
              <StyleTab
                key={direction.id}
                direction={direction}
                number={i + 1}
                active={direction.id === current.id}
                inUse={direction.id === chosenId}
                onSelect={() => setViewing(direction.id)}
              />
            ))}
          </div>
          <p className="text-xs text-faint">
            {directions.length} styles to compare · arrows or ‹ › to flip through
          </p>
        </div>
      )}

      <article
        key={current.id}
        className={`overflow-hidden rounded-3xl border transition duration-300 [animation:rise-in_220ms_ease-out] ${
          chosen ? "border-accent shadow-[0_18px_40px_-24px_rgba(34,102,212,0.6)]" : "border-line"
        }`}
      >
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line bg-surface px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {several && <span className="text-sm font-medium text-faint">Style {index + 1}</span>}
              {current.name}
              {current.recommended && several && <Badge tone="accent">Recommended</Badge>}
              {chosen && <Badge tone="success">In use</Badge>}
              {current.made_with === "stitch" && (
                <span className="whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted">
                  Drawn with Google Stitch
                </span>
              )}
            </p>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted">{current.summary}</p>
            {!!current.inspired_by?.length && (
              <p className="mt-1 text-xs text-muted" title={current.borrowed || undefined}>
                <span className="font-medium text-ink">Inspired by </span>
                {current.inspired_by.join(", ")}
              </p>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              {SWATCHES.map((key) => (
                <span
                  key={key}
                  title={`${key}: ${current.palette?.[key]}`}
                  className="size-4 rounded-full border border-line"
                  style={{ background: current.palette?.[key] }}
                />
              ))}
              <span className="ml-1.5 text-xs text-faint">
                {current.fonts?.display} / {current.fonts?.body}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm font-medium transition hover:border-accent hover:text-accent-ink"
            >
              Full size <ArrowSquareOut size={13} />
            </a>
            {!approved && (
              <button
                onClick={() => onChoose(current)}
                disabled={running || chosen || !current.exists}
                className={`h-10 rounded-xl px-4 text-sm font-semibold transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed ${
                  chosen
                    ? "bg-accent-soft text-accent-ink"
                    : "bg-accent text-white hover:-translate-y-0.5 hover:bg-accent-hover disabled:translate-y-0 disabled:bg-line-strong"
                }`}
              >
                {chosen ? "In use" : several ? `Use style ${index + 1}` : "Use this style"}
              </button>
            )}
          </div>
        </header>
        {original && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-4 py-2">
            <div role="radiogroup" aria-label="Which version to show" className="flex rounded-lg bg-surface-2 p-0.5">
              {(
                [
                  ["gagesite", "Gagesite's version"],
                  ["stitch", "Stitch's original"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  role="radio"
                  aria-checked={source === key}
                  onClick={() => setSource(key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition duration-200 ${
                    source === key ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="min-w-0 flex-1 text-xs text-muted">
              {showStitch
                ? "As Google Stitch drew it. Gagesite rebuilt it with your real content and fixed what broke the design rules; Implementation builds from Gagesite's version."
                : "Gagesite's rebuild of Stitch's screen: your real content, the building blocks, and the design rules applied."}
            </p>
          </div>
        )}
        <div className="relative aspect-[16/10] bg-surface-2">
          {showStitch ? (
            stitchImage ? (
              <div className="absolute inset-0 overflow-y-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={stitchImage}
                  alt={`Google Stitch's original screen for style ${index + 1}`}
                  className="block w-full"
                />
              </div>
            ) : (
              <iframe
                src={stitchPage ?? undefined}
                title={`Google Stitch's original page for style ${index + 1}`}
                sandbox="allow-scripts"
                className="absolute inset-0 h-full w-full border-0 bg-white"
              />
            )
          ) : current.exists ? (
            <ScaledFrame src={url} title={`Style ${index + 1}: ${current.name}`} interactive={false} version={refreshKey} />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted">
              <span className="inline-flex items-center gap-2">
                <CircleNotch size={16} className="animate-spin" />
                Drawing this style...
              </span>
            </div>
          )}
          {several && (
            <>
              <ArrowButton side="left" label="Previous style" onClick={() => go(-1)} />
              <ArrowButton side="right" label="Next style" onClick={() => go(1)} />
            </>
          )}
        </div>
      </article>
      {several && !approved && (
        <p className="text-xs text-muted">
          Not quite right? Ask in the chat, e.g. &ldquo;make style 2 warmer&rdquo; or &ldquo;style 1 with the photos of
          style 3&rdquo;.
        </p>
      )}
    </div>
  );
}

/** One style in the picker: its number, name and colours. */
function StyleTab({
  direction,
  number,
  active,
  inUse,
  onSelect,
}: {
  direction: Direction;
  number: number;
  active: boolean;
  inUse: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft ${
        active ? "bg-surface font-semibold text-ink shadow-sm ring-1 ring-accent/40" : "text-muted hover:bg-surface/70 hover:text-ink"
      }`}
    >
      <span
        className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
          active ? "bg-accent text-white" : "bg-surface text-muted ring-1 ring-line"
        }`}
      >
        {number}
      </span>
      <span className="truncate">{direction.name}</span>
      <span className="flex -space-x-1">
        {SWATCHES.slice(2, 4).map((key) => (
          <span key={key} className="size-3 rounded-full ring-2 ring-surface" style={{ background: direction.palette?.[key] }} />
        ))}
      </span>
      {inUse ? <Badge tone="success">In use</Badge> : direction.recommended ? <Badge tone="accent">Recommended</Badge> : null}
    </button>
  );
}

function ArrowButton({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  const Arrow = side === "left" ? CaretLeft : CaretRight;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-ink shadow-md ring-1 ring-line backdrop-blur transition duration-200 hover:scale-105 hover:bg-surface active:scale-95 ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <Arrow size={18} weight="bold" />
    </button>
  );
}

function Badge({ tone, children }: { tone: "accent" | "success"; children: React.ReactNode }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        tone === "accent" ? "bg-accent-soft text-accent-ink" : "bg-emerald-50 text-emerald-800"
      }`}
    >
      {children}
    </span>
  );
}

function PagesView({
  projectId,
  artifact,
  running,
  pickedName,
  refreshKey,
  approved,
  comments,
  onCommentsChange,
  onSendComments,
}: {
  projectId: string;
  artifact: DesignArtifact;
  running: boolean;
  /** The direction just chosen, while Gagesite is starting on the pages. */
  pickedName: string | null;
  refreshKey: number;
  approved: boolean;
  comments: SectionComment[];
  onCommentsChange: (comments: SectionComment[]) => void;
  onSendComments: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState(DEVICES[0]);
  const [commenting, setCommenting] = useState(false);
  const [draft, setDraft] = useState<PickEvent | null>(null);
  const [target, setTarget] = useState<PickTarget | null>(null);
  const frameBoxRef = useRef<HTMLDivElement>(null);
  const firstDone = artifact.pages.find((p) => p.exists)?.slug;
  const page = artifact.pages.find((p) => p.slug === (selected ?? firstDone)) ?? artifact.pages[0];
  const pageSlug = page?.slug;
  const pageMarks = useMemo(
    () => comments.filter((c) => c.pageSlug === pageSlug).map((c) => ({ n: c.n, selector: c.selector })),
    [comments, pageSlug],
  );
  const onPick = useCallback((event: PickEvent) => {
    setDraft(event);
    setTarget(event.chain[0]);
  }, []);
  // Outline the part the open comment is about (the owner may widen it to the card or section).
  const focusMessages = useMemo(
    () => [{ type: "gs-focus", selector: draft && target ? target.selector : null }],
    [draft, target],
  );

  if (!artifact.pages.some((p) => p.exists)) {
    return (
      <Empty
        running={running && (artifact.status === "designing" || !!pickedName)}
        title={
          pickedName
            ? `Gagesite is designing in the ${pickedName} style...`
            : artifact.status === "designing"
              ? "Gagesite is designing your pages..."
              : "Your pages appear here"
        }
        text={
          artifact.status === "choosing" && !pickedName
            ? "Choose the style first. Then the component library and your key pages are designed in it."
            : "First the colours and fonts, then the component library, then your key pages. They show up as they are finished, which takes a few minutes."
        }
      />
    );
  }

  const src = api.previewUrl(projectId, `docs/03-design/${page.file}`);
  const addComment = (text: string) => {
    if (!draft || !target) return;
    const n = (comments.at(-1)?.n ?? 0) + 1;
    onCommentsChange([
      ...comments,
      { n, pageSlug: page.slug, pageName: page.name, selector: target.selector, label: target.label, kind: target.kind, text },
    ]);
    setDraft(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {artifact.pages.map((p) => {
            const count = comments.filter((c) => c.pageSlug === p.slug).length;
            return (
              <button
                key={p.slug}
                onClick={() => {
                  if (!p.exists) return;
                  setSelected(p.slug);
                  setDraft(null);
                }}
                disabled={!p.exists}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  p.slug === page.slug
                    ? "bg-accent-soft text-accent-ink"
                    : p.exists
                      ? "text-muted hover:bg-surface-2 hover:text-ink"
                      : "text-faint"
                }`}
              >
                {p.exists ? (
                  <span className="size-1.5 rounded-full bg-accent" />
                ) : running ? (
                  <CircleNotch size={11} className="animate-spin" />
                ) : (
                  <span className="size-1.5 rounded-full bg-line-strong" />
                )}
                {p.name}
                {count > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] text-white">{count}</span>}
              </button>
            );
          })}
          {(artifact.later_pages?.length ?? 0) > 0 && (
            <span
              className="self-center px-1.5 text-xs text-faint"
              title={`Built in the next step from your components: ${artifact.later_pages!.map((p) => p.name).join(", ")}`}
            >
              +{artifact.later_pages!.length} more built in the next step
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!approved && (
            <button
              onClick={() => {
                setCommenting((v) => !v);
                setDraft(null);
              }}
              aria-pressed={commenting}
              className={`mr-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-[0.97] ${
                commenting
                  ? "bg-accent text-white shadow-[0_6px_16px_-6px_rgba(34,102,212,0.7)]"
                  : "border border-line-strong text-ink hover:border-accent hover:text-accent-ink"
              }`}
            >
              <CursorClick size={14} weight="bold" />
              {commenting ? "Done commenting" : "Comment"}
            </button>
          )}
          {DEVICES.map((d) => (
            <button
              key={d.key}
              onClick={() => {
                setDevice(d);
                setDraft(null);
              }}
              aria-label={d.label}
              aria-pressed={device.key === d.key}
              className={`grid size-8 place-items-center rounded-lg transition ${
                device.key === d.key ? "bg-ink text-white" : "text-muted hover:bg-surface-2"
              }`}
            >
              <d.icon size={16} />
            </button>
          ))}
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open full size"
            className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2"
          >
            <ArrowSquareOut size={16} />
          </a>
        </div>
      </div>

      {commenting && (
        <p className="flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-xs text-accent-ink">
          <CursorClick size={14} weight="bold" />
          Click any part of the page to leave a comment. Links do not open while commenting.
        </p>
      )}

      <div
        className={`flex min-h-[460px] flex-1 justify-center overflow-hidden rounded-3xl border bg-surface-2 p-3 transition ${
          commenting ? "border-accent ring-4 ring-accent-soft" : "border-line"
        }`}
      >
        <div
          ref={frameBoxRef}
          className="relative h-full overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-24px_rgba(14,42,87,0.4)] transition-[width] duration-500"
          style={{ width: device.key === "desktop" ? "100%" : device.width }}
        >
          <ScaledFrame
            src={src}
            title={page.name}
            deviceWidth={device.width}
            version={refreshKey}
            pick={commenting}
            marks={pageMarks}
            onPick={onPick}
            messages={focusMessages}
          />
          {draft && target && (
            <CommentPopover
              key={`${draft.selector}-${draft.x}-${draft.y}`}
              pick={draft}
              target={target}
              onTarget={setTarget}
              boxWidth={frameBoxRef.current?.clientWidth ?? 600}
              boxHeight={frameBoxRef.current?.clientHeight ?? 460}
              onAdd={addComment}
              onCancel={() => setDraft(null)}
            />
          )}
        </div>
      </div>

      <CommentTray
        comments={comments}
        running={running}
        onRemove={(n) => onCommentsChange(comments.filter((c) => c.n !== n))}
        onSend={() => {
          onSendComments();
          setCommenting(false);
        }}
      />
    </div>
  );
}
