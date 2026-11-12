"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { isAutomated } from "./arrival";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * A large photo that drifts slightly slower than the page as it scrolls past (a few percent, no
 * fading, no darkening). Give the frame its size with `className` (e.g. "h-[60vh] rounded-3xl").
 * Off with reduced motion and on phones. Motion style: expressive (public pages only).
 */
export default function ParallaxImage({
  children,
  className,
  strength = 8,
}: {
  /** The image, e.g. <Image fill className="object-cover" ... />. */
  children: React.ReactNode;
  className?: string;
  /** Percent the image moves across the whole scroll (keep it small). */
  strength?: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (isAutomated()) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
        gsap.fromTo(
          inner.current,
          { yPercent: -strength / 2 },
          {
            yPercent: strength / 2,
            ease: "none",
            scrollTrigger: { trigger: frame.current, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: frame },
  );

  return (
    <div ref={frame} className={`relative overflow-hidden ${className ?? ""}`}>
      <div ref={inner} className="absolute -inset-y-[6%] inset-x-0">
        {children}
      </div>
    </div>
  );
}
