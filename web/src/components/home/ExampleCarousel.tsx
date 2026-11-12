"use client";

import { ArrowLeft, ArrowRight, Quotes } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

/** Example opening messages and what the plan grew into. Illustrative, not customer testimonials. */
const EXAMPLES = [
  {
    business: "Café",
    opener: "I run a small café and want people to see our menu and reserve a table.",
    plan: "A menu the owner edits, table requests confirmed by email, opening hours and a map.",
    image: 1060,
  },
  {
    business: "Coffee roaster",
    opener: "We roast beans and want to sell bags online with weekly delivery.",
    plan: "A small shop, subscription orders, delivery days and an admin page for orders.",
    image: 425,
  },
  {
    business: "Dessert shop",
    opener: "Customers keep calling to pre-order cakes. I want them to do it online.",
    plan: "Cake pre-orders with pickup dates, a seasonal menu and order notifications.",
    image: 493,
  },
  {
    business: "Camera repair",
    opener: "People should be able to ask for a repair quote and send photos.",
    plan: "A quote request form with photo upload, status updates and a services page.",
    image: 250,
  },
];

export default function ExampleCarousel() {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  const example = EXAMPLES[index];
  const go = (step: number) => setIndex((i) => (i + step + EXAMPLES.length) % EXAMPLES.length);

  return (
    <section id="examples" className="scroll-mt-24 border-y border-line bg-surface py-32 md:py-48">
      <div className="mx-auto grid max-w-[1400px] items-center gap-14 px-4 md:px-6 lg:grid-cols-[1fr_1.1fr]">
        {/* Overlapping photo stack: the current example in front, the next two peeking behind. */}
        <div className="relative mx-auto h-[420px] w-full max-w-[520px]">
          {[2, 1, 0].map((offset) => {
            const item = EXAMPLES[(index + offset) % EXAMPLES.length];
            return (
              <motion.div
                key={item.image}
                layout={!reduce}
                animate={{ rotate: offset * 4, x: offset * 34, y: offset * -14, scale: 1 - offset * 0.06 }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                style={{ zIndex: 3 - offset }}
                className="group absolute inset-0 overflow-hidden rounded-3xl border-4 border-white shadow-[0_30px_60px_-30px_rgba(14,42,87,0.45)]"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center grayscale-[60%] contrast-110 transition-transform duration-700 ease-out group-hover:scale-105"
                  style={{ backgroundImage: `url(https://picsum.photos/id/${item.image}/900/900)` }}
                />
                {offset > 0 && <div className="absolute inset-0 bg-accent-soft/50" />}
              </motion.div>
            );
          })}
        </div>

        <div>
          <h2 className="font-display text-[clamp(2.25rem,4vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight">
            One sentence is enough to start
          </h2>
          <div className="mt-10 min-h-[260px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={example.business}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -14 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="text-sm font-medium text-accent-ink">Example: {example.business}</p>
                <Quotes size={36} weight="fill" className="mt-4 text-accent/25" />
                <blockquote className="mt-2 font-display text-2xl font-bold leading-snug md:text-3xl">
                  {example.opener}
                </blockquote>
                <p className="mt-6 max-w-lg leading-relaxed text-muted">
                  <span className="font-medium text-ink">The plan included: </span>
                  {example.plan}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous example"
              className="grid size-12 place-items-center rounded-full border border-line-strong bg-white text-ink transition hover:border-accent hover:text-accent active:scale-95"
            >
              <ArrowLeft size={18} weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next example"
              className="grid size-12 place-items-center rounded-full bg-accent text-white transition hover:bg-accent-hover active:scale-95"
            >
              <ArrowRight size={18} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
