"use client";

import { useRef } from "react";
import { motionAllowed } from "./arrival";

/**
 * A card that leans slightly toward the pointer (at most 4 degrees). Mouse only: no effect on
 * touch screens or with reduced motion. Use on a few showcase cards, not on every card.
 * Motion style: lively, expressive.
 */
export default function TiltCard({
  children,
  className,
  max = 4,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function move(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || !motionAllowed()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
  }
  function leave() {
    if (ref.current) ref.current.style.transform = "";
  }

  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={leave}
      className={className}
      style={{ transition: "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)", willChange: "transform" }}
    >
      {children}
    </div>
  );
}
