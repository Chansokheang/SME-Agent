"use client";

import {
  ArrowRight,
  Code,
  FileText,
  ImageSquare,
  Minus,
  PencilSimple,
  Plus,
  TreeStructure,
  UploadSimple,
  type Icon,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FlowSwimlane,
  LifecycleDiagram,
} from "@/components/scope/PlanDiagrams";
import SiteMap, { lifecycleAnchor } from "@/components/scope/SiteMap";
import ApprovalBar from "@/components/stage/ApprovalBar";
import {
  api,
  type ContentItem,
  type Scope,
  type ScopeArtifact,
  type ScopeDetails,
} from "@/lib/api";

/*
 * The plan as one plain document: numbered sections and subsections, like a requirements
 * document. Empty subsections are left out and the numbering closes up. Claude writes
 * docs/01-scope.json during the chat; this view re-renders whenever the file changes.
 */

type View = "plan" | "map" | "summary" | "json";
/** Whether the owner can type their details into the plan right now, and how to save them. */
type DetailsEditing = {
  editable: boolean;
  lockedNote: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave?: (details: ScopeDetails) => Promise<void>;
  /** Image items of the checklist: upload the owner's files, or use sample photos for now. */
  projectId?: string;
  onUploadContent?: (
    index: number,
    item: string,
    files: File[],
  ) => Promise<void>;
  onChooseContent?: (
    index: number,
    item: string,
    status: "needed" | "placeholder",
  ) => Promise<void>;
};
/** `action` sits on the right of the subsection heading (e.g. an Edit button). */
type Sub = {
  id: string;
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
};
type Sec = { id: string; title: string; subs: Sub[] };

/** Things waiting on the owner: decisions to make and content to send. */
function pendingCount(scope: Scope) {
  return (
    scope.open_questions.length +
    (scope.content_checklist ?? []).filter(
      (c) => effectiveStatus(c, scope.details) === "needed",
    ).length +
    (scope.details?.other ?? []).filter((o) => o.label && !o.value).length
  );
}

