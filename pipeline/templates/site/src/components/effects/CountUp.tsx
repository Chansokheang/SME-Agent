"use client";

import { useEffect, useRef, useState } from "react";
import { useArrival } from "./arrival";

/**
 * A REAL number (from the database or the plan, never invented) that counts up once when it
 * scrolls into view. The server, screenshots and reduced-motion visitors get the final value.
 * Motion style: lively, expressive.
 */
export default function CountUp({
  value,
  duration = 1100,
  locale,
  options,
  className,
}: {
  value: number;
  duration?: number;
  locale?: string;
  options?: Intl.NumberFormatOptions;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const state = useArrival(ref);
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (state !== "in") return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(t < 1 ? value * eased : null);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state, value, duration]);

  const format = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: Number.isInteger(value) ? 0 : 1, ...options }).format(n);
  // Waiting below the screen: show 0 until it arrives; otherwise the real value.
  const display = state === "waiting" ? 0 : (shown ?? value);
  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {format(display)}
    </span>
  );
}
