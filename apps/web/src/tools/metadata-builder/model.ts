import type { DataFieldMeta, DataResourceMeta, FieldFormat, LocalizedLabel } from "@rfjs/data-schema";

// Edit-model projection (design spec §3.1/§6): `meta` is the single source of truth; rows carry a
// UI-only `id` and split the LocalizedLabel into en/zh-TW inputs (other locale keys ride along in
// `labelRest` untouched — spec §3.2's preservation rule).

export interface OptionRow {
  id: string;
  value: string;
  labelEn: string;
  labelZh: string;
  labelRest?: Record<string, string>;
}

export interface FieldRow {
  id: string;
  key: string;
  labelEn: string;
  labelZh: string;
  labelRest?: Record<string, string>;
  dataType: "string" | "numeric" | "date" | "boolean";
  format?: FieldFormat;
  sortable: boolean;
  filterable: boolean;
  kind?: "column" | "jsonb";
  options: OptionRow[];
}

const ZH = "zh-TW";

export function labelToInputs(label: LocalizedLabel | undefined): { en: string; zh: string; rest?: Record<string, string> } {
  if (label === undefined) return { en: "", zh: "", rest: undefined };
  if (typeof label === "string") return { en: label, zh: "", rest: undefined };
  const { en = "", [ZH]: zh = "", ...rest } = label;
  return { en, zh, rest: Object.keys(rest).length > 0 ? rest : undefined };
}

export function inputsToLabel(en: string, zh: string, rest?: Record<string, string>): LocalizedLabel {
  const hasRest = rest !== undefined && Object.keys(rest).length > 0;
  if (!hasRest) {
    if (en && zh && en !== zh) return { en, [ZH]: zh };
    return en || zh; // 單欄或同值 → 字串
  }
  const out: Record<string, string> = { ...rest };
  if (en) out.en = en;
  if (zh) out[ZH] = zh;
  return out;
}

const NUMERIC_FORMATS: FieldFormat[] = ["integer", "decimal", "percent", "currency"];
const DATE_FORMATS: FieldFormat[] = ["date", "datetime", "time"];

export function formatOptionsFor(dataType: FieldRow["dataType"]): FieldFormat[] {
  return dataType === "numeric" ? NUMERIC_FORMATS : dataType === "date" ? DATE_FORMATS : [];
}

export function metaToRows(fields: DataFieldMeta[], makeId: () => string): FieldRow[] {
  return fields.map((f) => {
    const label = labelToInputs(f.label);
    return {
      id: makeId(),
      key: f.key,
      labelEn: label.en,
      labelZh: label.zh,
      labelRest: label.rest,
      dataType: f.dataType,
      format: f.format,
      sortable: f.sortable ?? false,
      filterable: f.filterable ?? false,
      kind: f.kind,
      options: (f.options ?? []).map((o) => {
        const ol = labelToInputs(o.label);
        return { id: makeId(), value: String(o.value), labelEn: ol.en, labelZh: ol.zh, labelRest: ol.rest };
      }),
    };
  });
}

export function rowsToMeta(rows: FieldRow[]): DataFieldMeta[] {
  return rows
    .filter((r) => r.key.trim().length > 0)
    .map((r) => {
      const field: DataFieldMeta = {
        key: r.key,
        label: inputsToLabel(r.labelEn, r.labelZh, r.labelRest),
        dataType: r.dataType,
      };
      if (r.format !== undefined) field.format = r.format;
      if (r.options.length > 0) {
        // v1 known limitation (plan Task 1 Interfaces): option value is always stored as a string
        field.options = r.options.map((o) => ({ value: o.value, label: inputsToLabel(o.labelEn, o.labelZh, o.labelRest) }));
      }
      if (r.sortable) field.sortable = true;
      if (r.filterable) field.filterable = true;
      if (r.kind !== undefined) field.kind = r.kind;
      return field;
    });
}

/** 預設樣本 —— 與 table-builder 工具的 SAMPLE_META 同形但獨立定義(紅線:不 import 該目錄)。 */
export const DEFAULT_META: DataResourceMeta = {
  fields: [
    { key: "id", label: "ID", dataType: "string", sortable: true, kind: "column" },
    { key: "title", label: "Title", dataType: "string", sortable: true, filterable: true, kind: "column" },
    { key: "price", label: { en: "Price", "zh-TW": "價格" }, dataType: "numeric", format: "currency", sortable: true, filterable: true, kind: "column" },
    { key: "createdAt", label: "Created", dataType: "date", format: "date", sortable: true },
    { key: "inStock", label: "In stock", dataType: "boolean" },
    { key: "author.name", label: "Author", dataType: "string", sortable: true, filterable: true, kind: "jsonb" },
    {
      key: "status",
      label: "Status",
      dataType: "string",
      filterable: true,
      kind: "column",
      options: [
        { value: "draft", label: "Draft" },
        { value: "published", label: "Published" },
        { value: "archived", label: "Archived" },
      ],
    },
  ],
  request: {
    endpoint: "/api/query/sample",
    method: "POST",
    pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" },
    sort: { style: "single", param: "sort", encoding: "colon" },
    filter: { style: "pg", param: "filter" },
  },
  response: { rowsPath: "data.items", totalPath: "data.total", cursorPath: "data.nextCursor" },
};
