"use client";

import { ArrowRight, ArrowsClockwise, Browser, Star, UsersThree } from "@phosphor-icons/react";
import WorkflowFlowchart from "@/components/scope/WorkflowFlowchart";
import type { Scope, ScopeFlow } from "@/lib/api";

/*
 * The whole website on one screen. On top, the workflow flowchart Gagesite generates on request once
 * the requirements are gathered. Below, from the plan itself: who does what, which pages each task
 * touches, and which things change status. Every box jumps to its details in the Plan view.
 */

const key = (s: string) => s.trim().toLowerCase();

/** Id of a lifecycle's block in the Plan view (also set there). */
export const lifecycleAnchor = (thing: string) => `state-${key(thing).replace(/[^a-z0-9]+/g, "-")}`;

export default function SiteMap({
  scope,
  projectId,
  onOpen,
}: {
  scope: Scope;
  projectId?: string;
  onOpen: (anchor: string) => void;
}) {
  const flows = (scope.flows ?? []).filter((f) => f.name && f.steps.length);
  const lifecycles = (scope.lifecycles ?? []).filter((l) => l.thing);
  const pages = scope.pages.filter((p) => p.name);

  // One row per role, in the plan's order, plus anyone who starts a task without being listed.
  const rows: string[] = [];
  for (const name of [...scope.roles.map((r) => r.name), ...flows.map((f) => f.role)]) {
    if (name && !rows.some((r) => key(r) === key(name))) rows.push(name.trim());
  }
  const pageKey = (name: string) => {
    const k = key(name);
    return pages.find((p) => key(p.name) === k || key(p.path) === k)?.name;
  };
  const usedPages = new Set(flows.flatMap((f) => f.steps.map((s) => s.page && pageKey(s.page)).filter(Boolean)));
  const unused = pages.filter((p) => !usedPages.has(p.name));
  const pagesFor = (role: string) => pages.filter((p) => p.roles.some((r) => key(r) === key(role)));
  const main = scope.brief?.main_action?.label;

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold tracking-tight">How the whole site works</h3>
          <p className="mt-0.5 text-sm text-muted">
            From opening the website to leaving it, once your requirements are gathered.
          </p>
        </div>
        {main && (
          <p className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-xs text-accent-ink">
            <Star size={13} weight="fill" />
            The one main thing: <span className="font-semibold">{main}</span>
          </p>
        )}
      </div>

      {/* Who does what, statuses and unused pages come with the flowchart: shown only once it is generated. */}
      {projectId && (
        <WorkflowFlowchart
          projectId={projectId}
          details={
            flows.length < 2 ? null : (
              <>
                <h4 className="flex items-center gap-1.5 pt-2 text-sm font-semibold">
                  <UsersThree size={16} className="text-faint" />
                  Who does what
                </h4>
                <div className="overflow-hidden rounded-xl border border-line">
                  {rows.map((role, i) => {
                    const own = flows.filter((f) => key(f.role) === key(role));
                    const joins = flows.filter(
                      (f) => key(f.role) !== key(role) && f.steps.some((s) => key(s.actor) === key(role)),
                    );
                    const reach = pagesFor(role);
                    const description = scope.roles.find((r) => key(r.name) === key(role))?.description;
                    return (
                      <div
                        key={role}
                        className={`grid gap-3 px-4 py-4 sm:grid-cols-[148px_minmax(0,1fr)] ${i % 2 ? "bg-surface" : "bg-surface-2"} ${i ? "border-t border-line" : ""}`}
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{role}</p>
                          {description && <p className="mt-1 text-xs leading-snug text-faint">{description}</p>}
                          {reach.length > 0 && (
                            <p className="mt-1.5 text-xs text-faint" title={reach.map((p) => p.name).join(", ")}>
                              Can open {reach.length} {reach.length === 1 ? "page" : "pages"}
                            </p>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-wrap gap-3">
                          {own.map((flow) => (
                            <FlowCard key={flow.id} flow={flow} role={role} pageKey={pageKey} onOpen={onOpen} />
                          ))}
                          {joins.map((flow) => (
                            <button
                              key={flow.id}
                              onClick={() => onOpen(`flow-${flow.id}`)}
                              className="flex w-full max-w-[15rem] items-center gap-2 self-start rounded-lg border border-dashed border-line-strong px-3 py-2 text-left text-xs text-muted transition hover:border-accent hover:text-accent-ink"
                            >
                              <ArrowRight size={13} className="shrink-0" />
                              <span className="min-w-0">
                                Joins <span className="font-medium text-ink">{flow.name}</span>
                                <span className="text-faint"> (started by {flow.role})</span>
                              </span>
                            </button>
                          ))}
                          {own.length === 0 && joins.length === 0 && (
                            <p className="self-center text-xs text-faint">
                              {reach.length
                                ? "Browses the pages; no task of their own yet."
                                : "No task of their own yet."}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {lifecycles.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-faint">
                      <ArrowsClockwise size={13} />
                      Things that change status as people use the site
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {lifecycles.map((cycle) => (
                        <button
                          key={cycle.thing}
                          onClick={() => onOpen(lifecycleAnchor(cycle.thing))}
                          className="rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs transition hover:border-accent"
                          title={cycle.states.map((s) => s.name).join(" → ")}
                        >
                          <span className="font-semibold text-ink">{cycle.thing}</span>
                          <span className="block text-faint">
                            {cycle.states
                              .map((s) => s.name)
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {unused.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-faint">
                      <Browser size={13} />
                      Pages no task above uses yet
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {unused.map((p) => (
                        <span
                          key={p.name}
                          title={p.purpose || p.path}
                          className="rounded-md border border-line px-2 py-1 text-xs text-muted"
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-faint">
                      Fine for pages people just read (About, Privacy). If one should be part of a task, tell Gagesite.
                    </p>
                  </div>
                )}
              </>
            )
          }
        />
      )}
    </div>
  );
}

function FlowCard({
  flow,
  role,
  pageKey,
  onOpen,
}: {
  flow: ScopeFlow;
  role: string;
  pageKey: (name: string) => string | undefined;
  onOpen: (anchor: string) => void;
}) {
  const steps = flow.steps;
  const pageNames = [...new Set(steps.map((s) => (s.page ? (pageKey(s.page) ?? s.page) : "")).filter(Boolean))];
  const others = [...new Set(steps.map((s) => s.actor.trim()).filter((a) => a && key(a) !== key(role)))].map((a) =>
    key(a) === "system" ? "the site" : a,
  );
  return (
    <button
      onClick={() => onOpen(`flow-${flow.id}`)}
      className="group flex w-full max-w-[15rem] flex-col gap-2 rounded-lg border border-line-strong bg-surface p-3 text-left transition hover:border-accent"
    >
      <span className="text-[13px] font-semibold leading-snug text-ink group-hover:text-accent-ink">{flow.name}</span>
      {flow.goal && <span className="line-clamp-2 text-xs leading-snug text-muted">{flow.goal}</span>}
      {pageNames.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {pageNames.slice(0, 4).map((p) => (
            <span key={p} className="rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-muted">
              {p}
            </span>
          ))}
          {pageNames.length > 4 && <span className="px-1 text-[10.5px] text-faint">+{pageNames.length - 4}</span>}
        </span>
      )}
      <span className="text-[11px] text-faint">
        {steps.length} {steps.length === 1 ? "step" : "steps"}
        {others.length > 0 && <> · with {others.join(", ")}</>}
      </span>
    </button>
  );
}
