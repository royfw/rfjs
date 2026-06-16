"use client";

import { Panel } from "@rfjs/web-ui/components/panel";
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
        <textarea
          aria-label={t("data")}
          value={sampleText}
          onChange={(e) => onSampleChange(e.target.value)}
          spellCheck={false}
          rows={6}
          className="w-full resize-y rounded-sm border bg-transparent p-2 font-mono text-sm"
        />
        {error ? <p className="font-mono text-sm text-fault">{t(`error.${error}`)}</p> : null}
        <div className="flex flex-col gap-1">
          {schema.map((f) => (
            <div key={f.path} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={`include ${f.path}`}
                checked={f.include}
                onChange={(e) => patch(f.path, { include: e.target.checked })}
              />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{f.path}</span>
              <select
                aria-label={`type ${f.path}`}
                value={f.dataType}
                onChange={(e) => {
                  const dataType = e.target.value as FieldType;
                  patch(f.path, canBeColumn(dataType) ? { dataType } : { dataType, kind: "jsonb" });
                }}
                className="rounded-sm border bg-transparent px-1 py-0.5 text-xs"
              >
                {TYPES.map((tp) => (
                  <option key={tp} value={tp}>{tp}</option>
                ))}
              </select>
              <select
                aria-label={`kind ${f.path}`}
                value={canBeColumn(f.dataType) ? f.kind : "jsonb"}
                disabled={!canBeColumn(f.dataType)}
                onChange={(e) => patch(f.path, { kind: e.target.value as FieldKind })}
                className="rounded-sm border bg-transparent px-1 py-0.5 text-xs disabled:opacity-50"
              >
                <option value="jsonb">{t("kindJsonb")}</option>
                <option value="column">{t("kindColumn")}</option>
              </select>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            onSchemaChange(
              schema.map((f) =>
                !f.path.includes(".") && canBeColumn(f.dataType) ? { ...f, kind: "column" } : f,
              ),
            )
          }
          className="self-start rounded-sm border border-border bg-transparent px-2 py-1 text-xs"
        >
          {t("topLevelToColumns")}
        </button>
      </div>
    </Panel>
  );
}
