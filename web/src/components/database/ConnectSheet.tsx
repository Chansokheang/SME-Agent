"use client";

import { X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import ConnectView from "@/components/database/ConnectView";
import type { DbConnection } from "@/lib/api";

/** Side sheet for the last step of Stage 2: connecting the database the website will use. */
export default function ConnectSheet({
  open,
  onClose,
  projectId,
  approved,
  connection,
  onConnectionChange,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  approved: boolean;
  connection: DbConnection | null;
  onConnectionChange: (connection: DbConnection | null) => void;
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Connect your database">
          <motion.div
            className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="absolute inset-y-0 right-0 flex w-full max-w-[640px] flex-col bg-surface shadow-[-24px_0_60px_-30px_rgba(14,42,87,0.45)]"
            initial={reduce ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={reduce ? undefined : { x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 32 }}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <p className="text-sm font-medium text-muted">Database design: last step</p>
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <ConnectView
                projectId={projectId}
                approved={approved}
                connection={connection}
                onChange={onConnectionChange}
              />
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
