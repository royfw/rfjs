"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { parseDataResourceMeta } from "@rfjs/data-schema";
import type { DataFieldMeta, DataResourceMeta } from "@rfjs/data-schema";

import { DEFAULT_META, metaToRows, rowsToMeta, type FieldRow } from "./model";
import { FieldsPanel, type FieldsPanelLabels } from "./fields-panel";
import { ProtocolPanel, type ProtocolPanelLabels } from "./protocol-panel";
import { ImportPanel, type ImportPanelLabels } from "./import-panel";
import { DerivedPreview, type DerivedPreviewLabels } from "./derived-preview";

const STORAGE_KEY = "rfjs.metadata-builder.meta";

type Tab = "fields" | "protocol" | "import";

// Assembly shell (design spec §B-layout): eyebrow → segmented tabs (#239 pattern) → current
// editor panel → an always-on <DerivedPreview>. `meta` is the single source of truth (plan
// Task 6 sync rule); `rows` is a UI-only projection kept in lockstep on every meta-replacing
// operation (import/reset/restore) via metaToRows.
export function MetadataBuilderTool() {
  const t = useTranslations("ToolUI");
  const [meta, setMeta] = React.useState<DataResourceMeta>(DEFAULT_META);
  const [tab, setTab] = React.useState<Tab>("fields");
  const [rows, setRows] = React.useState<FieldRow[]>(() => metaToRows(DEFAULT_META.fields, () => crypto.randomUUID()));
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const restoredRef = React.useRef(false);
  React.useEffect(() => {
    // 1) restore — must be declared before the persist effect below.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = parseDataResourceMeta(JSON.parse(raw));
        setMeta(parsed);
        setRows(metaToRows(parsed.fields, () => crypto.randomUUID()));
      }
    } catch {
      /* corrupt storage silently falls back to the default sample */
    }
    restoredRef.current = true;
  }, []);
  React.useEffect(() => {
    // 2) persist — skip every run until the restore effect above has completed.
    if (!restoredRef.current) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  }, [meta]);

  function handleFieldsChange(next: FieldRow[]) {
    setRows(next);
    setMeta((m) => ({ ...m, fields: rowsToMeta(next) }));
  }

  function handleProtocolChange(next: { request: DataResourceMeta["request"]; response: DataResourceMeta["response"] }) {
    setMeta((m) => ({ ...m, request: next.request, response: next.response }));
  }

  function handleImportMeta(nextMeta: DataResourceMeta) {
    setMeta(nextMeta);
    setRows(metaToRows(nextMeta.fields, () => crypto.randomUUID()));
    setTab("fields");
  }

  function handleImportFields(fields: DataFieldMeta[]) {
    setMeta((m) => ({ ...m, fields }));
    setRows(metaToRows(fields, () => crypto.randomUUID()));
    setTab("fields");
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setMeta(DEFAULT_META);
    setRows(metaToRows(DEFAULT_META.fields, () => crypto.randomUUID()));
  }

  const fieldsLabels: FieldsPanelLabels = React.useMemo(
    () => ({
      key: t("mbKey"),
      labelEn: t("mbLabelEn"),
      labelZh: t("mbLabelZh"),
      dataType: t("mbDataType"),
      format: t("mbFormat"),
      formatNone: t("mbFormatNone"),
      sortable: t("mbSortable"),
      filterable: t("mbFilterable"),
      kind: t("mbKind"),
      kindNone: t("mbKindNone"),
      options: t("mbOptions"),
      addField: t("mbAddField"),
      addOption: t("mbAddOption"),
      remove: t("mbRemove"),
      dupKey: t("mbDupKey"),
      blankKey: t("mbBlankKey"),
      inspectorTitle: t("mbInspectorTitle"),
      inspectorEmpty: t("mbInspectorEmpty"),
      fieldSummary: "",
    }),
    [t],
  );
  // fieldSummary depends on `rows` (which changes far more often than `t`) — computed fresh every
  // render and merged in below, kept out of the [t]-memoized labels object above.
  const fieldSummary = t("mbFieldSummary", { n: rows.length, f: rows.filter((r) => r.filterable).length });

  const protocolLabels: ProtocolPanelLabels = React.useMemo(
    () => ({
      enabled: t("mbProtoEnabled"),
      endpoint: t("mbEndpoint"),
      method: t("mbMethod"),
      pagination: t("mbPagination"),
      sort: t("mbSort"),
      sortNone: t("mbSortNone"),
      filter: t("mbFilter"),
      filterNone: t("mbFilterNone"),
      filterParam: t("mbFilterParam"),
      rowsPath: t("mbRowsPath"),
      totalPath: t("mbTotalPath"),
      cursorPath: t("mbCursorPath"),
      limitParam: t("mbLimitParam"),
      offsetParam: t("mbOffsetParam"),
      pageParam: t("mbPageParam"),
      pageSizeParam: t("mbPageSizeParam"),
      firstPage: t("mbFirstPage"),
      cursorParam: t("mbCursorParam"),
      sortParam: t("mbSortParam"),
      encoding: t("mbEncoding"),
      fieldParam: t("mbFieldParam"),
      dirParam: t("mbDirParam"),
    }),
    [t],
  );

  const importLabels: ImportPanelLabels = React.useMemo(
    () => ({
      modeMeta: t("mbModeMeta"),
      modeRows: t("mbModeRows"),
      placeholderMeta: t("mbPlaceholderMeta"),
      placeholderRows: t("mbPlaceholderRows"),
      load: t("mbLoad"),
      upload: t("mbUpload"),
      invalidJson: t("mbInvalidJson"),
      hint: t("mbImportHint"),
    }),
    [t],
  );

  const previewLabels: DerivedPreviewLabels = React.useMemo(
    () => ({
      metaTitle: t("mbMetaTitle"),
      schemaTitle: t("mbSchemaTitle"),
      tryTitle: t("mbTryTitle"),
      emptySchema: t("mbEmptySchema"),
      copy: t("mbCopy"),
      copied: t("mbCopied"),
      download: t("mbDownload"),
      reset: t("mbReset"),
    }),
    [t],
  );

  const treeLabels = React.useMemo(
    () => ({
      logic: {
        and: t("mbTreeAnd"),
        or: t("mbTreeOr"),
        nor: t("mbTreeNor"),
        not: t("mbTreeNot"),
      },
      addCondition: t("mbTreeAddCond"),
      addGroup: t("mbTreeAddGroup"),
      removeGroup: t("mbTreeRemoveGroup"),
      removeCondition: t("mbTreeRemoveCond"),
      elemMatch: t("mbTreeElemMatch"),
    }),
    [t],
  );

  const TABS: { id: Tab; label: string }[] = [
    { id: "fields", label: t("mbTabFields") },
    { id: "protocol", label: t("mbTabProtocol") },
    { id: "import", label: t("mbTabImport") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t("mbEyebrow")}</p>

      <div className="inline-flex w-fit gap-0.5 rounded-lg border border-input bg-muted/30 p-1">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => setTab(tabItem.id)}
            aria-selected={tab === tabItem.id}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === tabItem.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === "fields" && (
        <FieldsPanel
          rows={rows}
          onChange={handleFieldsChange}
          selectedId={selectedId}
          onSelect={setSelectedId}
          labels={{ ...fieldsLabels, fieldSummary }}
        />
      )}
      {tab === "protocol" && (
        <ProtocolPanel request={meta.request} response={meta.response} onChange={handleProtocolChange} labels={protocolLabels} />
      )}
      {tab === "import" && <ImportPanel onMeta={handleImportMeta} onFields={handleImportFields} labels={importLabels} />}

      <div>
        <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground">{t("mbPreviewTitle")}</p>
        <DerivedPreview meta={meta} onReset={reset} labels={previewLabels} treeLabels={treeLabels} />
      </div>
    </div>
  );
}
