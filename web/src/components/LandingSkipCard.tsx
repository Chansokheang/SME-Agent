"use client";

import { ArrowRight, CircleNotch, Rocket } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

const ACTION =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink transition duration-200 hover:border-accent hover:text-accent-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

/**
 * "Only need a landing page?": the same card, in the same place (the bottom of the stage's
 * panel), in Plan, Database and UI Design. In Plan and Database it turns the project into a
 * landing page, whose short brief replaces the remaining steps; UI Design passes `onSkip` to skip
 * just the design and go to Implementation.
 */
export default function LandingSkipCard({
  projectId,
  onSkip,
  disabled,
  className = "",
}: {
  projectId: string;
  /** UI Design's own skip. Without it, the project switches to a landing page and opens its brief. */
  onSkip?: () => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      if (onSkip) {
        await onSkip();
      } else {
        await api.switchToLanding(projectId);
        // The stage page reloads the project (it may already be on 01-scope), then shows the brief.
        window.dispatchEvent(new Event("gagesite:project-changed"));
        router.push(`/projects/${projectId}/01-scope`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`flex items-start gap-4 rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-4 ${className}`}
    >
      <Rocket size={22} weight="duotone" className="mt-0.5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold leading-6">Only need a landing page?</h3>
        <p className="text-[13px] leading-relaxed text-muted">
          {onSkip
            ? "Skip this step. Implementation builds one modern landing page and designs it there, using anything you added above. You can come back and design a full website later."
            : "Skip the remaining steps. A two-minute brief replaces them (anything already in your plan fills it in), then Implementation builds one modern landing page."}
        </p>
        <button type="button" onClick={go} disabled={busy || disabled} className={`${ACTION} mt-3`}>
          {busy ? <CircleNotch size={14} className="animate-spin" /> : null}
          {onSkip ? "Skip to Implementation" : "Make it a landing page"}
          <ArrowRight size={14} weight="bold" />
        </button>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    </section>
  );
}
