import BrandMark from "@/components/BrandMark";
import ClaudeAccountMenu from "@/components/home/ClaudeAccountMenu";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#examples", label: "Examples" },
  { href: "#start", label: "Your projects" },
];

export default function FloatingNav() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-30 flex justify-center px-4">
      <nav className="pointer-events-auto flex w-full max-w-5xl items-center justify-between gap-4 rounded-full border border-white/70 bg-white/70 py-2 pl-4 pr-2 shadow-[0_8px_32px_-12px_rgba(34,102,212,0.25),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
        <BrandMark />
        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium text-muted transition hover:bg-accent-soft hover:text-accent-ink"
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <ClaudeAccountMenu />
          <a
            href="#start"
            className="whitespace-nowrap rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover active:scale-[0.98]"
          >
            Start a project
          </a>
        </div>
      </nav>
    </div>
  );
}
