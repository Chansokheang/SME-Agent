"use client";

import { useEffect, useRef, useState } from "react";
import { EASE, motionAllowed } from "./arrival";

type Tag = "h1" | "h2" | "h3" | "p";

/**
 * A headline whose words rise into place once. Text is never faded or see-through: every word
 * is at full opacity the whole time, it only moves a little. One per page at most, usually the
 * home page headline. Motion style: expressive.
 */
export default function TextReveal({
  text,
  as: As = "h1",
  className,
}: {
  text: string;
  as?: Tag;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement & HTMLParagraphElement>(null);
  const [state, setState] = useState<"still" | "ready" | "in">("still");

  useEffect(() => {
    if (!motionAllowed()) return;
    setState("ready");
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setState("in")));
    return () => cancelAnimationFrame(frame);
  }, []);

  const words = text.split(/(\s+)/);
  let index = 0;
  return (
    <As ref={ref} className={className} aria-label={text}>
      {words.map((word, i) => {
        if (/^\s+$/.test(word)) return word;
        const delay = Math.min(index++, 12) * 45;
        return (
          <span
            key={i}
            aria-hidden
            className="inline-block"
            style={
              state === "still"
                ? undefined
                : {
                    transform: state === "in" ? "none" : "translateY(0.45em)",
                    transition: `transform 650ms ${EASE} ${delay}ms`,
                  }
            }
          >
            {word}
          </span>
        );
      })}
    </As>
  );
}
