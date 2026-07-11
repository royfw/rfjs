"use client";

import * as React from "react";

import { formatOptionsFor, type FieldRow } from "./model";
import { FieldList } from "./field-list";
import { FieldInspector } from "./field-inspector";

export interface FieldsPanelLabels {
  key: string; labelEn: string; labelZh: string; dataType: string; format: string; formatNone: string;
  sortable: string; filterable: string; kind: string; kindNone: string; options: string;
  addField: string; addOption: string; remove: string; dupKey: string; blankKey: string;
  inspectorTitle: string; inspectorEmpty: string; fieldSummary: string;
}

export function FieldsPanel({
  rows,
  onChange,
  selectedId,
  onSelect,
  labels,
}: {
  rows: FieldRow[];
  onChange: (rows: FieldRow[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  labels: FieldsPanelLabels;
}) {
  const dupKeys = React.useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.key, (seen.get(r.key) ?? 0) + 1);
    return new Set([...seen.entries()].filter(([k, n]) => k.trim() !== "" && n > 1).map(([k]) => k));
  }, [rows]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  function patch(partial: Partial<FieldRow>) {
    if (!selected) return;
    onChange(rows.map((r) => (r.id === selected.id ? { ...r, ...partial } : r)));
  }

  function patchDataType(dataType: FieldRow["dataType"]) {
    if (!selected) return;
    // dataType 事後改 → 不相容 format 自動清掉(spec §3.4)
    const format = selected.format !== undefined && formatOptionsFor(dataType).includes(selected.format) ? selected.format : undefined;
    patch({ dataType, format });
  }

  function addField() {
    const id = crypto.randomUUID();
    onChange([...rows, { id, key: "", labelEn: "", labelZh: "", dataType: "string", sortable: false, filterable: false, options: [] }]);
    onSelect(id); // 新增自動選取(既定決策①)
  }

  function removeField(id: string) {
    if (id === selectedId) onSelect(null);
    onChange(rows.filter((r) => r.id !== id));
  }

  return (
    // 欄位清單|檢視器 並排(lg;窄幅直疊)—— 選中後不需往下捲,檢視器就在旁邊。
    <div className="grid gap-4 lg:grid-cols-[minmax(300px,5fr)_minmax(280px,4fr)]">
      <div className="min-w-0">
        <FieldList rows={rows} selectedId={selectedId} onSelect={onSelect} onRemove={removeField} onAdd={addField} dupKeys={dupKeys} labels={labels} />
      </div>
      <div className="min-w-0 rounded-md border border-dashed border-input p-3 lg:self-start">
        <FieldInspector row={selected} onPatch={patch} onPatchDataType={patchDataType} labels={labels} />
      </div>
    </div>
  );
}
