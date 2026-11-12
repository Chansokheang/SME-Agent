"use client";

import { ChatsCircle, Key, SealCheck } from "@phosphor-icons/react";
import { Overview } from "@/components/ScopePanel";
import { SAMPLE_SCOPE } from "@/lib/sample-scope";

/*
 * 4-column grid, grid-flow-dense, 2 rows:
 *   A (2x2) = 4 cells, B (2x1) = 2, C (1x1) = 1, D (1x1) = 1  -> 8 cells = 4 x 2, no gaps.
 */
export default function FeatureBento() {
  return (
    <section id="how" className="mx-auto max-w-[1400px] scroll-mt-24 px-4 py-32 md:px-6 md:py-48">
      <h2 className="max-w-4xl font-display text-[clamp(2.25rem,4vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight">
        A real plan before a single page is built
      </h2>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
        The first conversation produces a scope you can read, change and approve. Every later step builds on it.
      </p>

      <div className="mt-16 grid grid-flow-dense grid-cols-1 gap-4 md:auto-rows-[280px] md:grid-cols-4">
        {/* A: the real Stage 1 scope view with example data */}
        <article className="group relative overflow-hidden rounded-3xl border border-line bg-surface md:col-span-2 md:row-span-2">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <span className="font-display text-lg font-bold">Project scope</span>
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-ink">
              Ready for review
            </span>
          </div>
          <div className="h-[420px] overflow-hidden p-6 md:h-[calc(100%-61px)]">
            <div className="origin-top transition-transform duration-700 ease-out group-hover:scale-[1.02]">
              <Overview scope={SAMPLE_SCOPE} />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-surface to-transparent" />
        </article>

        {/* B: approval, with photo */}
        <article className="group relative min-h-[280px] overflow-hidden rounded-3xl md:col-span-2">
          <div
            className="absolute inset-0 bg-cover bg-center grayscale contrast-125 transition-transform duration-700 ease-out group-hover:scale-105"
            style={{ backgroundImage: "url(https://picsum.photos/id/4/1200/700)" }}
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#0e2a57]/90 via-[#1a4f9e]/60 to-accent/20" />
          <div className="relative flex h-full flex-col justify-end p-7 text-white">
            <SealCheck size={30} weight="duotone" />
            <h3 className="mt-3 font-display text-2xl font-bold">You approve every step</h3>
            <p className="mt-1.5 max-w-md text-white/85">
              Nothing moves forward until you say so. Change your mind later and only the affected steps are redone.
            </p>
          </div>
        </article>

        {/* C: plain language and the owner's own material */}
        <article className="group flex flex-col justify-between rounded-3xl bg-accent-soft p-7 transition-transform duration-700 ease-out hover:-translate-y-1">
          <ChatsCircle size={34} weight="duotone" className="text-accent" />
          <div>
            <h3 className="font-display text-xl font-bold text-accent-ink">No jargon</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-accent-ink/80">
              Answer in plain Korean or English, and share a menu, a spreadsheet or a link instead of typing.
            </p>
          </div>
        </article>

        {/* D: ownership */}
        <article className="group flex flex-col justify-between rounded-3xl bg-ink p-7 text-white transition-transform duration-700 ease-out hover:-translate-y-1">
          <Key size={34} weight="duotone" className="text-sky-300" />
          <div>
            <h3 className="font-display text-xl font-bold">Online in your accounts</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/75">
              Your GitHub, your database, your Vercel or your own server. You keep the code, the data and the keys.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
