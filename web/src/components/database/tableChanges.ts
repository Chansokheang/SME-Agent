import type { DatabaseSchema } from "@/lib/api";

/** Kinds of field an owner can add, in their words, with the type Gagesite should use. */
export const FIELD_KINDS = [
  { key: "text", label: "Text", type: "String" },
  { key: "number", label: "Number", type: "Int" },
  { key: "money", label: "Money", type: "Decimal" },
  { key: "yesno", label: "Yes / No", type: "Boolean" },
  { key: "datetime", label: "Date and time", type: "DateTime" },
] as const;
export type FieldKind = (typeof FIELD_KINDS)[number]["key"];

/** One small edit the owner queued on the drafted design, applied later by Gagesite. */
export type TableChange =
  | { kind: "rename-table"; table: string; label: string }
  | { kind: "rename-field"; table: string; field: string; to: string }
  | { kind: "remove-field"; table: string; field: string }
  | { kind: "required"; table: string; field: string; required: boolean }
  | { kind: "add-field"; table: string; name: string; type: FieldKind; required: boolean; note: string };

export function changeKey(c: TableChange) {
  return c.kind === "add-field"
    ? `add:${c.table}:${c.name}`
    : c.kind === "rename-table"
      ? `table:${c.table}`
      : `${c.kind}:${c.table}:${c.field}`;
}

/** Add a change, replacing an earlier one about the same thing (the latest wins). */
export function queueChange(changes: TableChange[], next: TableChange) {
  const key = changeKey(next);
  // Removing a field makes any other pending edit to it pointless.
  const rest = changes.filter(
    (c) =>
      changeKey(c) !== key && !(next.kind === "remove-field" && "field" in c && c.table === next.table && c.field === next.field),
  );
  return [...rest, next];
}

function tableName(schema: DatabaseSchema | null, table: string) {
  const label = schema?.tables.find((t) => t.name === table)?.label;
  return label && label !== table ? `${label} (${table})` : table;
}

/** One line per change, in plain words: shown in the tray and sent to Gagesite. */
export function describeChange(c: TableChange, schema: DatabaseSchema | null) {
  const t = tableName(schema, c.table);
  switch (c.kind) {
    case "rename-table":
      return `${t}: call this list "${c.label}"`;
    case "rename-field":
      return `${t}: rename the field "${c.field}" to "${c.to}"`;
    case "remove-field":
      return `${t}: remove the field "${c.field}"`;
    case "required":
      return `${t}: make the field "${c.field}" ${c.required ? "required" : "optional"}`;
    case "add-field": {
      const kind = FIELD_KINDS.find((k) => k.key === c.type);
      return `${t}: add ${c.required ? "a required" : "an optional"} field "${c.name}" (${kind?.label.toLowerCase()}, ${kind?.type})${
        c.note ? `: ${c.note}` : ""
      }`;
    }
  }
}

/** The single request that applies every queued change. */
export function changesMessage(changes: TableChange[], schema: DatabaseSchema | null) {
  return (
    "Please make these changes to the database design and keep everything else the same. " +
    "Update the diagram file and the Prisma file together, use camelCase for new field names, " +
    "and tell me if a change affects something else (for example a link or my imported data):\n\n" +
    changes.map((c, i) => `${i + 1}. ${describeChange(c, schema)}`).join("\n")
  );
}
