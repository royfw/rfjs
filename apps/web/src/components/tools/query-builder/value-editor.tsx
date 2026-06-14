"use client";

import type { OperatorArity } from "@/lib/tools/query-builder/engines/types";
import { coerceInput } from "@/lib/tools/query-builder/value-coerce";
import type { FieldType } from "@/lib/tools/query-builder/types";

function rawOf(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export function ValueEditor({
  dataType,
  arity,
  value,
  onChange,
}: {
  dataType: FieldType;
  arity: OperatorArity;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  if (arity === "none") return null;
  const placeholder =
    arity === "two" ? "min, max" : arity === "list" ? "a, b, c" : dataType;
  return (
    <input
      aria-label="value"
      value={rawOf(value)}
      placeholder={placeholder}
      onChange={(e) => onChange(coerceInput(dataType, arity, e.target.value))}
      className="min-w-0 flex-1 rounded-sm border bg-transparent px-2 py-1 font-mono text-sm"
    />
  );
}
