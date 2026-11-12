/**
 * A title (with a line of text and maybe a button) that stays in place on the left while a column
 * of items scrolls past on the right, e.g. the story of a dish, the steps of a service, a few
 * projects. Plain CSS sticky positioning: scrolling stays completely normal, it works without
 * JavaScript, and on phones it is a simple stack. Motion style: expressive (public pages only).
 */
export default function PinnedShowcase({
  aside,
  children,
  className,
}: {
  aside: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 ${className ?? ""}`}>
      <div className="lg:sticky lg:top-24 lg:self-start">{aside}</div>
      <div className="flex flex-col gap-8">{children}</div>
    </div>
  );
}
