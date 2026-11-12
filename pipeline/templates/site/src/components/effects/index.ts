/*
 * Ready-made motion helpers for the common parts of gpt-taste's motion (see the build
 * instructions: "Motion: gpt-taste, placed by the kind of page"). All of them keep content
 * visible without JavaScript and in automated browsers, and switch off under reduced motion.
 *   Reveal, Stagger      sections and lists easing in once as they scroll into view
 *   CountUp              a real number counting up once
 *   Marquee              a slow row of real content
 *   TiltCard             hover physics on a showcase card
 *   TextReveal           one headline's words rising into place
 *   ParallaxImage        a large photo drifting as the page scrolls
 *   PinnedShowcase       a title pinned beside its scrolling story
 *   StackedCards         cards stacking as the page scrolls
 *   SmoothScroll         smooth wheel scrolling, public content pages only
 * Import each from its own file, e.g. `import Reveal from "@/components/effects/Reveal"`.
 */
export const EFFECTS = [
  "Reveal",
  "Stagger",
  "CountUp",
  "Marquee",
  "TiltCard",
  "TextReveal",
  "ParallaxImage",
  "PinnedShowcase",
  "StackedCards",
  "SmoothScroll",
] as const;
