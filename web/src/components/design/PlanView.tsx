"use client";

import { ArrowSquareOut, CaretDown, CircleNotch, Compass } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { api, type DesignPlanInfo } from "@/lib/api";

/**
 * The design plan: which real products the website follows, its main screen, navigation, each
 * page's layout and how the parts join. Written just before the styles and shown beside them:
 * nothing to approve, changes are asked for in the chat.
 */
export default function PlanView({
  projectId,
  running,
  approved,
  refreshKey,
}: {
  projectId: string;
  running: boolean;
  /** The whole design stage is approved: read only. */
  approved: boolean;
  refreshKey: number;
}) {
  const [info, setInfo] = useState<DesignPlanInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.getDesignPlan(projectId).then(setInfo).catch((e: Error) => setError(e.message));
  }, [projectId]);
  useEffect(load, [load, refreshKey, running]);

  if (!info) {
    return error ? (
      <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
    ) : (
      <div className="h-64 animate-pulse rounded-3xl bg-surface-2" aria-label="Loading the design plan" />
    );
  }

  const plan = info.plan;
  if (!plan) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-line px-6 text-center">
        {running ? (
          <CircleNotch size={28} className="animate-spin text-accent" />
        ) : (
          <Compass size={28} className="text-faint" />
        )}
        <p className="font-semibold">{running ? "Researching and planning your design..." : "No design plan yet"}</p>
        <p className="max-w-md text-sm text-muted">
          {running
            ? "Gagesite is studying the leading products like your website, then plans which ones it follows and how they fit together. This takes a few minutes."
            : "Send a message in the chat (for example \"Let's start the design\") and Gagesite researches products like your website and plans the design."}
        </p>
      </div>
    );
  }

  const isApproved = plan.status === "approved";
  const products = [...new Set(plan.candidates.flatMap((c) => c.products))];
  const mainPage = plan.pages.find((p) => p.path === plan.main_screen.path);

  return (
    <div className="@container mx-auto w-full max-w-3xl space-y-8 pb-6">
      {/* What the plan is, in one paragraph, and the one decision the owner makes here. */}
      <header className="space-y-3">
        <p className="text-xs font-medium text-muted">
          {running && !isApproved ? "Gagesite is drawing the styles on this plan..." : "What every style follows"}
        </p>
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Layout plan</h2>
        <p className="text-[15px] leading-relaxed text-ink">{plan.summary}</p>
        {products.length > 0 && (
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">Based on </span>
            {products.join(", ")}
          </p>
        )}
        {!approved && (
          <p className="text-sm text-muted">
            Want it to work differently, e.g. &quot;notes should open full screen&quot;? Ask in the chat and the styles follow.
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </header>

      {/* The shape of the website: where you land, and how you get around. */}
      <Section title="How it's laid out">
        <div className="grid gap-3 @2xl:grid-cols-[minmax(0,1fr)_220px]">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-medium text-muted">You land on</p>
            <p className="mt-0.5 font-semibold">{mainPage?.name ?? "The first page"}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{plan.main_screen.description}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-medium capitalize text-muted">{plan.navigation.type || "Menu"}</p>
            <ul className="mt-1.5 space-y-0.5 text-sm">
              {plan.navigation.items.map((item) => (
                <li key={item} className="truncate rounded-md px-2 py-1 even:bg-transparent odd:bg-surface-2/60" title={item}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">On a phone: </span>
          {plan.navigation.mobile}
        </p>
      </Section>

      {/* Which product each part follows: one line per part. */}
      <Section title="Inspired by">
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {plan.candidates.map((c) => (
            <li key={c.part} className="grid gap-x-4 gap-y-0.5 px-4 py-3 @2xl:grid-cols-[180px_minmax(0,1fr)]">
              <p className="text-sm font-medium">{c.part}</p>
              <div className="min-w-0">
                <p className="text-sm">{c.products.join(", ")}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{c.why}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Each page, folded: its name and what it follows; open it for the layout. */}
      <Section title={`Pages (${plan.pages.length})`}>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {plan.pages.map((p) => (
            <li key={p.path}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted">Like {p.follows}</span>
                  </span>
                  <CaretDown size={14} className="shrink-0 text-faint transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-1.5 px-4 pb-4 text-sm leading-relaxed">
                  <p>{p.layout}</p>
                  {p.changes && (
                    <p className="text-muted">
                      <span className="font-medium text-ink">Made for you: </span>
                      {p.changes}
                    </p>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Section>

      {/* The rest is for those who want the detail: folded by default. */}
      <div className="space-y-2">
        <More title="How the parts connect" count={plan.joins.length}>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            {plan.joins.map((j) => (
              <li key={j}>{j}</li>
            ))}
          </ul>
        </More>
        <More title="Choices made, and why" count={plan.decisions.length}>
          <ul className="space-y-3">
            {plan.decisions.map((d) => (
              <li key={d.topic} className="text-sm leading-relaxed">
                <p>
                  <span className="font-medium">{d.topic}: </span>
                  {d.chosen}
                </p>
                <p className="text-muted">{d.why}</p>
              </li>
            ))}
          </ul>
        </More>
        {!!plan.not_taken?.length && (
          <More title="Left out on purpose" count={plan.not_taken.length}>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
              {plan.not_taken.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </More>
        )}
        {info.candidates.length > 0 && (
          <More title="Research: products studied" count={info.candidates.length}>
            <ul className="space-y-2.5">
              {info.candidates.map((c) => (
                <li key={`${c.product}-${c.for}`} className="text-sm leading-relaxed">
                  <p>
                    <span className="font-medium">{c.product}</span>
                    <span className="text-muted"> for {c.for}</span>
                    {c.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${c.product}`}
                        className="ml-1 inline-flex align-middle text-faint hover:text-accent"
                      >
                        <ArrowSquareOut size={12} />
                      </a>
                    )}
                  </p>
                  <p className="text-[13px] text-muted">{c.note}</p>
                </li>
              ))}
            </ul>
          </More>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function More({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="flex-1 font-medium">{title}</span>
        <span className="text-xs text-faint">{count}</span>
        <CaretDown size={14} className="text-faint transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line px-4 py-3">{children}</div>
    </details>
  );
}
