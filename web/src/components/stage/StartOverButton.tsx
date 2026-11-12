"use client";

import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { useState } from "react";
import ConfirmDialog from "@/components/stage/ConfirmDialog";
import { api } from "@/lib/api";

/**
 * "Start over" for any stage: clears what the stage made and its conversation, so the next message
 * starts fresh (an approved stage is reopened first). Sits at the top right of the stage's chat.
 */
export default function StartOverButton({
  projectId,
  stageKey,
  stageName,
  approved,
  cleared,
  kept,
  disabled,
  onDone,
}: {
  projectId: string;
  stageKey: string;
  /** As it reads mid-sentence, e.g. "UI design" or "the feature analysis", for the dialog's title. */
  stageName: string;
  approved: boolean;
  /** What is cleared and what stays, in plain words. */
  cleared: string;
  kept: string;
  disabled?: boolean;
  /** Reload the stage after clearing. */
  onDone: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <ConfirmDialog
          title={`Start ${stageName} over?`}
          description={
            <>
              Gagesite starts this step again from the beginning, without the current version.
              {approved && " The step is approved, so it is reopened first and later steps wait for it again."} This
              can&apos;t be undone.
            </>
          }
          rows={[
            ["Cleared", cleared],
            ["Kept", kept],
          ]}
          confirmLabel="Start over"
          busyLabel="Clearing..."
          danger
          onConfirm={async () => {
            await api.resetStage(projectId, stageKey);
            await onDone();
          }}
          onClose={() => setOpen(false)}
        />
      )}
      <StartOverTrigger onClick={() => setOpen(true)} disabled={disabled} />
    </>
  );
}

/**
 * The "Start over" control in a stage's chat header, styled like the panels' header controls (quiet,
 * 32px, soft hover). Hover physics from gpt-taste: the arrow turns back, a "rewind" cue.
 */
export function StartOverTrigger({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Clear this step and start it again"
      className="group inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
    >
      <ArrowCounterClockwise
        size={14}
        weight="bold"
        className="transition-transform duration-700 ease-out group-hover:-rotate-[360deg] motion-reduce:transition-none motion-reduce:group-hover:rotate-0"
      />
      Start over
    </button>
  );
}
