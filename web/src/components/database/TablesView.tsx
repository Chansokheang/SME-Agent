"use client";

import { ArrowUpRight, FileXls, Key, LinkSimple, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { FIELD_KINDS, type FieldKind, type TableChange } from "@/components/database/tableChanges";
import type { DatabaseSchema, DbTable } from "@/lib/api";
import { typeLabel } from "@/lib/dbTypes";

const INPUT =
  "min-w-0 rounded-lg border border-line-strong bg-surface px-2.5 py-1 text-sm outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft";

type Connection = { table: string; text: string };

/** How one table relates to the others, phrased from that table's point of view. */
function connectionsOf(table: DbTable, schema: DatabaseSchema, labelOf: (name: string) => string): Connection[] {
  const result: Connection[] = [];
  for (const r of schema.relations) {
    if (r.type === "many-to-many" && (r.from_table === table.name || r.to_table === table.name)) {
      const other = r.from_table === table.name ? r.to_table : r.from_table;
      result.push({ table: other, text: `Linked with ${labelOf(other)}` });
    } else if (r.from_table === table.name) {
      result.push({ table: r.to_table, text: `${r.type === "one-to-one" ? "Has one" : "Has many"} ${labelOf(r.to_table)}` });
    } else if (r.to_table === table.name) {
      result.push({ table: r.from_table, text: `Belongs to ${labelOf(r.from_table)}` });
    }
  }
  return result;
}

/**
 * List of tables on the left, the selected table's fields on the right. When `onQueue` is given,
 * the owner can queue small edits (rename, add, remove, required); Gagesite applies them together.
 */
export default function TablesView({
  schema,
  changes = [],
  onQueue,
  onUndo,
}: {
  schema: DatabaseSchema;
  changes?: TableChange[];
  onQueue?: (change: TableChange) => void;
  onUndo?: (change: TableChange) => void;
}) {
  const [selected, setSelected] = useState(schema.tables[0]?.name);
  const [renaming, setRenaming] = useState<string | null>(null); // field name, or "" for the table
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const reduce = useReducedMotion();
  const labelOf = (name: string) => schema.tables.find((t) => t.name === name)?.label || name;
  const table = schema.tables.find((t) => t.name === selected) ?? schema.tables[0];
  if (!table) return null;

  const connections = connectionsOf(table, schema, labelOf);
  const imported = table.columns.filter((c) => c.source).length;
  const mine = changes.filter((c) => c.table === table.name);
  const pendingFor = (field: string) => mine.filter((c) => "field" in c && c.field === field);
  const tableLabel = mine.find((c): c is Extract<TableChange, { kind: "rename-table" }> => c.kind === "rename-table")?.label;
  const added = mine.filter((c): c is Extract<TableChange, { kind: "add-field" }> => c.kind === "add-field");
  const startRename = (field: string, current: string) => {
    setRenaming(field);
    setDraft(current);
  };
  const finishRename = () => {
    const to = draft.trim();
    if (renaming === "" && to && to !== (table.label || table.name))
      onQueue?.({ kind: "rename-table", table: table.name, label: to });
    if (renaming && to && to !== renaming) onQueue?.({ kind: "rename-field", table: table.name, field: renaming, to });
    setRenaming(null);
  };

  return (
    <div className="@container">
      <div className="grid gap-5 @2xl:grid-cols-[200px_minmax(0,1fr)] @2xl:gap-6">
        {/* Table list: a column on desktop, scrollable pills on small screens. */}
        <nav aria-label="Tables" className="-mx-1 overflow-x-auto @2xl:mx-0 @2xl:overflow-visible @2xl:border-r @2xl:border-line @2xl:pr-4">
          <ul className="flex gap-1 px-1 @2xl:flex-col @2xl:px-0">
            {schema.tables.map((t) => {
              const active = t.name === table.name;
              return (
                <li key={t.name} className="shrink-0">
                  <button
                    onClick={() => setSelected(t.name)}
                    aria-current={active ? "true" : undefined}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                      active ? "bg-accent-soft" : "hover:bg-surface-2"
                    }`}
                  >
                    <span className={`block whitespace-nowrap text-sm font-medium leading-snug @2xl:whitespace-normal ${active ? "text-accent-ink" : ""}`}>
                      {t.label || t.name}
                    </span>
                    <span className="block text-xs text-faint">{t.columns.length} fields</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <AnimatePresence mode="wait">
          <motion.section
            key={table.name}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="min-w-0"
          >
            <header>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {renaming === "" ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={finishRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") finishRename();
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    aria-label="New name for this list"
                    className={`${INPUT} font-display text-lg font-bold`}
                  />
                ) : (
                  <h3 className="font-display text-xl font-bold tracking-tight">
                    {tableLabel ? (
                      <>
                        <span className="text-faint line-through decoration-1">{table.label || table.name}</span>{" "}
                        <span className="text-accent-ink">{tableLabel}</span>
                      </>
                    ) : (
                      table.label || table.name
                    )}
                  </h3>
                )}
                <span className="font-mono text-xs text-faint">{table.name}</span>
                {onQueue && renaming !== "" && (
                  <button
                    onClick={() => startRename("", tableLabel ?? (table.label || table.name))}
                    aria-label="Rename this list"
                    title="Rename this list"
                    className="grid size-6 place-items-center rounded-md text-faint transition hover:bg-surface-2 hover:text-accent-ink"
                  >
                    <PencilSimple size={13} />
                  </button>
                )}
              </div>
              {table.description && <p className="mt-1 text-sm leading-relaxed text-muted">{table.description}</p>}
            </header>

            {connections.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {connections.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setSelected(c.table)}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-accent hover:text-accent-ink"
                  >
                    <LinkSimple size={12} weight="bold" className="text-accent" />
                    {c.text}
                    <ArrowUpRight size={11} className="opacity-0 transition group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}

            {/* Columns size from this area, not the whole panel. */}
            <div className="@container mt-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-b border-line pb-2 text-xs font-medium text-faint @md:grid-cols-[minmax(7.5rem,11rem)_7rem_minmax(0,1fr)]">
                <span>Field</span>
                <span>Type</span>
                <span className="hidden @md:block">Notes</span>
              </div>
              <ul>
                {table.columns.map((column) => {
                  const pending = pendingFor(column.name);
                  const removed = pending.some((c) => c.kind === "remove-field");
                  const renamedTo = pending.find(
                    (c): c is Extract<TableChange, { kind: "rename-field" }> => c.kind === "rename-field",
                  )?.to;
                  const requiredChange = pending.find(
                    (c): c is Extract<TableChange, { kind: "required" }> => c.kind === "required",
                  );
                  const required = requiredChange ? requiredChange.required : column.required;
                  // The identifier and links hold the design together: those stay as Gagesite made them.
                  const locked = column.primary || !!column.references;
                  return (
                    <li
                      key={column.name}
                      className={`group relative grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-line py-2.5 text-sm last:border-b-0 @md:grid-cols-[minmax(7.5rem,11rem)_7rem_minmax(0,1fr)] ${
                        removed ? "opacity-50" : ""
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        {column.primary ? (
                          <Key size={13} weight="fill" className="shrink-0 text-accent" aria-label="Identifier" />
                        ) : column.references ? (
                          <LinkSimple size={13} weight="bold" className="shrink-0 text-accent" aria-label="Link" />
                        ) : (
                          <span className="w-[13px] shrink-0" />
                        )}
                        {renaming === column.name ? (
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={finishRename}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") finishRename();
                              if (e.key === "Escape") setRenaming(null);
                            }}
                            aria-label={`New name for ${column.name}`}
                            className={`${INPUT} w-36`}
                          />
                        ) : (
                          <span className={`break-all font-medium ${removed ? "line-through" : ""}`}>
                            {renamedTo ? (
                              <>
                                <span className="text-faint line-through decoration-1">{column.name}</span>{" "}
                                <span className="text-accent-ink">{renamedTo}</span>
                              </>
                            ) : (
                              column.name
                            )}
                          </span>
                        )}
                        {column.source && (
                          <FileXls
                            size={13}
                            weight="fill"
                            className="shrink-0 text-accent/70"
                            aria-label={`Filled from ${column.source}`}
                          >
                            <title>{`Filled from ${column.source}`}</title>
                          </FileXls>
                        )}
                      </span>
                      <span className="text-xs text-muted">
                        {typeLabel(column, schema)}
                        {!required && <span className={requiredChange ? "text-accent-ink" : "text-faint"}>, optional</span>}
                        {required && requiredChange && <span className="text-accent-ink">, required</span>}
                      </span>
                      <span className="col-span-2 pl-[19px] text-xs leading-relaxed text-muted @md:col-span-1 @md:pl-0">
                        {column.references ? `Links to ${labelOf(column.references.table)}. ` : ""}
                        {column.description}
                      </span>
                      {onQueue && !locked && renaming !== column.name && (
                        <span className="absolute right-0 top-1.5 flex items-center gap-0.5 rounded-lg bg-surface p-0.5 opacity-0 shadow-[0_0_0_1px_var(--color-line)] transition focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:static [@media(hover:none)]:col-span-full [@media(hover:none)]:mt-1 [@media(hover:none)]:w-fit [@media(hover:none)]:opacity-100">
                          {removed ? (
                            <button
                              onClick={() => pending.filter((c) => c.kind === "remove-field").forEach((c) => onUndo?.(c))}
                              className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink"
                            >
                              Keep it
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => startRename(column.name, renamedTo ?? column.name)}
                                className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink"
                              >
                                Rename
                              </button>
                              <button
                                onClick={() =>
                                  // Back to how Gagesite drew it: drop the change instead of queueing a no-op.
                                  requiredChange && !required === column.required
                                    ? onUndo?.(requiredChange)
                                    : onQueue({ kind: "required", table: table.name, field: column.name, required: !required })
                                }
                                className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink"
                              >
                                {required ? "Make optional" : "Make required"}
                              </button>
                              <button
                                onClick={() => onQueue({ kind: "remove-field", table: table.name, field: column.name })}
                                aria-label={`Remove ${column.name}`}
                                className="grid size-6 place-items-center rounded-md text-faint hover:bg-danger-soft hover:text-danger"
                              >
                                <Trash size={13} />
                              </button>
                            </>
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
                {added.map((c) => (
                  <li
                    key={c.name}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-line bg-accent-soft/40 py-2.5 text-sm last:border-b-0 @md:grid-cols-[minmax(7.5rem,11rem)_7rem_minmax(0,1fr)]"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 pl-[19px]">
                      <span className="break-all font-medium text-accent-ink">{c.name}</span>
                      <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white">new</span>
                    </span>
                    <span className="text-xs text-muted">
                      {FIELD_KINDS.find((k) => k.key === c.type)?.label}
                      {!c.required && <span className="text-faint">, optional</span>}
                    </span>
                    <span className="col-span-2 pl-[19px] text-xs leading-relaxed text-muted @md:col-span-1 @md:pl-0">
                      {c.note}
                    </span>
                  </li>
                ))}
              </ul>
              {onQueue &&
                (adding ? (
                  <AddField
                    onCancel={() => setAdding(false)}
                    onAdd={(field) => {
                      onQueue({ kind: "add-field", table: table.name, ...field });
                      setAdding(false);
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setAdding(true)}
                    className="mt-2 inline-flex items-center gap-1 rounded-md px-1 py-1 text-xs font-semibold text-accent-ink hover:underline"
                  >
                    <Plus size={12} weight="bold" />
                    Add a field
                  </button>
                ))}
            </div>

            {imported > 0 && (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-faint">
                <FileXls size={13} weight="fill" className="text-accent/70" />
                {imported} of {table.columns.length} fields are filled from your spreadsheet. Hover the icon to see which column.
              </p>
            )}
          </motion.section>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** A small form for one new field: its name in the owner's words, its kind, and whether it's needed. */
function AddField({
  onAdd,
  onCancel,
}: {
  onAdd: (field: { name: string; type: FieldKind; required: boolean; note: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldKind>("text");
  const [required, setRequired] = useState(false);
  const [note, setNote] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onAdd({ name: name.trim(), type, required, note: note.trim() });
      }}
      className="mt-3 rounded-xl bg-surface-2/60 p-3 ring-1 ring-line"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Field name, e.g. allergy notes"
          aria-label="Field name"
          className={`${INPUT} flex-1`}
        />
        <select value={type} onChange={(e) => setType(e.target.value as FieldKind)} aria-label="Kind of field" className={INPUT}>
          {FIELD_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          Required
        </label>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What is it for? (optional)"
        aria-label="What the field is for"
        className={`${INPUT} mt-2 w-full`}
      />
      <div className="mt-2.5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-muted hover:bg-surface-2"
        >
          <X size={12} weight="bold" />
          Cancel
        </button>
        <button
          disabled={!name.trim()}
          className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:bg-line-strong"
        >
          Add to changes
        </button>
      </div>
    </form>
  );
}
