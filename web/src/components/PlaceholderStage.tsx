import { Code, Database, Lock, PaintBrush, RocketLaunch, type Icon } from "@phosphor-icons/react";
import type { StageInfo } from "@/lib/api";

const ICONS: Record<string, Icon> = {
  "02-database": Database,
  "03-design": PaintBrush,
  "04-build": Code,
  "05-deploy": RocketLaunch,
};

export default function PlaceholderStage({ stage }: { stage: StageInfo }) {
  const StageIcon = ICONS[stage.key] ?? Code;
  const locked = stage.status === "locked";
  return (
    <div className="relative grid h-full place-items-center overflow-hidden px-6">
      <div className="absolute left-1/2 top-1/2 -z-0 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-soft/70 blur-3xl" />
      <div className="relative max-w-md text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-surface text-accent shadow-[0_12px_32px_-12px_rgba(34,102,212,0.4)]">
          <StageIcon size={30} weight="duotone" />
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">{stage.title}</h1>
        <p className="mt-2 text-muted">{stage.description}</p>
        <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-sm text-muted shadow-sm">
          {locked && <Lock size={14} weight="bold" />}
          {locked ? "Approve the previous stage to unlock" : "This stage is being built. Check back soon."}
        </p>
      </div>
    </div>
  );
}
