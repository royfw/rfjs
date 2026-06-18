"use client";

import { useState } from "react";

import { Input } from "@rfjs/web-ui/components/input";
import { X } from "lucide-react";

import { coerceInput } from "@rfjs/filter-builder";
import type { OperatorArity, FieldType } from "@rfjs/filter-builder";

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
}: {
  dataType: FieldType;
  value: unknown;
  onChange: (next: unknown) => void;
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
        <span
          key={`${String(it)}-${i}`}
          className="inline-flex items-center gap-1 rounded-sm bg-muted py-0.5 pr-1 pl-1.5 font-mono text-xs"
        >
          {String(it)}
          <button
            type="button"
            aria-label={`remove ${String(it)}`}
            onClick={() => removeAt(i)}
            className="text-muted-foreground hover:text-fault"
          >
            <X className="size-3" />
          </button>
        </span>
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
        placeholder={items.length === 0 ? dataType : ""}
        className="min-w-[3rem] flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
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
  if (arity === "list") return <TagsInput dataType={dataType} value={value} onChange={onChange} />;
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
