"use client";

import { useEffect, useState, type RefObject } from "react";

/*
 * Shared rule for every entrance effect: content is ALWAYS visible on the server, without
 * JavaScript, in screenshots and in automated browsers (the self-test). Only an element that is
 * still below the screen when the page loads, for a visitor who hasn't asked for reduced motion,
 * is hidden and then eases in once as it scrolls into view.
 */

export type Arrival = "still" | "waiting" | "in";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Tests and screenshots (Playwright, etc.) see the finished page, never a half-played animation. */
export function isAutomated(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.webdriver);
}

export function motionAllowed(): boolean {
  return !prefersReducedMotion() && !isAutomated();
}

export function useArrival(ref: RefObject<Element | null>): Arrival {
  const [state, setState] = useState<Arrival>("still");
  useEffect(() => {
    const element = ref.current;
    if (!element || !motionAllowed() || !("IntersectionObserver" in window)) return;
    // Already on screen when the page loads: leave it be (no flash of disappearing content).
    if (element.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    setState("waiting");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setState("in");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return state;
}

export const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
