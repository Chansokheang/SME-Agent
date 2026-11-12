import BrandMark from "@/components/BrandMark";

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-12 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <BrandMark />
          <p className="mt-3 max-w-sm text-sm text-muted">
            A research prototype for building small-business websites with AI, one approved step at a time.
          </p>
        </div>
        <nav className="flex gap-6 text-sm font-medium text-muted">
          <a href="#how" className="hover:text-ink">How it works</a>          <a href="#examples" className="hover:text-ink">Examples</a>
          <a href="#start" className="hover:text-ink">Your projects</a>
        </nav>
      </div>
    </footer>
  );
}
