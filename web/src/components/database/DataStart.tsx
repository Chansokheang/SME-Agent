"use client";

import {
  ArrowRight,
  CircleNotch,
  CloudArrowUp,
  Database,
  FileSql,
  FileXls,
  Files,
  ListChecks,
  Trash,
  Warning,
  type Icon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import SourceConnect from "@/components/database/SourceConnect";
import type { FileProfile, SourceDb } from "@/lib/api";

export type Choice = "plan" | "files" | "connect" | "none";

const CHOICES: { key: Choice; icon: Icon; title: string; text: string }[] = [
  {
    key: "plan",
    icon: ListChecks,
    title: "Start from my plan",
    text: "Nothing to upload. Gagesite designs from the plan you approved.",
  },
  {
    key: "files",
    icon: CloudArrowUp,
    title: "Upload my files",
    text: "Excel or CSV files with customers, bookings or products, or an SQL file with your database structure.",
  },
  {
    key: "connect",
    icon: Database,
    title: "Connect my existing database",
    text: "Supabase, Neon or any Postgres. Read only: Gagesite designs around what's already in it.",
  },
  {
    key: "none",
    icon: Files,
    title: "No database: a simple site",
    text: "Content lives in files that ship with the site, and forms arrive by email. No admin page; ask in the chat to change things.",
  },
];

const ACCEPT = ".xlsx,.xls,.xlsm,.csv,.sql";

/** First screen of Stage 2: pick a starting point, optionally upload data, then start the design. */
export default function DataStart({
  uploads,
  uploading,
  uploadError,
  onUpload,
  onRemove,
  onStart,
  advice,
  projectId,
  source,
  onSourceChange,
  starting = false,
}: {
  uploads: FileProfile[];
  uploading: boolean;
  uploadError: string | null;
  onUpload: (files: File[]) => void;
  onRemove: (file: string) => void;
  onStart: (choice: Choice) => void;
  /** Claude's advice from the plan: does this site need a database at all? */
  advice?: { needs_database: boolean | null; why: string; existing?: "" | "database" | "spreadsheets" | "other" };
  projectId: string;
  /** The owner's existing database, if connected (read only). */
  source: SourceDb | null;
  onSourceChange: (source: SourceDb | null, uploads: FileProfile[]) => void;
  /** The choice is being saved (no database skips this step). */
  starting?: boolean;
}) {
  const [choice, setChoice] = useState<Choice>("plan");
  const [dragging, setDragging] = useState(false);
  // The connected database shows in the profile like a file; the upload list shows only files.
  const files = uploads.filter((u) => u.kind !== "database");
  const connected = uploads.find((u) => u.kind === "database");
  const hasFiles = files.length > 0;
  const hasSource = !!source;
  // The plan says the owner already has a database: designing from its real tables beats guessing.
  const hasDatabase = advice?.existing === "database";
  const suggested: Choice = hasDatabase ? "connect" : advice?.needs_database === false ? "none" : "plan";

  // Uploads, the connection and the plan load after the first render: once they arrive, open the matching option.
  useEffect(() => {
    if (hasSource || (hasDatabase && !hasFiles)) setChoice("connect");
    else if (hasFiles) setChoice("files");
  }, [hasSource, hasFiles, hasDatabase]);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();
  const needsFiles = choice === "files";
  const canStart = !uploading && (choice === "files" ? files.some((u) => !u.error) : choice === "connect" ? hasSource : true);

  return (
    <div className="py-2">
      <div className="text-center">
        <h2 className="mx-auto max-w-3xl font-display text-[clamp(1.6rem,2.4vw,2.1rem)] font-bold leading-tight tracking-tight">
          Where should your database design start?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
          Your plan is enough on its own. If you already keep records somewhere, Gagesite can design around them.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-2.5 @2xl:grid-cols-2" role="radiogroup" aria-label="Starting point">
        {CHOICES.map((c) => {
          const selected = choice === c.key;
          return (
            <button
              key={c.key}
              role="radio"
              aria-checked={selected}
              onClick={() => setChoice(c.key)}
              className={`group flex items-center gap-4 rounded-3xl border p-4 text-left transition duration-500 hover:-translate-y-0.5 active:scale-[0.99] ${
                selected
                  ? "border-accent bg-accent-soft shadow-[0_18px_40px_-24px_rgba(34,102,212,0.6)]"
                  : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-2xl transition-transform duration-700 group-hover:scale-105 ${
                  selected ? "bg-accent text-white" : "bg-surface-2 text-accent"
                }`}
              >
                <c.icon size={24} weight="duotone" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`font-semibold ${selected ? "text-accent-ink" : ""}`}>{c.title}</span>
                  {c.key === suggested && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                      {suggested === "plan" ? "Most common" : "Suggested for your plan"}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm leading-relaxed text-muted">{c.text}</span>
              </span>
              <span
                aria-hidden
                className={`grid size-5 shrink-0 place-items-center rounded-full border-2 transition ${
                  selected ? "border-accent" : "border-line-strong"
                }`}
              >
                {selected && <span className="size-2.5 rounded-full bg-accent" />}
              </span>
            </button>
          );
        })}
      </div>

      {hasDatabase && choice === "plan" && (
        <div className="mt-4 flex gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 ring-1 ring-amber-200/70">
          <Warning size={18} weight="fill" className="mt-0.5 shrink-0 text-amber-500" />
          <span>
            <span className="font-semibold">Your plan says your data is already in a database.</span> Starting from the plan means
            Gagesite guesses its tables. Connect it instead (read only) and the design follows your real tables and fields.
          </span>
        </div>
      )}

      <AnimatePresence initial={false}>
        {choice === "none" && (
          <motion.div
            key="none"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            {advice?.needs_database ? (
              <div className="mt-4 flex gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 ring-1 ring-amber-200/70">
                <Warning size={18} weight="fill" className="mt-0.5 shrink-0 text-amber-500" />
                <span>
                  <span className="font-semibold">Your plan keeps information over time.</span> {advice.why} Without a database,
                  those parts become email-only and there is no admin page. You&apos;ll see what changes, and you can reopen this
                  step to add a database later.
                </span>
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-sm leading-relaxed text-muted">
                {advice?.why ? `${advice.why} ` : ""}This step is skipped; you can reopen it to add a database later.
              </p>
            )}
          </motion.div>
        )}
        {choice === "connect" && (
          <motion.div
            key="connect"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <SourceConnect projectId={projectId} source={source} tables={connected?.sheets ?? []} onChange={onSourceChange} />
            </div>
          </motion.div>
        )}
        {needsFiles && (
          <motion.div
            key="upload"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  onUpload(Array.from(e.dataTransfer.files));
                }}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed px-6 py-9 text-center transition ${
                  dragging
                    ? "border-accent bg-accent-soft"
                    : "border-line-strong bg-surface hover:border-accent hover:bg-accent-soft/40"
                }`}
              >
                {uploading ? (
                  <CircleNotch size={34} className="animate-spin text-accent" />
                ) : (
                  <CloudArrowUp size={34} weight="duotone" className="text-accent" />
                )}
                <p className="mt-3 font-medium">{uploading ? "Reading your file..." : "Drop files here, or click to choose"}</p>
                <p className="mt-1 text-xs text-muted">Excel (.xlsx, .xls), CSV or SQL, up to 20 MB each</p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    onUpload(Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                />
              </div>

              {uploadError && <p className="mt-3 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">{uploadError}</p>}

              {files.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {files.map((file) => (
                    <UploadRow key={file.file} file={file} onRemove={() => onRemove(file.file)} />
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs leading-relaxed text-faint">
                Gagesite only sees column names, counts and masked samples. Your actual rows stay on this server.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6 flex justify-center">
        <button
          onClick={() => onStart(choice)}
          disabled={!canStart || starting}
          className="group inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 font-semibold text-white shadow-[0_12px_32px_-12px_rgba(34,102,212,0.7)] transition hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-line-strong disabled:shadow-none"
        >
          {choice === "none" ? (starting ? "Skipping..." : "Skip: no database") : "Design my database"}
          <ArrowRight size={18} weight="bold" className="transition group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

function UploadRow({ file, onRemove }: { file: FileProfile; onRemove: () => void }) {
  const rows = file.sheets.reduce((sum, s) => sum + s.rows, 0);
  const summary = file.error
    ? file.error
    : file.kind === "sql"
      ? "Database structure found"
      : `${file.sheets.length} sheet${file.sheets.length === 1 ? "" : "s"}: ${file.sheets.map((s) => s.name).join(", ")}  /  ${rows} rows`;
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      {file.kind === "sql" ? (
        <FileSql size={26} weight="duotone" className="shrink-0 text-accent" />
      ) : (
        <FileXls size={26} weight="duotone" className="shrink-0 text-accent" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.file}</p>
        <p className={`truncate text-xs ${file.error ? "text-danger" : "text-muted"}`}>{summary}</p>
      </div>
      <button
        onClick={onRemove}
        aria-label={`Remove ${file.file}`}
        className="grid size-8 place-items-center rounded-lg text-faint transition hover:bg-danger-soft hover:text-danger"
      >
        <Trash size={16} />
      </button>
    </li>
  );
}