export default function ScopePanel({
  artifact,
  approved,
  approvedAt,
  running,
  busy,
  onApprove,
  onReopen,
  onSaveDetails,
  projectId,
  onUploadContent,
  onChooseContent,
  footer,
}: {
  artifact: ScopeArtifact | null;
  approved: boolean;
  approvedAt: string | null;
  running: boolean;
  busy: boolean;
  onApprove: () => void;
  onReopen: () => void;
  onSaveDetails?: (details: ScopeDetails) => Promise<void>;
  projectId?: string;
  onUploadContent?: DetailsEditing["onUploadContent"];
  onChooseContent?: DetailsEditing["onChooseContent"];
  /** Shown at the bottom of the plan (e.g. "Only need a landing page?"). */
  footer?: React.ReactNode;
}) {
  const [view, setView] = useState<View>("plan");
  const scrollRef = useRef<HTMLDivElement>(null);
  const scope = artifact?.data;
  const pending = scope ? pendingCount(scope) : 0;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const editing: DetailsEditing = useMemo(() => {
    const editable = !!onSaveDetails && !approved && !running;
    return {
      editable,
      lockedNote: approved
        ? "The plan is approved. Reopen it to change your details."
        : running
          ? "You can edit these once Gagesite finishes."
          : "",
      // The form closes by itself if Claude starts working or the plan gets approved.
      open: detailsOpen && editable,
      setOpen: setDetailsOpen,
      onSave: onSaveDetails,
      projectId,
      onUploadContent,
      onChooseContent,
    };
  }, [
    onSaveDetails,
    approved,
    running,
    detailsOpen,
    projectId,
    onUploadContent,
    onChooseContent,
  ]);
  const sections = useMemo(
    () => (scope ? buildDocument(scope, editing) : []),
    [scope, editing],
  );

  const status = running
    ? "Gagesite is updating the plan"
    : approved
      ? "Approved"
      : scope?.status === "ready"
        ? "Ready for your review"
        : scope
          ? "Draft, filling in as you chat"
          : "Starts with your first message";

  const jumpTo = (id: string) => {
    setView("plan");
    // Two frames: coming from another view, the plan has to render before it can scroll.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      ),
    );
  };

  return (
    <section className="flex h-full min-h-0 w-full flex-col border-line bg-surface lg:border-l">
      <header className="border-b border-line px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold tracking-tight">
              The plan
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
              <span
                className={`size-1.5 rounded-full ${
                  running
                    ? "animate-pulse bg-accent"
                    : approved || scope?.status === "ready"
                      ? "bg-emerald-500"
                      : "bg-line-strong"
                }`}
              />
              {status}
              {pending > 0 && (
                <>
                  <span className="text-faint">·</span>
                  <button
                    onClick={() => jumpTo("your-information")}
                    className="text-muted underline-offset-2 transition hover:text-accent-ink hover:underline"
                  >
                    {pending} {pending === 1 ? "thing" : "things"} to add later
                  </button>
                </>
              )}
            </p>
          </div>
          <div
            className="flex shrink-0 items-center gap-0.5"
            role="tablist"
            aria-label="Plan views"
          >
            <ViewButton
              icon={FileText}
              label="Plan"
              active={view === "plan"}
              onClick={() => setView("plan")}
              text
            />
            <ViewButton
              icon={TreeStructure}
              label="Site map"
              active={view === "map"}
              onClick={() => setView("map")}
              text
            />
            <ViewButton
              icon={FileText}
              label="Short summary"
              active={view === "summary"}
              onClick={() => setView("summary")}
            />
            <ViewButton
              icon={Code}
              label="Developer view (JSON)"
              active={view === "json"}
              onClick={() => setView("json")}
            />
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        {artifact && artifact.errors.length > 0 && (
          <div className="mx-6 mt-5 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            <p className="font-medium">The plan file has problems:</p>
            <ul className="mt-1 list-disc pl-5">
              {artifact.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {artifact === null ? (
          <Skeleton />
        ) : !scope ? (
          <EmptyScope />
        ) : view === "summary" ? (
          <div className="mx-auto max-w-[44rem] px-6 py-8">
            {artifact.markdown ? (
              <div className="prose-doc text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {artifact.markdown}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Gagesite writes a short summary once the plan is ready.
              </p>
            )}
          </div>
        ) : view === "map" ? (
          <SiteMap scope={scope} projectId={projectId} onOpen={jumpTo} />
        ) : view === "json" ? (
          <div className="px-6 py-6">
            <p className="mb-3 text-xs text-faint">
              The plan as a file. The next stages read it; you never need to
              edit it.
            </p>
            <pre className="overflow-x-auto rounded-xl bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink">
              {JSON.stringify(scope, null, 2)}
            </pre>
          </div>
        ) : (
          <PlanDocument
            scope={scope}
            sections={sections}
            scrollRef={scrollRef}
          />
        )}
        {footer}
      </div>

      <ApprovalBar
        approved={approved}
        approvedAt={approvedAt}
        ready={artifact?.approvable ?? artifact?.ready ?? false}
        openCount={artifact?.data?.open_questions.length ?? 0}
        running={running}
        busy={busy}
        approveLabel="Approve plan"
        approvedLabel="Plan approved"
        readyHint="Approving unlocks database design."
        draftHint="Gagesite marks the plan ready once the main questions are answered."
        message={
          artifact && scope ? (
            <ApproveMessage
              artifact={artifact}
              pending={pending}
              onShow={() => jumpTo("your-information")}
            />
          ) : undefined
        }
        // Approving with things still to add is fine: the message above the button already says so.
        onApprove={onApprove}
        onReopen={onReopen}
      />
    </section>
  );
}

/** What the plan needs before it can be approved, and what can wait. */
function ApproveMessage({
  artifact,
  pending,
  onShow,
}: {
  artifact: ScopeArtifact;
  pending: number;
  onShow: () => void;
}) {
  const missing = (artifact.required ?? [])
    .filter((r) => !r.done)
    .map((r) => r.label);
  if (artifact.errors.length)
    return <>The plan file has a problem Gagesite still needs to fix.</>;
  if (missing.length) {
    return (
      <>
        <span className="font-semibold text-ink">
          To approve, only add {missing.join(", ")}.
        </span>{" "}
        {missing.includes("the business name")
          ? "Tell Gagesite in the chat, or type it under 5.1 Your details."
          : "Tell Gagesite in the chat."}{" "}
        Everything else can wait.
      </>
    );
  }
  if (artifact.ready || pending === 0) {
    return (
      <>
        <span className="font-semibold text-ink">Ready for your review.</span>{" "}
        Approving unlocks database design.
      </>
    );
  }
  return (
    <>
      <span className="font-semibold text-ink">You can approve now.</span>{" "}
      <button
        onClick={onShow}
        className="text-accent-ink underline-offset-2 hover:underline"
      >
        {pending} {pending === 1 ? "thing" : "things"}
      </button>{" "}
      can be added later; the next steps use sensible defaults until then.
    </>
  );
}

function ViewButton({
  icon: IconComponent,
  label,
  active,
  onClick,
  text,
}: {
  icon: Icon;
  label: string;
  active: boolean;
  onClick: () => void;
  text?: boolean;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition ${
        active
          ? "bg-accent-soft text-accent-ink"
          : "text-faint hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {text ? label : <IconComponent size={16} />}
    </button>
  );
}

function EmptyScope() {
  return (
    <div className="grid h-full place-items-center px-6 py-16 text-center">
      <div className="max-w-xs">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <FileText size={28} />
        </span>
        <p className="mt-4 font-display text-lg font-bold">
          Your plan starts here
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          As you chat, Gagesite writes the plan here: goals, features, how the
          site works and what it costs.
        </p>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div
      className="mx-auto max-w-[44rem] animate-pulse space-y-4 px-6 py-8"
      aria-label="Loading plan"
    >
      <div className="h-7 w-48 rounded bg-surface-2" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-4 rounded bg-surface-2"
          style={{ width: `${90 - i * 8}%` }}
        />
      ))}
    </div>
  );
}

/* ---------- the document ---------- */

