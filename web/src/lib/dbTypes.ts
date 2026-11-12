import type { DatabaseSchema, DbColumn } from "@/lib/api";

/** Column types in words a business owner understands. */
const TYPE_LABELS: Record<DbColumn["type"], string> = {
  String: "Text",
  Int: "Number",
  Float: "Number",
  Decimal: "Amount",
  Boolean: "Yes / No",
  DateTime: "Date and time",
  Json: "Extra details",
  Enum: "Choice",
};

export function typeLabel(column: DbColumn, schema?: DatabaseSchema | null) {
  if (column.type === "Enum" && column.enum && schema) {
    const values = schema.enums.find((e) => e.name === column.enum)?.values;
    if (values?.length) return `One of: ${values.map(humanize).join(", ")}`;
  }
  return TYPE_LABELS[column.type] ?? column.type;
}

/** "BOOKING_CONFIRMED" or "customerId" -> "Booking confirmed" / "Customer id". */
export function humanize(value: string) {
  const spaced = value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const RELATION_SHORT: Record<DatabaseSchema["relations"][number]["type"], string> = {
  "one-to-one": "has one",
  "one-to-many": "has many",
  "many-to-many": "many to many",
};
