"use client";

import { Children, useRef } from "react";
import { EASE, useArrival } from "./arrival";

/**
 * A list or grid whose items ease in one after another, once, as it scrolls into view.
 * `className` styles the container (e.g. a grid); `itemClassName` each item's wrapper.
 * Motion style: lively, expressive.
 */
export default function Stagger({
  children,
  className,
  itemClassName,
  step = 60,
}: {
  children: React.ReactNode;
  className?: string;
  itemClassName?: string;
  /** Milliseconds between items (capped so long lists don't drag). */
  step?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useArrival(ref);
  return (
    <div ref={ref} className={className}>
      {Children.toArray(children).map((child, i) => {
        const delay = Math.min(i, 8) * step;
        return (
          <div
            key={i}
            className={itemClassName}
            style={
              state === "still"
                ? undefined
                : {
                    opacity: state === "in" ? 1 : 0,
                    transform: state === "in" ? "none" : "translateY(12px)",
                    transition: `opacity 400ms ${EASE} ${delay}ms, transform 400ms ${EASE} ${delay}ms`,
                  }
            }
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
