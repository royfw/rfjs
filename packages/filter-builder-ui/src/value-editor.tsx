"use client";

import { Input } from "@rfjs/web-ui/components/input";

import { coerceInput } from "@rfjs/filter-builder";
import type { OperatorArity, FieldType } from "@rfjs/filter-builder";

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
    <Input
      aria-label="value"
      value={rawOf(value)}
      placeholder={placeholder}
      onChange={(e) => onChange(coerceInput(dataType, arity, e.target.value))}
      className="h-8 w-full min-w-0 font-mono"
    />
  );
}
