"use client";

import { ArrowDown, ArrowRight } from "@phosphor-icons/react";
import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";

export default function Hero() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap
          .timeline({ defaults: { ease: "expo.out", duration: 1.4 } })
          .from(".hero-bg", { scale: 1.12, opacity: 0, duration: 2.2 })
          .from(".hero-line", { yPercent: 110, stagger: 0.12 }, 0.2)
          .from(".hero-fade", { y: 24, opacity: 0, stagger: 0.1 }, 0.6);
      });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative isolate flex min-h-[100dvh] items-center overflow-hidden pt-28">
      {/* Full-bleed photo, desaturated and washed toward white + light blue so dark text stays legible. */}
      <div
        className="hero-bg absolute inset-0 -z-20 bg-cover bg-center opacity-60 contrast-125 grayscale"
        style={{ backgroundImage: "url(https://picsum.photos/id/42/1920/1080)" }}
      />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(253,254,255,0.97)_0%,rgba(245,249,254,0.9)_45%,rgba(214,232,252,0.75)_100%)]" />
      <div className="absolute -left-40 top-1/3 -z-10 size-[520px] rounded-full bg-accent/15 blur-[120px]" />
      <div className="absolute -right-32 bottom-0 -z-10 size-[460px] rounded-full bg-sky-300/25 blur-[120px]" />

      <div className="mx-auto w-full max-w-6xl px-4 text-center md:px-6">
        <h1 className="font-display text-[clamp(3rem,5vw,5.5rem)] font-extrabold leading-[1.02] tracking-tight text-ink">
          <span className="block overflow-hidden pb-1">
            <span className="hero-line block">From one conversation</span>
          </span>
          <span className="block overflow-hidden pb-1">
            <span className="hero-line block">
              to a website <span className="text-accent">you own</span>
            </span>
          </span>
        </h1>
        <p className="hero-fade mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">
          Describe your business in plain words. Gagesite plans, designs, builds and puts the site online in
          your own accounts, while you approve every step.
        </p>
        <div className="hero-fade mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#start"
            className="group inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 font-medium text-white shadow-[0_12px_32px_-12px_rgba(34,102,212,0.7)] transition hover:bg-accent-hover active:scale-[0.98]"
          >
            Start a project
            <ArrowRight size={18} weight="bold" className="transition group-hover:translate-x-0.5" />
          </a>
          <a
            href="#how"
            className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-white px-7 py-3.5 font-medium text-ink transition hover:border-accent hover:text-accent-ink active:scale-[0.98]"
          >
            See how it works
            <ArrowDown size={18} weight="bold" />
          </a>
        </div>
      </div>
    </section>
  );
}
