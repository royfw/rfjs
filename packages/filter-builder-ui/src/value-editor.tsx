"use client";

import { useState } from "react";

import { Badge } from "@rfjs/web-ui/components/badge";
import { Input } from "@rfjs/web-ui/components/input";
import { X } from "lucide-react";

import { coerceInput } from "@rfjs/filter-builder";
import type { OperatorArity, FieldType } from "@rfjs/filter-builder";

import { dataTypeBadge } from "./colors";

function rawOf(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function toItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

/** Multi-value tag input for list-arity operators (terms, contains, …): type a
 * value and press Enter (or comma) to add a chip; each chip is one array item. */
function TagsInput({
  dataType,
  value,
  onChange,
  hint,
}: {
  dataType: FieldType;
  value: unknown;
  onChange: (next: unknown) => void;
  hint?: string;
}) {
  const items = toItems(value);
  const [draft, setDraft] = useState("");

  function commit() {
    const t = draft.trim();
    if (t === "") return;
    onChange([...items, coerceInput(dataType, "one", t)]);
    setDraft("");
  }
  function removeAt(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex min-h-8 w-full min-w-0 flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-1.5 py-1 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      {items.map((it, i) => (
        <Badge
          key={`${String(it)}-${i}`}
          variant="secondary"
          className={`gap-1 py-0.5 pr-1 pl-1.5 font-mono ${dataTypeBadge(dataType)}`}
        >
          {String(it)}
          <button
            type="button"
            aria-label={`remove ${String(it)}`}
            onClick={() => removeAt(i)}
            className="opacity-70 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        aria-label="value"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && draft === "" && items.length > 0) {
            removeAt(items.length - 1);
          }
        }}
        onBlur={commit}
        placeholder={items.length === 0 ? (hint ?? dataType) : ""}
        className="min-w-[5rem] flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

export function ValueEditor({
  dataType,
  arity,
  value,
  onChange,
  hint,
}: {
  dataType: FieldType;
  arity: OperatorArity;
  value: unknown;
  onChange: (next: unknown) => void;
  hint?: string;
}) {
  if (arity === "none") return null;
  if (arity === "list")
    return <TagsInput dataType={dataType} value={value} onChange={onChange} hint={hint} />;
  const placeholder = arity === "two" ? "min, max" : dataType;
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
