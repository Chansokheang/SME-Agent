"use client";

import { CaretLeft } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

/** Round handle that sits on a panel's right border; the chevron points the way the panel will move. */
export default function EdgeToggle({
  collapsed,
  onToggle,
  label,
  shortcut,
  className = "",
  side = "right",
}: {
  collapsed: boolean;
  onToggle: () => void;
  label: string;
  /** Shown in the tooltip, e.g. "B" for Ctrl/Cmd + B. */
  shortcut: string;
  className?: string;
  /** Which border it sits on: "right" for a pane that folds left, "left" for one that folds right. */
  side?: "left" | "right";
}) {
  // The chevron points the way the pane will move.
  const pointsRight = side === "right" ? collapsed : !collapsed;
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={!collapsed}
      className={`group/edge absolute z-20 grid size-7 place-items-center rounded-full border border-line-strong bg-surface text-muted shadow-[0_4px_14px_-6px_rgba(14,42,87,0.35)] transition duration-300 hover:scale-110 hover:border-accent hover:text-accent active:scale-95 ${className}`}
    >
      <CaretLeft
        size={13}
        weight="bold"
        className={`transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${pointsRight ? "rotate-180" : ""}`}
      />
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-1/2 flex -translate-y-1/2 ${
          side === "right" ? "left-full ml-2.5 translate-x-1" : "right-full mr-2.5 -translate-x-1"
        } items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition duration-200 group-hover/edge:translate-x-0 group-hover/edge:opacity-100 group-focus-visible/edge:translate-x-0 group-focus-visible/edge:opacity-100`}
      >
        {label}
        <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-sans text-[10px] text-white/80">
          {mac ? "⌘" : "Ctrl"} {shortcut}
        </kbd>
      </span>
    </button>
  );
}

/** Ctrl/Cmd + key, also while typing in the chat box. */
export function useShortcut(key: string, handler: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === key) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, handler]);
}

/** Boolean preference kept in localStorage (best-effort: storage can be unavailable). */
export function usePersistentFlag(storageKey: string): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(false);
  useEffect(() => {
    try {
      setValue(localStorage.getItem(storageKey) === "1");
    } catch {}
  }, [storageKey]);
  const update = (next: boolean) => {
    setValue(next);
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {}
  };
  return [value, update];
}
