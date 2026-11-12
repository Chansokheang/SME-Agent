/**
 * A slow, endless row of REAL items visitors care about (menu highlights, services, the owner's
 * own partner logos). Never "trusted by" filler. Pauses on hover; with reduced motion it is a
 * still, wrapping row. Pure CSS, works without JavaScript. Motion style: lively, expressive.
 */
export default function Marquee({
  children,
  seconds = 40,
  className,
  label,
}: {
  children: React.ReactNode;
  /** One full loop. Slower is calmer. */
  seconds?: number;
  className?: string;
  /** What the row is, for screen readers (e.g. "Today's specials"). */
  label: string;
}) {
  return (
    <div className={`gs-marquee group relative overflow-hidden ${className ?? ""}`} aria-label={label} role="region">
      <style>{`
        @keyframes gs-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .gs-marquee__track { animation: gs-marquee var(--gs-marquee-seconds) linear infinite; }
        .gs-marquee:hover .gs-marquee__track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .gs-marquee__track { animation: none; flex-wrap: wrap; width: 100% !important; }
          .gs-marquee__copy { display: none; }
        }
      `}</style>
      <div
        className="gs-marquee__track flex w-max"
        style={{ "--gs-marquee-seconds": `${seconds}s` } as React.CSSProperties}
      >
        <div className="flex shrink-0 items-center gap-10 pr-10">{children}</div>
        <div className="gs-marquee__copy flex shrink-0 items-center gap-10 pr-10" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
