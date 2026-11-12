"use client";

import { ChatCircleText, Code, Database, PaintBrush, RocketLaunch } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";

const STAGES = [
  {
    icon: ChatCircleText,
    title: "Describe",
    text: "Chat about your business, share your menu, price list or current site, and approve the plan Gagesite writes.",
    image: 3,
  },
  {
    icon: Database,
    title: "Structure",
    text: "Bookings, products, customers or orders: designed from your plan, your spreadsheets or the database you already have.",
    image: 366,
  },
  {
    icon: PaintBrush,
    title: "Design",
    text: "Add your logo, colours and photos, pick one of three styles, then agree the key pages before anything is built.",
    image: 26,
  },
  {
    icon: Code,
    title: "Build",
    text: "A small AI team builds the working site, and its own API when needed. Every task is tested, and you watch a live preview.",
    image: 0,
  },
  {
    icon: RocketLaunch,
    title: "Launch",
    text: "Code to your GitHub, data in your database, the site on your Vercel and the API on Vercel or your own server, checked after every update.",
    image: 395,
  },
];

export default function StageAccordion() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  // Image Scale & Fade: grows from 0.8 to 1 on the way in, darkens and fades to 0.2 on the way out.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const media = ".stage-media";
        gsap.fromTo(
          media,
          { scale: 0.8 },
          { scale: 1, ease: "none", scrollTrigger: { trigger: media, start: "top bottom", end: "center center", scrub: true } },
        );
        gsap.to(media, {
          opacity: 0.2,
          filter: "brightness(0.6)",
          ease: "none",
          scrollTrigger: { trigger: media, start: "bottom 45%", end: "bottom top", scrub: true },
        });
      });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="mx-auto max-w-[1400px] px-4 pb-32 md:px-6 md:pb-48">
      <h2 className="max-w-4xl font-display text-[clamp(2.25rem,4vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight">
        Five steps, one approved at a time
      </h2>

      <div className="stage-media mt-14 flex flex-col gap-3 will-change-transform md:h-[540px] md:flex-row">
        {STAGES.map((stage, i) => {
          const open = i === active;
          return (
            <button
              key={stage.title}
              type="button"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-expanded={open}
              className={`group relative min-h-[220px] overflow-hidden rounded-3xl text-left transition-[flex-grow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] md:min-h-0 ${
                open ? "md:flex-[4]" : "md:flex-1"
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center grayscale contrast-125 transition-transform duration-700 ease-out group-hover:scale-105"
                style={{ backgroundImage: `url(https://picsum.photos/id/${stage.image}/1200/900)` }}
              />
              <div
                className={`absolute inset-0 transition-colors duration-700 ${
                  open ? "bg-gradient-to-t from-[#0e2a57]/95 via-[#1a4f9e]/55 to-accent/10" : "bg-[#0e2a57]/70"
                }`}
              />
              <div className="relative flex h-full flex-col justify-between p-6 text-white">
                <span className="grid size-11 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                  <stage.icon size={22} weight="duotone" />
                </span>
                <div>
                  <h3 className="whitespace-nowrap font-display text-2xl font-bold">{stage.title}</h3>
                  <p
                    className={`mt-2 max-w-sm text-white/85 transition-all duration-500 ${
                      open ? "md:translate-y-0 md:opacity-100" : "md:translate-y-2 md:opacity-0"
                    }`}
                  >
                    {stage.text}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
