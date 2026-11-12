import { Children } from "react";

/**
 * Large cards that slide up and stack over each other as the page scrolls (3 to 5 cards, each
 * one real thing: a room, a service, a signature dish). Plain CSS sticky positioning: normal
 * scrolling, works without JavaScript; on phones and with reduced motion it is a simple list.
 * Each child should be a full card with its own background. Motion style: expressive.
 */
export default function StackedCards({
  children,
  className,
  top = 96,
}: {
  children: React.ReactNode;
  className?: string;
  /** Distance from the top of the screen where the first card stops (px), below a fixed header. */
  top?: number;
}) {
  const cards = Children.toArray(children);
  return (
    <div className={`flex flex-col gap-6 ${className ?? ""}`}>
      <style>{`
        @media (min-width: 768px) and (prefers-reduced-motion: no-preference) {
          .gs-stack__card { position: sticky; top: var(--gs-stack-top); }
        }
      `}</style>
      {cards.map((card, i) => (
        <div
          key={i}
          className="gs-stack__card"
          style={{ "--gs-stack-top": `${top + i * 16}px` } as React.CSSProperties}
        >
          {card}
        </div>
      ))}
    </div>
  );
}
