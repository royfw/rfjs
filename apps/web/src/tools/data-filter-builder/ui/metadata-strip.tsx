"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { Checkbox } from "@rfjs/web-ui/components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rfjs/web-ui/components/select";

import type { FieldSchema, FieldType } from "@rfjs/filter-builder";

const TYPES: FieldType[] = ["string", "numeric", "date", "boolean", "object", "array"];

export interface MetadataStripLabels {
  fields: string;
  infer: string;
  include: string;
  type: string;
}

export function MetadataStrip({
  schema,
  onChange,
  onInfer,
  labels,
}: {
  schema: FieldSchema[];
  onChange: (next: FieldSchema[]) => void;
  onInfer: () => void;
  labels: MetadataStripLabels;
}) {
  function patch(path: string, p: Partial<FieldSchema>) {
    onChange(schema.map((f) => (f.path === path ? { ...f, ...p } : f)));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        {labels.fields}
      </span>
      {schema.map((f) => (
        <div
          key={f.path}
          className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1"
        >
          <Checkbox
            aria-label={`${labels.include} ${f.path}`}
            checked={f.include}
            onCheckedChange={(c) => patch(f.path, { include: c === true })}
          />
          <span className="max-w-[7rem] truncate font-mono text-xs text-foreground">{f.path}</span>
          <Select
            value={f.dataType}
            onValueChange={(v) => patch(f.path, { dataType: v as FieldType })}
          >
            <SelectTrigger
              size="sm"
              aria-label={`${labels.type} ${f.path}`}
              className="h-6 w-auto gap-1 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((tp) => (
                <SelectItem key={tp} value={tp} className="text-xs">
                  {tp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <Button type="button" variant="ghost" size="xs" onClick={onInfer} className="font-mono">
        {labels.infer}
      </Button>
    </div>
  );
}
