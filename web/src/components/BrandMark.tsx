import Link from "next/link";
import Logo from "@/components/Logo";

export default function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="Gagesite home" className="flex items-center gap-2">
      <Logo size={34} className="shrink-0" />
      {!compact && (
        <span className="whitespace-nowrap font-display text-[18px] font-bold tracking-tight">
          Gage<span className="text-accent">site</span>
        </span>
      )}
    </Link>
  );
}
