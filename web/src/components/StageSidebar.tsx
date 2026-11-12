"use client";

import { ArrowLeft, Check, Key, Lock } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useState } from "react";
import EdgeToggle, { usePersistentFlag, useShortcut } from "@/components/stage/EdgeToggle";
import BrandMark from "@/components/BrandMark";
import KeysDialog from "@/components/KeysDialog";
import type { StageInfo } from "@/lib/api";

function statusLabel(stage: StageInfo) {
  if (stage.status === "approved") return "Approved";
  if (stage.status === "locked") return "Locked";
  return stage.implemented ? "In progress" : "Coming soon";
}

function Marker({ stage }: { stage: StageInfo }) {
  if (stage.status === "approved") {
    return (
      <span className="grid size-7 place-items-center rounded-full bg-accent text-white">
        <Check size={14} weight="bold" />
      </span>
    );
  }
  if (stage.status === "locked") {
    return (
      <span className="grid size-7 place-items-center rounded-full border border-line bg-surface text-faint">
        <Lock size={12} weight="bold" />
      </span>
    );
  }
  return (
    <span className="grid size-7 place-items-center rounded-full border-2 border-accent bg-surface text-xs font-semibold text-accent">
      {stage.order}
    </span>
  );
}

/** Hover label for the collapsed rail (the rail has no room for text). */
function RailTip({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-30 ml-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition duration-200 group-hover/rail:translate-x-0 group-hover/rail:opacity-100"
    >
      {children}
    </span>
  );
}

/** Desktop sidebar: project name and stages as a vertical timeline. Collapses to an icon rail. */
export default function StageSidebar({
  projectId,
  projectName,
  stages,
  currentKey,
}: {
  projectId: string;
  projectName: string;
  stages: StageInfo[];
  currentKey: string;
}) {
  const [collapsed, setCollapsed] = usePersistentFlag("sme-builder:sidebar-collapsed");
  const [keysOpen, setKeysOpen] = useState(false);
  const toggle = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed]);
  useShortcut("b", toggle);

  return (
    <div className="relative hidden shrink-0 lg:flex">
      <aside
        className={`flex flex-col border-r border-line bg-surface transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          collapsed ? "w-[76px]" : "w-[272px]"
        }`}
      >
        <div className={`flex h-[68px] items-center ${collapsed ? "justify-center" : "px-5"}`}>
          <BrandMark compact={collapsed} />
        </div>

        {collapsed ? (
          <div className="group/rail relative mx-auto">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-accent-soft to-surface-2 font-display text-lg font-bold text-accent-ink">
              {projectName.charAt(0).toUpperCase()}
            </span>
            <RailTip>{projectName}</RailTip>
          </div>
        ) : (
          <div className="mx-3 animate-[fade-in_0.4s_ease-out] rounded-2xl bg-gradient-to-br from-accent-soft to-surface-2 px-4 py-4">
            <p className="text-xs font-medium text-accent-ink">Project</p>
            <p className="mt-0.5 truncate font-display text-xl font-bold tracking-tight">{projectName}</p>
          </div>
        )}

        <nav aria-label="Stages" className={`mt-6 flex-1 px-3 ${collapsed ? "overflow-visible" : "overflow-y-auto"}`}>
          <ol className="relative">
            {stages.map((stage, i) => {
              const isCurrent = stage.key === currentKey;
              return (
                <li key={stage.key} className="relative">
                  {i < stages.length - 1 && (
                    <span
                      aria-hidden
                      className={`absolute left-[25px] top-10 h-[calc(100%-24px)] w-px ${
                        stage.status === "approved" ? "bg-accent" : "bg-line-strong"
                      }`}
                    />
                  )}
                  <Link
                    href={`/projects/${projectId}/${stage.key}`}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={collapsed ? `${stage.title}: ${statusLabel(stage)}` : undefined}
                    className={`group/rail relative mb-1 flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${
                      isCurrent ? "bg-accent-soft" : "hover:bg-surface-2"
                    }`}
                  >
                    <Marker stage={stage} />
                    {collapsed ? (
                      <RailTip>
                        {stage.title} <span className="text-white/60">{statusLabel(stage)}</span>
                      </RailTip>
                    ) : (
                      <span className="min-w-0 animate-[fade-in_0.4s_ease-out] pt-0.5">
                        <span
                          className={`block whitespace-nowrap text-sm font-medium leading-tight ${
                            stage.status === "locked" ? "text-muted" : "text-ink"
                          }`}
                        >
                          {stage.title}
                        </span>
                        <span className={`mt-0.5 block text-xs ${isCurrent ? "text-accent-ink" : "text-faint"}`}>
                          {statusLabel(stage)}
                        </span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="space-y-2 border-t border-line p-3">
          <button
            onClick={() => setKeysOpen(true)}
            aria-label={collapsed ? "Keys & settings" : undefined}
            className="group/rail relative flex w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-sm font-medium transition hover:border-accent hover:text-accent-ink active:scale-[0.98]"
          >
            <Key size={16} weight="bold" />
            {collapsed ? <RailTip>Keys & settings</RailTip> : <span className="whitespace-nowrap">Keys & settings</span>}
          </button>
          <Link
            href="/#start"
            aria-label={collapsed ? "All projects" : undefined}
            className="group/rail relative flex items-center justify-center gap-1.5 py-1.5 text-sm text-muted transition hover:text-ink"
          >
            <ArrowLeft size={14} />
            {collapsed ? <RailTip>All projects</RailTip> : <span className="whitespace-nowrap">All projects</span>}
          </Link>
        </div>
      </aside>

      {keysOpen && <KeysDialog projectId={projectId} onClose={() => setKeysOpen(false)} />}
      <EdgeToggle
        collapsed={collapsed}
        onToggle={toggle}
        label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        shortcut="B"
        className="-right-3.5 top-[22px]"
      />
    </div>
  );
}

/** Below lg: a compact top bar with the project name and scrollable stage pills. */
export function MobileStageBar({
  projectId,
  projectName,
  stages,
  currentKey,
}: {
  projectId: string;
  projectName: string;
  stages: StageInfo[];
  currentKey: string;
}) {
  return (
    <div className="border-b border-line bg-surface lg:hidden">
      <div className="flex items-center justify-between px-4 pt-3">
        <Link href="/#start" className="flex items-center gap-1.5 text-sm text-muted">
          <ArrowLeft size={14} />
          Projects
        </Link>
        <span className="truncate pl-4 font-display text-lg font-bold">{projectName}</span>
      </div>
      <nav aria-label="Stages" className="overflow-x-auto px-4 py-3">
        <ol className="flex w-max gap-2">
          {stages.map((stage) => (
            <li key={stage.key}>
              <Link
                href={`/projects/${projectId}/${stage.key}`}
                aria-current={stage.key === currentKey ? "step" : undefined}
                className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm ${
                  stage.key === currentKey ? "bg-accent-soft font-medium text-accent-ink" : "bg-surface-2 text-muted"
                }`}
              >
                <Marker stage={stage} />
                <span className="whitespace-nowrap">{stage.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