function PlanDocument({
  scope,
  sections,
  scrollRef,
}: {
  scope: Scope;
  sections: Sec[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [active, setActive] = useState(sections[0]?.id);
  const reduce = useReducedMotion();

  // Highlight the section being read: the last one whose heading has scrolled past the top.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = root.getBoundingClientRect().top + 120;
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= top) current = s.id;
      }
      // At the very bottom, the last section is the one being read.
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4)
        current = sections.at(-1)?.id ?? current;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [sections, scrollRef]);

  const go = (id: string) =>
    document.getElementById(id)?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="@container"
    >
      <div className="mx-auto grid max-w-[64rem] gap-10 px-6 py-8 @4xl:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Contents" className="hidden @4xl:block">
          <div className="sticky top-8">
            <p className="text-xs font-semibold text-ink">Contents</p>
            <ol className="mt-3 space-y-1 border-l border-line">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <button
                    onClick={() => go(s.id)}
                    className={`-ml-px block w-full border-l-2 py-1 pl-3 text-left text-[13px] transition ${
                      active === s.id
                        ? "border-accent font-medium text-ink"
                        : "border-transparent text-muted hover:text-ink"
                    }`}
                  >
                    <span className="mr-1.5 tabular-nums text-faint">
                      {i + 1}
                    </span>
                    {s.title}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="min-w-0 max-w-[44rem]">
          <header className="pb-6">
            {scope.site_type && (
              <p className="text-xs font-medium text-accent-ink first-letter:uppercase">
                {scope.site_type}
              </p>
            )}
            <h1 className="mt-1 font-display text-[1.75rem] font-bold leading-tight tracking-tight">
              {scope.business.name || "Your business"}: website plan
            </h1>
            {scope.business.description && (
              <p className="mt-2 text-sm leading-7 text-muted">
                {scope.business.description}
              </p>
            )}
          </header>

          {sections.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              className="scroll-mt-6 border-t border-line pb-4 pt-8"
            >
              <h2 className="font-display text-xl font-bold tracking-tight">
                <span className="mr-2 tabular-nums text-accent">{i + 1}</span>
                {s.title}
              </h2>
              {s.subs.map((sub, j) => (
                <div key={sub.id} id={sub.id} className="scroll-mt-6 pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[15px] font-semibold">
                      <span className="mr-2 tabular-nums text-faint">
                        {i + 1}.{j + 1}
                      </span>
                      {sub.title}
                    </h3>
                    {sub.action}
                  </div>
                  <div className="mt-2 space-y-3 text-sm leading-7 text-ink">
                    {sub.body}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </article>
      </div>
    </motion.div>
  );
}

/** Lays the plan out as sections and subsections; anything empty is left out. */
function buildDocument(scope: Scope, editing?: DetailsEditing): Sec[] {
  const brief = scope.brief ?? {};
  const { business } = scope;
  const must = scope.features.filter((f) => f.priority === "must");
  const should = scope.features.filter((f) => f.priority === "should");
  const could = scope.features.filter((f) => f.priority === "could");
  const goals = brief.goals?.length
    ? brief.goals
    : business.goals.map((goal) => ({ goal, measure: "" }));
  const customers = brief.customers?.length
    ? brief.customers
    : business.target_customers.map((name) => ({
        name,
        needs: [] as string[],
      }));
  const value = brief.value;
  const economics = brief.economics;
  const launch = brief.launch;
  const running = brief.running;

  const sub = (
    id: string,
    title: string,
    show: unknown,
    body: () => React.ReactNode,
    action?: React.ReactNode,
  ): Sub | null => (show ? { id, title, body: body(), action } : null);

  const sections: { id: string; title: string; subs: (Sub | null)[] }[] = [
    {
      id: "overview",
      title: "Overview",
      subs: [
        sub(
          "overview-about",
          "About the business",
          business.industry || business.location || business.languages.length,
          () => (
            <Facts
              rows={[
                ["Type", business.industry],
                ["Location", business.location],
                ["Languages", business.languages.join(", ")],
                ["Site", scope.site_type],
              ]}
            />
          ),
        ),
        sub("overview-action", "Main action", brief.main_action?.label, () => (
          <p>
            <strong className="font-semibold">
              {brief.main_action!.label}.
            </strong>{" "}
            {brief.main_action!.why}
          </p>
        )),
        sub("overview-goals", "Goals", goals.length, () =>
          goals.some((g) => g.measure) ? (
            <Table
              head={["Goal", "How we will know"]}
              rows={goals.map((g) => [g.goal, g.measure])}
            />
          ) : (
            <Bullets items={goals.map((g) => g.goal)} />
          ),
        ),
        sub("overview-customers", "Customers", customers.length, () => (
          <ul className="list-disc space-y-1.5 pl-5 marker:text-line-strong">
            {customers.map((c) => (
              <li key={c.name}>
                <strong className="font-semibold">{c.name}</strong>
                {c.needs.length > 0 && (
                  <span className="text-muted">: {c.needs.join("; ")}</span>
                )}
              </li>
            ))}
          </ul>
        )),
        sub(
          "overview-look",
          "Look and feel",
          scope.branding.tone ||
            scope.branding.style_notes ||
            scope.branding.colors.length,
          () => (
            <>
              <p>
                {[scope.branding.tone, scope.branding.style_notes]
                  .filter(Boolean)
                  .join(". ")}
              </p>
              {scope.branding.colors.length > 0 && (
                <p className="text-muted">
                  Colours: {scope.branding.colors.join(", ")}
                </p>
              )}
            </>
          ),
        ),
      ],
    },
    {
      id: "features",
      title: "Features",
      subs: [
        sub("features-must", "First version", must.length, () => (
          <ul className="list-disc space-y-3 pl-5 marker:text-line-strong">
            {must.map((f) => (
              <li key={f.id}>
                <strong className="font-semibold">{f.name}.</strong>{" "}
                {f.description}
                {(f.done_when?.length ?? 0) > 0 && (
                  <>
                    <p className="mt-1 text-xs font-medium text-faint">
                      Done when:
                    </p>
                    <ul className="list-[circle] pl-5 text-muted marker:text-line-strong">
                      {f.done_when!.map((check) => (
                        <li key={check}>{check}</li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        )),
        sub("features-should", "Soon after launch", should.length, () => (
          <Bullets items={should.map((f) => `${f.name}. ${f.description}`)} />
        )),
        sub("features-could", "Later", could.length, () => (
          <Bullets items={could.map((f) => `${f.name}. ${f.description}`)} />
        )),
        sub("features-pages", "Pages", scope.pages.length, () => (
          <Table
            head={["Page", "Address", "Purpose"]}
            rows={scope.pages.map((p) => [p.name, p.path || "/", p.purpose])}
            mono={1}
          />
        )),
        sub(
          "features-rules",
          "Rules the site follows",
          scope.business_rules?.length,
          () => (
            <ol className="list-decimal space-y-1 pl-5 marker:text-faint">
              {scope.business_rules!.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          ),
        ),
        sub(
          "features-legal",
          "Legal and trust",
          scope.compliance?.length,
          () => (
            <>
              <ul className="list-disc space-y-1.5 pl-5 marker:text-line-strong">
                {scope.compliance!.map((c) => (
                  <li key={c.item}>
                    <strong className="font-semibold">{c.item}.</strong>{" "}
                    <span className="text-muted">{c.why}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-faint">
                Usually required; worth confirming with an expert.
              </p>
            </>
          ),
        ),
        sub(
          "features-behind",
          "Behind the scenes",
          scope.roles.length ||
            scope.entities.length ||
            scope.integrations.length ||
            scope.data_storage?.needs_database != null,
          () => (
            <Facts
              rows={[
                ["Who uses it", scope.roles.map((r) => r.name).join(", ")],
                [
                  "Information kept",
                  scope.entities.map((e) => e.name).join(", "),
                ],
                ["Outside services", scope.integrations.join(", ")],
                [
                  "Database",
                  scope.data_storage?.needs_database == null
                    ? ""
                    : `${scope.data_storage.needs_database ? "Needed" : "Not needed: a simple site is enough"}${
                        scope.data_storage.why
                          ? `. ${scope.data_storage.why}`
                          : ""
                      }`,
                ],
              ]}
            />
          ),
        ),
        sub(
          "features-keys",
          "Keys the website may need",
          scope.keys?.length,
          () => (
            <>
              <ul className="space-y-1.5">
                {scope.keys!.map((k) => (
                  <li key={k.name}>
                    <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[12.5px] font-semibold">
                      {k.name}
                    </code>
                    {k.purpose && (
                      <span className="text-muted"> {k.purpose}</span>
                    )}
                    {!k.required && (
                      <span className="text-faint"> (optional)</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-faint">
                Suggestions only: add the keys you want under Keys & settings in
                the sidebar, with any names you like, never in the chat. Values
                are stored encrypted and Gagesite&apos;s AI never sees them.
              </p>
            </>
          ),
        ),
      ],
    },
    {
      id: "how-it-works",
      title: "How the site works",
      subs: [
        sub(
          "how-permissions",
          "Who can do what",
          scope.permissions?.length && scope.roles.length,
          () => (
            <Table
              head={["Action", ...scope.roles.map((r) => r.name)]}
              rows={scope.permissions!.map((p) => [
                p.action,
                ...scope.roles.map((r) =>
                  p.roles.some((x) => x.toLowerCase() === r.name.toLowerCase())
                    ? "Yes"
                    : "",
                ),
              ])}
              center
            />
          ),
        ),
        ...(scope.flows ?? []).map((flow) =>
          sub(`flow-${flow.id}`, `${flow.name} (${flow.role})`, true, () => (
            <>
              {flow.goal && <p className="text-muted">{flow.goal}</p>}
              <FlowSwimlane flow={flow} />
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-faint hover:text-ink">
                  Step by step
                </summary>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 marker:text-faint">
                  {flow.steps.map((step, i) => (
                    <li key={i}>
                      <strong className="font-semibold">{step.actor}</strong>
                      {step.page && (
                        <span className="text-muted"> on {step.page}</span>
                      )}
                      : {step.action}
                      {step.result && (
                        <span className="text-muted">
                          {" "}
                          <ArrowRight
                            size={12}
                            className="inline align-[-1px] text-faint"
                          />{" "}
                          {step.result}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </details>
              {flow.problems.length > 0 && (
                <>
                  <p className="text-xs font-medium text-faint">
                    If something goes wrong:
                  </p>
                  <ul className="list-disc space-y-1 pl-5 marker:text-line-strong">
                    {flow.problems.map((p) => (
                      <li key={p.when}>
                        <span className="text-muted">{p.when}:</span> {p.then}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )),
        ),
        sub("how-states", "How things change", scope.lifecycles?.length, () => (
          <>
            {scope.lifecycles!.map((cycle) => (
              <div
                key={cycle.thing}
                id={lifecycleAnchor(cycle.thing)}
                className="scroll-mt-6 space-y-2"
              >
                <p>
                  <strong className="font-semibold">{cycle.thing}</strong>
                </p>
                <LifecycleDiagram cycle={cycle} />
                {cycle.changes.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-xs font-medium text-faint hover:text-ink">
                      Every change in words
                    </summary>
                    <ul className="mt-2 list-disc pl-5 marker:text-line-strong">
                      {cycle.changes.map((c, i) => (
                        <li key={i}>
                          {c.from || "start"}{" "}
                          <ArrowRight
                            size={12}
                            className="inline align-[-1px] text-faint"
                          />{" "}
                          {c.to}
                          <span className="text-muted">: {c.trigger}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </>
        )),
        sub(
          "how-messages",
          "Messages the site sends",
          scope.notifications?.length,
          () => (
            <Table
              head={["Message", "To", "When", "How"]}
              rows={scope.notifications!.map((n) => [
                n.name,
                n.to,
                n.when,
                CHANNELS[n.channel] ?? n.channel,
              ])}
            />
          ),
        ),
      ],
    },
    {
      id: "business",
      title: "Business case",
      subs: [
        sub(
          "business-value",
          "Why customers pick you",
          value?.proposition,
          () => <p>{value!.proposition}</p>,
        ),
        sub(
          "business-helps",
          "How the site helps",
          value?.revenue.length || value?.saves.length,
          () => (
            <>
              {value!.revenue.length > 0 && (
                <>
                  <p className="text-xs font-medium text-faint">
                    Brings in money:
                  </p>
                  <Bullets items={value!.revenue} />
                </>
              )}
              {value!.saves.length > 0 && (
                <>
                  <p className="text-xs font-medium text-faint">Saves you:</p>
                  <Bullets items={value!.saves} />
                </>
              )}
            </>
          ),
        ),
        sub(
          "business-worth",
          "Is it worth it?",
          economics?.expected_return || economics?.costs.length,
          () => (
            <>
              {economics!.expected_return && (
                <p>
                  <strong className="font-semibold">Expected:</strong>{" "}
                  {economics!.expected_return}
                </p>
              )}
              {economics!.payback && <p>{economics!.payback}</p>}
              {economics!.costs.length > 0 && (
                <Table
                  head={["Cost", "Amount", "How often"]}
                  rows={economics!.costs.map((c) => [
                    c.item,
                    c.amount,
                    c.period === "once" ? "One time" : `Every ${c.period}`,
                  ])}
                />
              )}
              {economics!.basis && (
                <p className="text-xs text-faint">
                  An estimate based on: {economics!.basis}
                </p>
              )}
            </>
          ),
        ),
        sub(
          "business-discovery",
          "How customers find you",
          brief.discovery?.length,
          () => (
            <Table
              head={["Where", "What to do"]}
              rows={brief.discovery!.map((d) => [d.channel, d.action])}
            />
          ),
        ),
        sub(
          "business-launch",
          "From approval to launch",
          launch?.timeline.length,
          () => (
            <Table
              head={["When", "Step", "Who"]}
              rows={launch!.timeline.map((m) => [m.when, m.step, m.who])}
            />
          ),
        ),
        sub(
          "business-running",
          "Running the site",
          launch?.owner_time.length ||
            running?.monthly_cost ||
            running?.updates.length,
          () => (
            <>
              {running?.monthly_cost && (
                <p>
                  <strong className="font-semibold">Monthly cost:</strong>{" "}
                  {running.monthly_cost}
                </p>
              )}
              {(launch?.owner_time.length ?? 0) > 0 && (
                <Table
                  head={["Your regular task", "Time"]}
                  rows={launch!.owner_time.map((t) => [t.task, t.time])}
                />
              )}
              {(running?.updates.length ?? 0) > 0 && (
                <Bullets items={running!.updates} />
              )}
              {running?.notes && <p className="text-muted">{running.notes}</p>}
            </>
          ),
        ),
        sub(
          "business-competitors",
          "Competitors and sites you like",
          value?.competitors.length,
          () => <Bullets items={value!.competitors} />,
        ),
      ],
    },
    {
      id: "your-information",
      title: "Information from you",
      subs: [
        sub(
          "your-details",
          "Your details",
          true,
          () =>
            editing ? (
              <DetailsBlock details={scope.details!} editing={editing} />
            ) : (
              <DetailsTable details={scope.details!} />
            ),
          editing?.editable && editing.onSave && !editing.open ? (
            <button
              onClick={() => editing.setOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1 text-xs font-semibold transition hover:border-accent hover:text-accent-ink active:scale-[0.98]"
            >
              <PencilSimple size={13} weight="bold" />
              Edit
            </button>
          ) : null,
        ),
        sub("your-decisions", "Open questions", true, () =>
          scope.open_questions.length ? (
            <>
              <ol className="list-decimal space-y-1 pl-5 marker:text-faint">
                {scope.open_questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
              <p className="text-xs text-faint">
                Answer in the chat whenever you like. None of these stop you
                approving the plan.
              </p>
            </>
          ) : (
            <p className="text-muted">Nothing left to decide.</p>
          ),
        ),
        sub(
          "your-send",
          "Content to send",
          scope.content_checklist?.length,
          () => (
            <>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {(["needed", "placeholder", "provided"] as const).map((s) => (
                  <span key={s} className="flex items-center gap-1.5">
                    <span
                      className={`size-1.5 rounded-full ${STATUS[s].dot}`}
                    />
                    <span className="font-medium text-ink">
                      {STATUS[s].label}
                    </span>
                    : {STATUS[s].hint}
                  </span>
                ))}
              </p>
              <ul className="divide-y divide-line border-y border-line">
                {scope
                  .content_checklist!.map((c, index) => ({
                    c,
                    index,
                    state: effectiveStatus(c, scope.details),
                  }))
                  .sort((a, b) => STATUS[a.state].order - STATUS[b.state].order)
                  .map(({ c, index }) => (
                    <ContentRow
                      key={`${c.item}-${index}`}
                      item={c}
                      index={index}
                      details={scope.details}
                      editing={editing}
                    />
                  ))}
              </ul>
            </>
          ),
        ),
        sub(
          "your-assumptions",
          "Choices Gagesite made for you",
          scope.assumptions.length,
          () => (
            <>
              <Bullets items={scope.assumptions} muted />
              <p className="text-xs text-faint">
                Easy to change: just say so in the chat.
              </p>
            </>
          ),
        ),
      ],
    },
  ];

  return sections
    .map((s) => ({ ...s, subs: s.subs.filter((x): x is Sub => x !== null) }))
    .filter((s) => s.subs.length > 0);
}

const CHANNELS: Record<string, string> = {
  email: "Email",
  screen: "On screen",
  sms: "Text message",
  kakao: "KakaoTalk",
};

const STATUS: Record<
  ContentItem["status"],
  { label: string; hint: string; className: string; dot: string; order: number }
> = {
  needed: {
    label: "Needed from you",
    hint: "needed before the site goes live, not to approve the plan",
    className: "font-medium text-ink",
    dot: "bg-faint",
    order: 0,
  },
  placeholder: {
    label: "Sample until you send it",
    hint: "a stand-in is used for now",
    className: "text-accent-ink",
    dot: "bg-accent",
    order: 1,
  },
  provided: {
    label: "Received",
    hint: "done",
    className: "text-emerald-700",
    dot: "bg-emerald-500",
    order: 2,
  },
};

/*
 * Some checklist items are really business details (address, phone, email, footer, web address,
 * hours). Their status comes from section 5.1, so filling the details there ticks them off.
 */
const DETAIL_LINKS: {
  test: RegExp;
  fields: (keyof ScopeDetails)[];
  names: string[];
}[] = [
  { test: /\baddress\b|주소/, fields: ["address"], names: ["address"] },
  { test: /phone|전화/, fields: ["phone"], names: ["phone"] },
  { test: /\bemail\b|이메일/, fields: ["email"], names: ["email"] },
  {
    test: /instagram|social|\blinks?\b|sns/,
    fields: ["links"],
    names: ["links"],
  },
  {
    test: /footer|registration|representative|사업자/,
    fields: ["legal_name", "representative", "registration_number"],
    names: ["business name", "representative", "registration no."],
  },
  {
    test: /\bdomain\b|\bwebsite\b|도메인/,
    fields: ["domain"],
    names: ["web address"],
  },
  {
    test: /opening hours|영업시간/,
    fields: ["hours"],
    names: ["opening hours"],
  },
];

/** The detail fields an item stands for, with the ones still empty. */
function linkedDetails(item: ContentItem, details?: ScopeDetails) {
  // "email address" is the email, "web address" is the domain: not the street address.
  const name = item.item
    .toLowerCase()
    .replace(/e-?mail address/g, "email")
    .replace(/web(site)? address/g, "website");
  const links = DETAIL_LINKS.filter((l) => l.test.test(name));
  const missing = links.flatMap((l) =>
    l.fields.flatMap((field, i) => {
      if (details?.not_needed.includes(field)) return [];
      const value = details?.[field];
      return (Array.isArray(value) ? value.length : value)
        ? []
        : [l.names[i] ?? l.names[0]];
    }),
  );
  return { linked: links.length > 0, missing };
}

/** What really stands: details given in 5.1, uploads and chosen samples beat the plan's own label. */
function effectiveStatus(
  item: ContentItem,
  details?: ScopeDetails,
): ContentItem["status"] {
  const { linked, missing } = linkedDetails(item, details);
  if (linked)
    return missing.length === 0
      ? "provided"
      : item.status === "placeholder"
        ? "placeholder"
        : "needed";
  if (item.kind === "image") {
    if (item.files.length) return "provided";
    const isLogo = /logo|로고/i.test(item.item);
    // A photo item only counts as "sample" once sample photos have actually been picked.
    if (item.status === "placeholder" && !isLogo && !item.samples.length)
      return "needed";
  }
  return item.status;
}

/** The real details that go on the website. Claude fills them from the chat; the owner can also type them in. */
function DetailsBlock({
  details,
  editing,
}: {
  details: ScopeDetails;
  editing: DetailsEditing;
}) {
  if (editing.open && editing.onSave) {
    const save = editing.onSave;
    return (
      <DetailsForm
        initial={details}
        onCancel={() => editing.setOpen(false)}
        onSave={async (next) => {
          await save(next);
          editing.setOpen(false);
        }}
      />
    );
  }
  return (
    <>
      <DetailsTable details={details} />
      <p className="text-xs text-faint">
        {editing.lockedNote ||
          "These appear on your website. Use Edit to type them in, or give them to Gagesite in the chat."}
      </p>
    </>
  );
}

/** Standard business details, in display order; `key` matches ScopeDetails and `not_needed`. */
const DETAIL_FIELDS: { key: keyof ScopeDetails; label: string }[] = [
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "address", label: "Address" },
  { key: "hours", label: "Opening hours" },
  { key: "links", label: "Links" },
  { key: "legal_name", label: "Business name" },
  { key: "representative", label: "Representative" },
  { key: "registration_number", label: "Registration no." },
  { key: "domain", label: "Web address" },
];

function detailText(details: ScopeDetails, key: keyof ScopeDetails): string {
  if (key === "hours")
    return details.hours.map((h) => `${h.days} ${h.time}`.trim()).join("; ");
  if (key === "links")
    return details.links.map((l) => `${l.name}: ${l.url}`).join("; ");
  const value = details[key];
  return typeof value === "string" ? value : "";
}

function DetailsTable({ details }: { details: ScopeDetails }) {
  const skipped = DETAIL_FIELDS.filter((f) =>
    details.not_needed.includes(f.key),
  );
  const rows: [string, React.ReactNode][] = [
    ...DETAIL_FIELDS.filter((f) => !details.not_needed.includes(f.key)).map(
      (f): [string, React.ReactNode] => [f.label, detailText(details, f.key)],
    ),
    // Business-specific details (shipping fee, stylists...), with what exactly is needed.
    ...details.other
      .filter((o) => o.label)
      .map((o): [string, React.ReactNode] => [
        o.label,
        o.value ? (
          o.value
        ) : (
          <span>
            <span className="text-faint">Add later</span>
            {o.hint && (
              <span className="block text-xs leading-5 text-faint">
                {o.hint}
              </span>
            )}
          </span>
        ),
      ]),
  ];
  return (
    <>
      <Facts rows={rows} showEmpty />
      {skipped.length > 0 && (
        <p className="text-xs text-faint">
          Not needed for this site:{" "}
          {skipped.map((f) => f.label.toLowerCase()).join(", ")}. Need one after
          all? Say so in the chat.
        </p>
      )}
    </>
  );
}

const INPUT =
  "w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm leading-6 outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft";

function DetailsForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ScopeDetails;
  onSave: (details: ScopeDetails) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState<ScopeDetails>(() => structuredClone(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ScopeDetails>(key: K, value: ScopeDetails[K]) =>
    setD((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    setSaving(true);
    setError(null);
    const t = (v: string) => v.trim();
    try {
      await onSave({
        phone: t(d.phone),
        email: t(d.email),
        address: t(d.address),
        hours: d.hours
          .map((h) => ({ days: t(h.days), time: t(h.time) }))
          .filter((h) => h.days || h.time),
        links: d.links
          .map((l) => ({ name: t(l.name), url: t(l.url) }))
          .filter((l) => l.name || l.url),
        legal_name: t(d.legal_name),
        representative: t(d.representative),
        registration_number: t(d.registration_number),
        domain: t(d.domain),
        other: d.other
          .map((o) => ({ label: t(o.label), value: t(o.value), hint: o.hint }))
          .filter((o) => o.label || o.value),
        not_needed: d.not_needed,
      });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  // Fields that don't apply to this business are left out of the form.
  const shown = (key: keyof ScopeDetails) => !d.not_needed.includes(key);
  const text = (
    key:
      | "phone"
      | "email"
      | "legal_name"
      | "representative"
      | "registration_number"
      | "domain",
    label: string,
    placeholder: string,
    type = "text",
  ) =>
    shown(key) && (
      <Field label={label} htmlFor={`detail-${key}`}>
        <input
          id={`detail-${key}`}
          type={type}
          value={d[key]}
          onChange={(e) => set(key, e.target.value)}
          placeholder={placeholder}
          className={INPUT}
        />
      </Field>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-xl bg-surface-2/60 p-4 ring-1 ring-line"
    >
      <div className="divide-y divide-line">
        {text("phone", "Phone", "043-123-4567", "tel")}
        {text("email", "Email", "hello@beanthere.kr", "email")}
        {shown("address") && (
          <Field label="Address" htmlFor="detail-address">
            <textarea
              id="detail-address"
              rows={2}
              value={d.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Street address, city"
              className={`${INPUT} resize-none`}
            />
          </Field>
        )}
        {shown("hours") && (
          <Field label="Opening hours">
            <Rows
              items={d.hours}
              onChange={(hours) => set("hours", hours)}
              blank={{ days: "", time: "" }}
              addLabel="Add hours"
              render={(h, update) => (
                <>
                  <input
                    aria-label="Days"
                    value={h.days}
                    onChange={(e) => update({ ...h, days: e.target.value })}
                    placeholder="Mon-Fri"
                    className={INPUT}
                  />
                  <input
                    aria-label="Hours"
                    value={h.time}
                    onChange={(e) => update({ ...h, time: e.target.value })}
                    placeholder="10:00-22:00 or Closed"
                    className={INPUT}
                  />
                </>
              )}
            />
          </Field>
        )}
        {shown("links") && (
          <Field label="Links">
            <Rows
              items={d.links}
              onChange={(links) => set("links", links)}
              blank={{ name: "", url: "" }}
              addLabel="Add link"
              render={(l, update) => (
                <>
                  <input
                    aria-label="Link name"
                    value={l.name}
                    onChange={(e) => update({ ...l, name: e.target.value })}
                    placeholder="Instagram"
                    className={INPUT}
                  />
                  <input
                    aria-label="Link address"
                    value={l.url}
                    onChange={(e) => update({ ...l, url: e.target.value })}
                    placeholder="https://instagram.com/..."
                    className={INPUT}
                  />
                </>
              )}
            />
          </Field>
        )}
        {text("legal_name", "Business name", "Registered business name")}
        {text(
          "representative",
          "Representative",
          "Name of the owner or representative",
        )}
        {text("registration_number", "Registration no.", "123-45-67890")}
        {text("domain", "Web address", "beanthere.kr")}
        {d.other.map((o, i) =>
          o.hint ? (
            <Field key={i} label={o.label} htmlFor={`detail-other-${i}`}>
              <input
                id={`detail-other-${i}`}
                value={o.value}
                onChange={(e) =>
                  set(
                    "other",
                    d.other.map((x, j) =>
                      j === i ? { ...x, value: e.target.value } : x,
                    ),
                  )
                }
                placeholder={o.hint}
                className={INPUT}
              />
            </Field>
          ) : null,
        )}
        <Field label="Other">
          <Rows
            items={d.other.filter((o) => !o.hint)}
            onChange={(mine) =>
              set("other", [...d.other.filter((o) => o.hint), ...mine])
            }
            blank={{ label: "", value: "", hint: "" }}
            addLabel="Add another detail"
            render={(o, update) => (
              <>
                <input
                  aria-label="Detail name"
                  value={o.label}
                  onChange={(e) => update({ ...o, label: e.target.value })}
                  placeholder="e.g. Parking"
                  className={INPUT}
                />
                <input
                  aria-label="Detail value"
                  value={o.value}
                  onChange={(e) => update({ ...o, value: e.target.value })}
                  placeholder="e.g. 2 spaces behind the café"
                  className={INPUT}
                />
              </>
            )}
          />
        </Field>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          Cancel
        </button>
        <button
          disabled={saving}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:bg-line-strong"
        >
          {saving ? "Saving..." : "Save details"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-x-4 gap-y-1.5 py-2.5 @md:grid-cols-[8.5rem_minmax(0,1fr)]">
      <label htmlFor={htmlFor} className="pt-1.5 text-sm text-muted">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A small editable list of two-field rows (hours, links...), with add and remove. */
function Rows<T>({
  items,
  onChange,
  blank,
  addLabel,
  render,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  blank: T;
  addLabel: string;
  render: (item: T, update: (next: T) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] items-center gap-2"
        >
          {render(item, (next) =>
            onChange(items.map((x, j) => (j === i ? next : x))),
          )}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label="Remove"
            className="grid size-8 place-items-center rounded-lg text-faint transition hover:bg-danger-soft hover:text-danger"
          >
            <Minus size={14} weight="bold" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, blank])}
        className="inline-flex items-center gap-1 rounded-md px-1 py-1 text-xs font-semibold text-accent-ink hover:underline"
      >
        <Plus size={12} weight="bold" />
        {addLabel}
      </button>
    </div>
  );
}

/**
 * One thing the site needs from the owner. Image items (logo, photos) can be uploaded right here,
 * or switched to sample photos for now so the design is not full of grey boxes.
 */
function ContentRow({
  item,
  index,
  details,
  editing,
}: {
  item: ContentItem;
  index: number;
  details?: ScopeDetails;
  editing?: DetailsEditing;
}) {
  const [busy, setBusy] = useState<"upload" | "sample" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const state = effectiveStatus(item, details);
  const status = STATUS[state];
  const { linked, missing } = linkedDetails(item, details);
  const isImage = item.kind === "image" && !linked;
  const isLogo = /logo|로고/i.test(item.item);
  const canFillIn =
    linked && state !== "provided" && !!editing?.editable && !!editing.onSave;
  const canEdit =
    !!editing?.editable &&
    !!editing.onUploadContent &&
    !!editing.onChooseContent;

  async function run(kind: "upload" | "sample", action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const uploads = item.files.map((file) => ({
    key: file,
    src: editing?.projectId
      ? api.previewUrl(editing.projectId, `brand/${file}`)
      : "",
    credit: "",
  }));
  const usingSamples = isImage && !isLogo && state === "placeholder";
  const samples = usingSamples
    ? item.samples.map((s) => ({
        key: s.url,
        src: s.thumb || s.url,
        credit: s.credit,
      }))
    : [];
  const thumbs = uploads.length ? uploads : samples;

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold leading-6">{item.item}</p>
          {item.detail && (
            <p className="text-[13px] leading-6 text-muted">{item.detail}</p>
          )}
          {linked && state !== "provided" && missing.length > 0 && (
            <p className="text-xs leading-6 text-faint">
              Still missing in 5.1: {missing.join(", ")}
            </p>
          )}
        </div>
        <span
          className={`flex shrink-0 items-center gap-1.5 pt-1 text-xs ${status.className}`}
        >
          <span className={`size-1.5 rounded-full ${status.dot}`} />
          {isImage && state === "placeholder"
            ? isLogo
              ? "Business name for now"
              : "Sample photos for now"
            : status.label}
        </span>
      </div>

      {canFillIn && (
        <button
          type="button"
          onClick={() => {
            editing!.setOpen(true);
            // Scroll once the form has opened (it changes the page height under the scroll).
            setTimeout(
              () =>
                document
                  .getElementById("your-details")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }),
              80,
            );
          }}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1 text-xs font-semibold transition hover:border-accent hover:text-accent-ink active:scale-[0.98]"
        >
          <PencilSimple size={13} weight="bold" />
          Fill in
        </button>
      )}

      {isImage && (
        <div className="mt-2.5 space-y-2.5">
          {thumbs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {thumbs.map((t) => (
                <span
                  key={t.key}
                  title={t.credit || undefined}
                  className="relative block h-16 w-24 overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line"
                >
                  {t.src && (
                    // eslint-disable-next-line @next/next/no-img-element -- previews from the backend or a sample service
                    <img
                      src={t.src}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  )}
                  {!uploads.length && (
                    <span className="absolute inset-x-0 bottom-0 bg-ink/60 px-1 py-px text-center text-[9px] font-medium text-white">
                      Sample
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                multiple={!isLogo}
                className="hidden"
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  e.target.value = "";
                  if (files.length)
                    run("upload", () =>
                      editing!.onUploadContent!(index, item.item, files),
                    );
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1 text-xs font-semibold transition hover:border-accent hover:text-accent-ink active:scale-[0.98] disabled:opacity-50"
              >
                <UploadSimple size={13} weight="bold" />
                {busy === "upload"
                  ? "Uploading..."
                  : item.files.length
                    ? isLogo
                      ? "Replace"
                      : "Add more"
                    : isLogo
                      ? "Upload logo"
                      : "Upload photos"}
              </button>
              {!item.files.length &&
                (item.status === "placeholder" && (isLogo || usingSamples) ? (
                  <button
                    type="button"
                    onClick={() =>
                      run("sample", () =>
                        editing!.onChooseContent!(index, item.item, "needed"),
                      )
                    }
                    disabled={busy !== null}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                  >
                    {isLogo ? "Don't use the name" : "Don't use samples"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      run("sample", () =>
                        editing!.onChooseContent!(
                          index,
                          item.item,
                          "placeholder",
                        ),
                      )
                    }
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-accent-ink transition hover:bg-accent-soft disabled:opacity-50"
                  >
                    <ImageSquare size={13} weight="bold" />
                    {busy === "sample"
                      ? "Saving..."
                      : isLogo
                        ? "Use the business name for now"
                        : "Use sample photos for now"}
                  </button>
                ))}
            </div>
          )}
          {usingSamples && (
            <p className="text-xs text-faint">
              Free sample photos stand in for yours in the design, marked
              “Sample”. Upload your own any time.
              {item.samples[0]?.credit &&
                ` Photos: ${[...new Set(item.samples.map((s) => s.credit))].join("; ")}.`}
            </p>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </li>
  );
}

/* ---------- document building blocks ---------- */

function Bullets({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <ul
      className={`list-disc space-y-1 pl-5 marker:text-line-strong ${muted ? "text-muted" : ""}`}
    >
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** Label and value rows. Empty values are skipped, or flagged when `showEmpty` is set. */
function Facts({
  rows,
  showEmpty,
}: {
  rows: [string, React.ReactNode][];
  showEmpty?: boolean;
}) {
  const shown = rows.filter(([, v]) => v || showEmpty);
  return (
    <dl className="divide-y divide-line border-y border-line">
      {shown.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-4 py-2"
        >
          <dt className="text-muted">{label}</dt>
          <dd className="min-w-0 break-words">
            {value || <span className="text-faint">Add later</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Table({
  head,
  rows,
  mono,
  center,
}: {
  head: string[];
  rows: React.ReactNode[][];
  /** Column index to show in monospace (e.g. web addresses). */
  mono?: number;
  /** Centre every column after the first (e.g. a yes/no grid). */
  center?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-line">
      <table className="w-full border-collapse text-[13px] leading-6">
        <thead className="bg-surface-2">
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                className={`px-3 py-2 font-medium text-muted ${center && i > 0 ? "text-center" : "text-left"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-line align-top">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={`px-3 py-2 ${i === 0 ? "font-medium" : ""} ${mono === i ? "font-mono text-xs text-muted" : ""} ${
                    center && i > 0 ? "text-center" : ""
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The overview part of the plan on its own (the home page shows it as an example). */
export function Overview({ scope }: { scope: Scope }) {
  const overview = buildDocument(scope).find((s) => s.id === "overview");
  return (
    <article className="text-sm">
      <h3 className="font-display text-[1.6rem] font-bold leading-tight tracking-tight">
        {scope.business.name}
      </h3>
      {scope.business.description && (
        <p className="mt-1.5 leading-7 text-muted">
          {scope.business.description}
        </p>
      )}
      {overview?.subs.map((sub, j) => (
        <div key={sub.id} className="pt-5">
          <h4 className="text-[15px] font-semibold">
            <span className="mr-2 tabular-nums text-faint">1.{j + 1}</span>
            {sub.title}
          </h4>
          <div className="mt-2 space-y-3 leading-7">{sub.body}</div>
        </div>
      ))}
    </article>
  );
}
