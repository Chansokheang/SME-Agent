"use client";

import { ArrowRight, CaretDown, Database, FileSql, FileXls, Info, LockSimple, Warning } from "@phosphor-icons/react";
import { useState } from "react";
import type { DatabaseSchema, FileProfile } from "@/lib/api";

type Sheet = FileProfile["sheets"][number];

/** "file > sheet > Date + Time" -> which design fields each spreadsheet column fills. */
function fieldsBySheetColumn(schema: DatabaseSchema | null, file: string, sheet: string) {
  const map = new Map<string, string[]>();
  for (const table of schema?.tables ?? []) {
    for (const column of table.columns) {
      const parts = column.source?.split(">").map((p) => p.trim()) ?? [];
      if (parts.length < 3 || parts[0] !== file || parts[1] !== sheet) continue;
      for (const name of parts[2].split(/[+,]/).map((n) => n.trim())) {
        map.set(name, [...(map.get(name) ?? []), `${table.label || table.name} > ${column.name}`]);
      }
    }
  }
  return map;
}

/** Answers one question: what happens to the spreadsheet the owner uploaded? */
export default function DataView({ profile, schema }: { profile: FileProfile[]; schema: DatabaseSchema | null }) {
  if (profile.length === 0) {
    return (
      <div className="grid place-items-center py-16 text-center">
        <div className="max-w-sm">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Database size={28} />
          </span>
          <p className="mt-4 font-display text-lg font-bold">Nothing to import</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            The design comes from your plan. If you keep customers, bookings or products in a spreadsheet, add it
            with the paperclip below the chat and Gagesite will design around it.
          </p>
        </div>
      </div>
    );
  }

  const warnings = schema?.data_issues.filter((i) => i.severity === "warning") ?? [];
  const notes = schema?.data_issues.filter((i) => i.severity !== "warning") ?? [];

  return (
    <div className="space-y-7">
      <section>
        <h3 className="text-[13px] font-semibold">Where your spreadsheet goes</h3>
        <p className="mt-0.5 text-sm text-muted">Rows are copied into your database when the site launches.</p>
        <div className="mt-3 space-y-4">
          {profile.map((file) => (
            <div key={file.file}>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs text-faint">
                {file.kind === "sql" ? <FileSql size={14} /> : <FileXls size={14} />}
                {file.file}
              </p>
              {file.error ? (
                <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{file.error}</p>
              ) : file.kind === "sql" ? (
                <p className="rounded-2xl border border-line px-4 py-3 text-sm text-muted">
                  Database structure only. It shaped the design; there are no rows to import.
                </p>
              ) : (
                <ul className="overflow-hidden rounded-2xl border border-line">
                  {file.sheets.map((sheet) => (
                    <SheetRow key={sheet.name} file={file.file} sheet={sheet} schema={schema} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {warnings.length > 0 && (
        <section>
          <h3 className="text-[13px] font-semibold">
            Fix before import <span className="font-normal text-muted">({warnings.length})</span>
          </h3>
          <ul className="mt-2.5 space-y-2">
            {warnings.map((issue, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                <Warning size={17} weight="fill" className="mt-0.5 shrink-0 text-amber-500" />
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notes.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
            <Info size={15} className="text-accent" />
            {notes.length} note{notes.length === 1 ? "" : "s"}
            <CaretDown size={12} className="transition group-open:rotate-180" />
          </summary>
          <ul className="mt-2.5 space-y-2 pl-5">
            {notes.map((issue, i) => (
              <li key={i} className="list-disc text-sm leading-relaxed text-muted marker:text-line-strong">
                {issue.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="flex items-center gap-1.5 text-xs text-faint">
        <LockSimple size={13} />
        Gagesite only sees column names and masked samples. Your rows stay on this server until import.
      </p>
    </div>
  );
}

function SheetRow({ file, sheet, schema }: { file: string; sheet: Sheet; schema: DatabaseSchema | null }) {
  const [open, setOpen] = useState(false);
  const source = schema?.data_sources.find((s) => s.file === file && (!s.sheet || s.sheet === sheet.name));
  const target = source?.maps_to ? schema?.tables.find((t) => t.name === source.maps_to) : undefined;
  const fields = fieldsBySheetColumn(schema, file, sheet.name);

  return (
    <li className="border-b border-line last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="font-medium">{sheet.name}</span>
          <span className="ml-1.5 text-xs text-faint">{sheet.rows} rows</span>
        </span>
        <ArrowRight size={14} className="shrink-0 text-faint" />
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            target ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-muted"
          }`}
        >
          {target ? target.label || target.name : "Not imported"}
        </span>
        <CaretDown size={13} className={`shrink-0 text-faint transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4">
          {source?.notes && <p className="mb-3 text-xs leading-relaxed text-muted">{source.notes}</p>}
          <ul className="space-y-1.5">
            {sheet.columns.map((column) => {
              const goesTo = fields.get(column.name);
              const empty = 100 - Math.round(column.filled_percent);
              return (
                <li key={column.name} className="flex items-baseline gap-2 text-xs">
                  <span className="w-28 shrink-0 truncate font-medium text-ink">{column.name}</span>
                  <ArrowRight size={11} className="shrink-0 text-faint" />
                  <span className={`min-w-0 flex-1 truncate ${goesTo ? "text-accent-ink" : "text-faint"}`}>
                    {goesTo ? goesTo.join(", ") : "Not used"}
                  </span>
                  {empty >= 10 && <span className="shrink-0 text-amber-700">{empty}% empty</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}
