"use client";

import * as React from "react";

import { Button } from "@rfjs/web-ui/components/button";

import { formatOptionsFor, type FieldRow, type OptionRow } from "./model";

export interface FieldsPanelLabels {
  key: string; labelEn: string; labelZh: string; dataType: string; format: string; formatNone: string;
  sortable: string; filterable: string; kind: string; kindNone: string; options: string;
  addField: string; addOption: string; remove: string; dupKey: string; blankKey: string;
}

const DATA_TYPES: FieldRow["dataType"][] = ["string", "numeric", "date", "boolean"];
const KINDS: NonNullable<FieldRow["kind"]>[] = ["column", "jsonb"];

const inputClass = "h-7 rounded-md border border-input bg-transparent px-1.5 text-xs";
const selectClass = "h-7 rounded-md border border-input bg-transparent px-1.5 text-xs";

export function FieldsPanel({
  rows,
  onChange,
  labels,
}: {
  rows: FieldRow[];
  onChange: (rows: FieldRow[]) => void;
  labels: FieldsPanelLabels;
}) {
  const [openOptions, setOpenOptions] = React.useState<string | null>(null);

  const dupKeys = React.useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.key, (seen.get(r.key) ?? 0) + 1);
    return new Set([...seen.entries()].filter(([k, n]) => k.trim() !== "" && n > 1).map(([k]) => k));
  }, [rows]);

  function patch(id: string, partial: Partial<FieldRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...partial } : r)));
  }

  function patchDataType(row: FieldRow, dataType: FieldRow["dataType"]) {
    // dataType 事後改 → 不相容 format 自動清掉(spec §3.4)
    const format = row.format !== undefined && formatOptionsFor(dataType).includes(row.format) ? row.format : undefined;
    patch(row.id, { dataType, format });
  }

  function removeField(id: string) {
    setOpenOptions((o) => (o === id ? null : o));
    onChange(rows.filter((r) => r.id !== id));
  }

  function addField() {
    onChange([
      ...rows,
      { id: crypto.randomUUID(), key: "", labelEn: "", labelZh: "", dataType: "string", sortable: false, filterable: false, options: [] },
    ]);
  }

  function patchOption(row: FieldRow, optionId: string, partial: Partial<OptionRow>) {
    patch(row.id, { options: row.options.map((o) => (o.id === optionId ? { ...o, ...partial } : o)) });
  }

  function removeOption(row: FieldRow, optionId: string) {
    patch(row.id, { options: row.options.filter((o) => o.id !== optionId) });
  }

  function addOption(row: FieldRow) {
    patch(row.id, { options: [...row.options, { id: crypto.randomUUID(), value: "", labelEn: "", labelZh: "" }] });
  }

  return (
    <div className="flex flex-col gap-2">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="pb-1 pr-2 font-medium">{labels.key}</th>
            <th className="pb-1 pr-2 font-medium">{labels.labelEn}</th>
            <th className="pb-1 pr-2 font-medium">{labels.labelZh}</th>
            <th className="pb-1 pr-2 font-medium">{labels.dataType}</th>
            <th className="pb-1 pr-2 font-medium">{labels.format}</th>
            <th className="pb-1 pr-2 font-medium">{labels.sortable}</th>
            <th className="pb-1 pr-2 font-medium">{labels.filterable}</th>
            <th className="pb-1 pr-2 font-medium">{labels.kind}</th>
            <th className="pb-1 pr-2 font-medium">{labels.options}</th>
            <th className="pb-1 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const formatOptions = formatOptionsFor(r.dataType);
            const keyInvalid = r.key.trim() === "";
            const keyDup = dupKeys.has(r.key);
            return (
              <React.Fragment key={r.id}>
                <tr className="align-top">
                  <td className="pb-1 pr-2">
                    <input
                      type="text"
                      value={r.key}
                      onChange={(e) => patch(r.id, { key: e.target.value })}
                      className={`${inputClass} w-24 font-mono`}
                      aria-label={labels.key}
                    />
                    {keyInvalid && <div className="mt-0.5 text-[10px] text-destructive">{labels.blankKey}</div>}
                    {!keyInvalid && keyDup && <div className="mt-0.5 text-[10px] text-destructive">{labels.dupKey}</div>}
                  </td>
                  <td className="pb-1 pr-2">
                    <input
                      type="text"
                      value={r.labelEn}
                      onChange={(e) => patch(r.id, { labelEn: e.target.value })}
                      className={`${inputClass} w-24`}
                      aria-label={labels.labelEn}
                    />
                  </td>
                  <td className="pb-1 pr-2">
                    <input
                      type="text"
                      value={r.labelZh}
                      onChange={(e) => patch(r.id, { labelZh: e.target.value })}
                      className={`${inputClass} w-24`}
                      aria-label={labels.labelZh}
                    />
                  </td>
                  <td className="pb-1 pr-2">
                    <select
                      value={r.dataType}
                      onChange={(e) => patchDataType(r, e.target.value as FieldRow["dataType"])}
                      className={selectClass}
                      aria-label={labels.dataType}
                    >
                      {DATA_TYPES.map((dt) => (
                        <option key={dt} value={dt}>
                          {dt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="pb-1 pr-2">
                    <select
                      value={r.format ?? ""}
                      onChange={(e) => patch(r.id, { format: e.target.value === "" ? undefined : (e.target.value as FieldRow["format"]) })}
                      disabled={formatOptions.length === 0}
                      className={selectClass}
                      aria-label={labels.format}
                    >
                      <option value="">{labels.formatNone}</option>
                      {formatOptions.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="pb-1 pr-2">
                    <input
                      type="checkbox"
                      checked={r.sortable}
                      onChange={(e) => patch(r.id, { sortable: e.target.checked })}
                      aria-label={labels.sortable}
                    />
                  </td>
                  <td className="pb-1 pr-2">
                    <input
                      type="checkbox"
                      checked={r.filterable}
                      onChange={(e) => patch(r.id, { filterable: e.target.checked })}
                      aria-label={labels.filterable}
                    />
                  </td>
                  <td className="pb-1 pr-2">
                    <select
                      value={r.kind ?? ""}
                      onChange={(e) => patch(r.id, { kind: e.target.value === "" ? undefined : (e.target.value as FieldRow["kind"]) })}
                      className={selectClass}
                      aria-label={labels.kind}
                    >
                      <option value="">{labels.kindNone}</option>
                      {KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="pb-1 pr-2">
                    <Button
                      type="button"
                      size="xs"
                      variant={openOptions === r.id ? "default" : "outline"}
                      onClick={() => setOpenOptions((open) => (open === r.id ? null : r.id))}
                      aria-label={`${labels.options} (${r.options.length})`}
                    >
                      {r.options.length}
                    </Button>
                  </td>
                  <td className="pb-1">
                    <button
                      type="button"
                      onClick={() => removeField(r.id)}
                      aria-label={labels.remove}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
                {openOptions === r.id && (
                  <tr>
                    <td colSpan={10} className="pb-2">
                      <div data-testid="options-editor" className="ml-6 rounded-md border border-dashed border-input bg-muted/30 p-2">
                        {r.options.map((o) => (
                          <div key={o.id} className="flex items-center gap-2 py-0.5">
                            <input
                              type="text"
                              value={o.value}
                              onChange={(e) => patchOption(r, o.id, { value: e.target.value })}
                              className={`${inputClass} w-24 font-mono`}
                              aria-label={`${labels.options} ${r.key} value`}
                            />
                            <input
                              type="text"
                              value={o.labelEn}
                              onChange={(e) => patchOption(r, o.id, { labelEn: e.target.value })}
                              className={`${inputClass} w-24`}
                              aria-label={`${labels.options} ${r.key} ${labels.labelEn}`}
                            />
                            <input
                              type="text"
                              value={o.labelZh}
                              onChange={(e) => patchOption(r, o.id, { labelZh: e.target.value })}
                              className={`${inputClass} w-24`}
                              aria-label={`${labels.options} ${r.key} ${labels.labelZh}`}
                            />
                            <button
                              type="button"
                              onClick={() => removeOption(r, o.id)}
                              aria-label={labels.remove}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <Button type="button" size="xs" variant="outline" onClick={() => addOption(r)}>
                          {labels.addOption}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <div>
        <Button type="button" size="sm" variant="outline" onClick={addField}>
          {labels.addField}
        </Button>
      </div>
    </div>
  );
}
