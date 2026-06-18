"use client";

import { Checkbox } from "@rfjs/web-ui/components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rfjs/web-ui/components/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@rfjs/web-ui/components/tooltip";

import type { FieldSchema, FieldType } from "@rfjs/filter-builder";
import { dataTypeBadge } from "@rfjs/filter-builder-ui";

const TYPES: FieldType[] = ["string", "numeric", "date", "boolean", "object", "array"];

export interface MetadataStripLabels {
  include: string;
  type: string;
}

export function MetadataStrip({
  schema,
  onChange,
  labels,
}: {
  schema: FieldSchema[];
  onChange: (next: FieldSchema[]) => void;
  labels: MetadataStripLabels;
}) {
  function patch(path: string, p: Partial<FieldSchema>) {
    onChange(schema.map((f) => (f.path === path ? { ...f, ...p } : f)));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {schema.map((f) => (
        <div
          key={f.path}
          className="flex h-8 w-[168px] items-center gap-1.5 rounded-md border bg-card pr-1 pl-2"
        >
          <Checkbox
            aria-label={`${labels.include} ${f.path}`}
            checked={f.include}
            onCheckedChange={(c) => patch(f.path, { include: c === true })}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                {f.path}
              </span>
            </TooltipTrigger>
            <TooltipContent className="font-mono">{f.path}</TooltipContent>
          </Tooltip>
          <Select
            value={f.dataType}
            onValueChange={(v) => patch(f.path, { dataType: v as FieldType })}
          >
            <SelectTrigger
              size="sm"
              aria-label={`${labels.type} ${f.path}`}
              className={`h-[22px] w-auto shrink-0 rounded-md border-0 px-2 font-mono text-[11px] font-semibold [&>svg]:hidden ${dataTypeBadge(f.dataType)}`}
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
    </div>
  );
}
