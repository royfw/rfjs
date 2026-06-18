"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { Checkbox } from "@rfjs/web-ui/components/checkbox";
import { Panel } from "@rfjs/web-ui/components/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rfjs/web-ui/components/select";
import { Textarea } from "@rfjs/web-ui/components/textarea";
import { useTranslations } from "next-intl";

import { canBeColumn } from "@rfjs/filter-builder";
import type { FieldKind, FieldSchema, FieldType } from "@rfjs/filter-builder";

const TYPES: FieldType[] = ["string", "numeric", "date", "boolean", "object", "array"];

export function SchemaPanel({
  sampleText,
  schema,
  error,
  onSampleChange,
  onSchemaChange,
}: {
  sampleText: string;
  schema: FieldSchema[];
  error: string | null;
  onSampleChange: (text: string) => void;
  onSchemaChange: (next: FieldSchema[]) => void;
}) {
  const t = useTranslations("ToolUI");

  function patch(path: string, p: Partial<FieldSchema>) {
    onSchemaChange(schema.map((f) => (f.path === path ? { ...f, ...p } : f)));
  }

  return (
    <Panel title={t("data")}>
      <div className="flex flex-col gap-3">
        <Textarea
          aria-label={t("data")}
          value={sampleText}
          onChange={(e) => onSampleChange(e.target.value)}
          spellCheck={false}
          rows={6}
          className="resize-y font-mono"
        />
        {error ? <p className="font-mono text-sm text-fault">{t(`error.${error}`)}</p> : null}
        <div className="flex flex-col gap-1">
          {schema.map((f) => (
            <div key={f.path} className="flex items-center gap-2 text-sm">
              <Checkbox
                aria-label={`include ${f.path}`}
                checked={f.include}
                onCheckedChange={(c) => patch(f.path, { include: c === true })}
              />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{f.path}</span>
              <Select
                value={f.dataType}
                onValueChange={(v) => {
                  const dataType = v as FieldType;
                  patch(f.path, canBeColumn(dataType) ? { dataType } : { dataType, kind: "jsonb" });
                }}
              >
                <SelectTrigger size="sm" aria-label={`type ${f.path}`} className="h-7 w-auto text-xs">
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
              <Select
                value={canBeColumn(f.dataType) ? f.kind : "jsonb"}
                disabled={!canBeColumn(f.dataType)}
                onValueChange={(v) => patch(f.path, { kind: v as FieldKind })}
              >
                <SelectTrigger size="sm" aria-label={`kind ${f.path}`} className="h-7 w-auto text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jsonb" className="text-xs">
                    {t("kindJsonb")}
                  </SelectItem>
                  <SelectItem value="column" className="text-xs">
                    {t("kindColumn")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() =>
            onSchemaChange(
              schema.map((f) =>
                !f.path.includes(".") && canBeColumn(f.dataType) ? { ...f, kind: "column" } : f,
              ),
            )
          }
          className="self-start"
        >
          {t("topLevelToColumns")}
        </Button>
      </div>
    </Panel>
  );
}
