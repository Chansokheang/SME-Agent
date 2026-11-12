"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";

/** Words brighten from 0.12 to full opacity, in order, as the paragraph scrolls through the viewport. */
export default function ScrubText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(
          ".scrub-word",
          { opacity: 0.12 },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.05,
            scrollTrigger: { trigger: ref.current, start: "top 80%", end: "bottom 45%", scrub: true },
          },
        );
      });
    },
    { scope: ref },
  );

  return (
    <section className="mx-auto max-w-5xl px-4 py-32 md:px-6 md:py-48">
      <p
        ref={ref}
        className="font-display text-[clamp(1.9rem,3.6vw,3.25rem)] font-bold leading-[1.18] tracking-tight text-ink"
      >
        {text.split(" ").map((word, i) => (
          <span key={i} className="scrub-word">
            {word}{" "}
          </span>
        ))}
      </p>
    </section>
  );
}
