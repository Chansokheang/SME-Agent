"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect } from "react";
import { isAutomated } from "./arrival";

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth, slightly weighted wheel scrolling (Lenis), kept in step with GSAP's scroll effects.
 * Put it ONCE in the layout of the PUBLIC pages, never around admin, account or tool pages
 * (tables, forms, dashboards must scroll natively). Touch scrolling stays native; reduced motion
 * turns it off. A scrolling area inside the page needs `data-lenis-prevent`.
 * Motion style: expressive.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (isAutomated()) return;
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
  return null;
}
