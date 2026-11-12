"use client";

import { ChatCircleText, type Icon } from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import EdgeToggle, { usePersistentFlag, useShortcut } from "@/components/stage/EdgeToggle";

/**
 * Chat on the left, the stage's output on the right. On desktop the chat collapses to a slim
 * rail (edge handle or Ctrl/Cmd + .) to give the output the full width; below lg, a switch
 * shows one pane at a time instead.
 */
export default function StageLayout({
  chat,
  panel,
  panelLabel,
  panelIcon: PanelIcon,
  wide,
  chatBusy,
  startOnPanel,
}: {
  chat: React.ReactNode;
  panel: React.ReactNode;
  panelLabel: string;
  panelIcon: Icon;
  /** Give the output panel more room (e.g. for a diagram). */
  wide?: boolean;
  /** Claude is replying; shown on the collapsed chat rail. */
  chatBusy?: boolean;
  /** On phones, open on the panel (e.g. when it holds the stage's starting form). */
  startOnPanel?: boolean;
}) {
  const [pane, setPane] = useState<"chat" | "panel">(startOnPanel ? "panel" : "chat");
  const [chatFolded, setCollapsed] = usePersistentFlag("sme-builder:chat-collapsed");
  // The right side (preview, design, plan...) is closed by default, so the chat fills the screen.
  // It opens by itself while it holds the stage's starting form, which the owner needs to see.
  const [panelOpen, setPanelOpen] = usePersistentFlag("sme-builder:panel-open");
  const panelHidden = !panelOpen && !startOnPanel;
  // Never both: with the panel closed, the chat always shows.
  const collapsed = chatFolded && !panelHidden;
  // Only one side folds at a time: showing the chat or hiding the panel always leaves the other open.
  const toggle = useCallback(() => {
    if (!collapsed) setPanelOpen(true);
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed, setPanelOpen]);
  const togglePanel = useCallback(() => {
    if (!panelHidden) setCollapsed(false);
    setPanelOpen(panelHidden);
  }, [panelHidden, setPanelOpen, setCollapsed]);
  useShortcut(".", toggle);
  useShortcut("/", togglePanel);

  const tabs = [
    { key: "chat" as const, label: "Chat", icon: ChatCircleText },
    { key: "panel" as const, label: panelLabel, icon: PanelIcon },
  ];
  // The chat keeps a comfortable reading width; the stage's output gets the rest of the screen.
  const columns = panelHidden
    ? "lg:grid-cols-[minmax(0,1fr)_52px]"
    : collapsed
    ? "lg:grid-cols-[52px_minmax(0,1fr)]"
    : wide
      ? "lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] xl:grid-cols-[400px_minmax(0,1fr)] 2xl:grid-cols-[440px_minmax(0,1fr)]"
      : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)] 2xl:grid-cols-[480px_minmax(0,1fr)]";
  const handle = (
    <EdgeToggle
      collapsed={collapsed}
      onToggle={toggle}
      label={collapsed ? "Show chat" : "Hide chat"}
      shortcut="."
      className="-right-3.5 top-[22px] hidden lg:grid"
    />
  );

  return (
    <div className={`flex h-full flex-col lg:grid ${columns}`}>
      <div className="flex gap-1 border-b border-line bg-surface p-2 lg:hidden" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={pane === tab.key}
            onClick={() => setPane(tab.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
              pane === tab.key ? "bg-accent-soft text-accent-ink" : "text-muted"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Collapsed rail (desktop only) */}
      {collapsed && (
        <div className="relative hidden border-r border-line bg-surface/70 lg:block">
          <button
            onClick={toggle}
            aria-label="Show chat"
            className="group flex h-full w-full flex-col items-center gap-3 pt-16"
          >
            <span className="relative grid size-9 place-items-center rounded-xl text-accent transition group-hover:bg-accent-soft">
              <ChatCircleText size={20} weight="duotone" />
              {chatBusy && (
                <span className="absolute right-0.5 top-0.5 flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full border-2 border-surface bg-accent" />
                </span>
              )}
            </span>
            <span className="text-[11px] font-medium tracking-wide text-faint [writing-mode:vertical-rl] group-hover:text-accent-ink">
              {chatBusy ? "Gagesite is working" : "Chat"}
            </span>
          </button>
          {handle}
        </div>
      )}

      <div
        className={`relative min-h-0 flex-1 ${pane === "chat" ? "block" : "hidden"} ${collapsed ? "lg:hidden" : "lg:block"}`}
      >
        {/* With the panel folded away the chat keeps a readable width in the middle of the screen. */}
        <div className={`h-full ${panelHidden ? "lg:mx-auto lg:max-w-4xl" : ""}`}>{chat}</div>
      </div>
      {/* The panel fills its column, whatever width its own content would take. */}
      <div
        className={`relative min-h-0 min-w-0 flex-1 ${pane === "panel" ? "flex" : "hidden"} ${
          panelHidden ? "lg:hidden" : "lg:flex"
        } [&>*:not(button)]:min-w-0 [&>*:not(button)]:flex-1`}
      >
        {panel}
        {!collapsed && (
          <EdgeToggle
            collapsed={false}
            onToggle={togglePanel}
            label={`Hide ${panelLabel.toLowerCase()}`}
            shortcut="/"
            side="left"
            className="-left-3.5 top-[22px] hidden lg:grid"
          />
        )}
      </div>

      {/* Folded panel rail (desktop only) */}
      {panelHidden && (
        <div className="relative hidden border-l border-line bg-surface/70 lg:block">
          <button
            onClick={togglePanel}
            aria-label={`Show ${panelLabel.toLowerCase()}`}
            className="group flex h-full w-full flex-col items-center gap-3 pt-16"
          >
            <span className="grid size-9 place-items-center rounded-xl text-accent transition group-hover:bg-accent-soft">
              <PanelIcon size={20} weight="duotone" />
            </span>
            <span className="text-[11px] font-medium tracking-wide text-faint [writing-mode:vertical-rl] group-hover:text-accent-ink">
              {panelLabel}
            </span>
          </button>
          <EdgeToggle
            collapsed
            onToggle={togglePanel}
            label={`Show ${panelLabel.toLowerCase()}`}
            shortcut="/"
            side="left"
            className="-left-3.5 top-[22px] hidden lg:grid"
          />
        </div>
      )}
    </div>
  );
}
