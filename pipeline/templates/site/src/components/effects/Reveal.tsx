"use client";

import { useRef } from "react";
import { EASE, useArrival } from "./arrival";

/** A section or block that eases up once as it scrolls into view. Motion style: lively, expressive. */
export default function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Milliseconds, for a small hand-made stagger. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useArrival(ref);
  const style: React.CSSProperties | undefined =
    state === "still"
      ? undefined
      : {
          opacity: state === "in" ? 1 : 0,
          transform: state === "in" ? "none" : "translateY(14px)",
          transition: `opacity 450ms ${EASE} ${delay}ms, transform 450ms ${EASE} ${delay}ms`,
        };
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
