import {
  Barbell,
  BookOpen,
  Bread,
  Coffee,
  Flower,
  ForkKnife,
  PawPrint,
  Scissors,
  Tooth,
  Wrench,
} from "@phosphor-icons/react/dist/ssr";

const BUSINESSES = [
  { icon: Coffee, label: "Cafés" },
  { icon: Scissors, label: "Hair salons" },
  { icon: Bread, label: "Bakeries" },
  { icon: Tooth, label: "Dental clinics" },
  { icon: Barbell, label: "Fitness studios" },
  { icon: Flower, label: "Florists" },
  { icon: BookOpen, label: "Bookshops" },
  { icon: Wrench, label: "Repair shops" },
  { icon: ForkKnife, label: "Restaurants" },
  { icon: PawPrint, label: "Pet groomers" },
];

export default function BusinessMarquee() {
  return (
    <section aria-label="Businesses it builds for" className="relative border-y border-line bg-surface py-8">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-surface to-transparent" />
      <div className="overflow-hidden">
        {/* Two copies of the row; the track slides exactly one copy width, so the loop is seamless. */}
        <div className="animate-marquee flex w-max">
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center gap-14 pr-14">
              {BUSINESSES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 whitespace-nowrap">
                  <Icon size={30} weight="duotone" className="text-accent" />
                  <span className="font-display text-2xl font-bold tracking-tight text-ink/80">{label}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
