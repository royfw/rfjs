"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { parseDataResourceMeta } from "@rfjs/data-schema";
import type { DataFieldMeta, DataResourceMeta } from "@rfjs/data-schema";

import { DEFAULT_META, metaToRows, rowsToMeta, type FieldRow } from "./model";
import { FieldsPanel, type FieldsPanelLabels } from "./fields-panel";
import { ProtocolPanel, type ProtocolPanelLabels } from "./protocol-panel";
import { ImportPanel, type ImportPanelLabels } from "./import-panel";
import { CodePanel, type CodePanelLabels, type CodePanelTab } from "./code-panel";

const STORAGE_KEY = "rfjs.metadata-builder.meta";
const CODE_OPEN_KEY = "rfjs.metadata-builder.code-open";

type Tab = "fields" | "protocol" | "import";

// Assembly shell (design spec §Studio, direction C): eyebrow → segmented tabs (#239 pattern) →
// a two-column grid pairing the current editor panel with the <CodePanel> (or its collapsed
// bar). `meta` is the single source of truth (plan Task 6 sync rule); `rows` is a UI-only
// projection kept in lockstep on every meta-replacing operation (import/reset/restore) via
// metaToRows. `codeTab` is controlled here (not inside CodePanel) so the collapsed bar can keep
// showing the active tab name; `selectedFieldKey` mirrors the fields-panel selection and only
// narrows the code panel while the Fields tab is active.
export function MetadataBuilderTool() {
  const t = useTranslations("ToolUI");
  const [meta, setMeta] = React.useState<DataResourceMeta>(DEFAULT_META);
  const [tab, setTab] = React.useState<Tab>("fields");
  const [rows, setRows] = React.useState<FieldRow[]>(() => metaToRows(DEFAULT_META.fields, () => crypto.randomUUID()));
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [codeTab, setCodeTab] = React.useState<CodePanelTab>("meta");
  const [codeOpen, setCodeOpen] = React.useState(true); // SSR first paint is always open, to avoid a hydration mismatch

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
    const storedOpen = localStorage.getItem(CODE_OPEN_KEY);
    if (storedOpen !== null) {
      setCodeOpen(storedOpen !== "0");
    } else {
      // no stored preference yet: default open on desktop widths, collapsed on narrow viewports.
      // jsdom has no matchMedia — guard it and treat that as "desktop" so tests see the default-open behavior.
      setCodeOpen(typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 1024px)").matches : true);
    }
    restoredRef.current = true;
  }, []);
  React.useEffect(() => {
    // 2) persist — skip every run until the restore effect above has completed.
    if (!restoredRef.current) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  }, [meta]);

  function toggleCode(next: boolean) {
    setCodeOpen(next);
    localStorage.setItem(CODE_OPEN_KEY, next ? "1" : "0");
  }

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
    setSelectedId(null);
  }

  function handleImportFields(fields: DataFieldMeta[]) {
    setMeta((m) => ({ ...m, fields }));
    setRows(metaToRows(fields, () => crypto.randomUUID()));
    setTab("fields");
    setSelectedId(null);
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setMeta(DEFAULT_META);
    setRows(metaToRows(DEFAULT_META.fields, () => crypto.randomUUID()));
    setSelectedId(null);
  }

  const selectedFieldKey = rows.find((r) => r.id === selectedId)?.key ?? null;

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

  const codeLabels: CodePanelLabels = React.useMemo(
    () => ({
      metaTitle: t("mbMetaTitle"),
      schemaTitle: t("mbSchemaTitle"),
      tryTitle: t("mbTryTitle"),
      emptySchema: t("mbEmptySchema"),
      copy: t("mbCopy"),
      copied: t("mbCopied"),
      download: t("mbDownload"),
      reset: t("mbReset"),
      collapse: t("mbCollapse"),
      expand: t("mbExpand"),
      showAll: t("mbShowAll"),
    }),
    [t],
  );
  // shown on the collapsed bar — the active code tab's title, kept in sync without re-deriving
  // the whole codeLabels memo.
  const codeTabLabel = { meta: codeLabels.metaTitle, schema: codeLabels.schemaTitle, try: codeLabels.tryTitle }[codeTab];

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

      <div
        className={`grid gap-4 ${
          codeOpen ? "lg:grid-cols-[minmax(320px,1fr)_minmax(380px,1fr)]" : "lg:grid-cols-[1fr_2.5rem]"
        }`}
      >
        {/* min-w-0:grid 軌道內的寬內容(不換行的條件列/長 JSON)否則會撐爆軌道溢出框線 */}
        <div className="min-w-0">
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
        </div>
        <div className="min-w-0">
          {codeOpen ? (
            <CodePanel
              meta={meta}
              selectedFieldKey={tab === "fields" ? selectedFieldKey : null}
              tab={codeTab}
              onTabChange={setCodeTab}
              onReset={reset}
              onCollapse={() => toggleCode(false)}
              labels={codeLabels}
              treeLabels={treeLabels}
            />
          ) : (
            <button
              type="button"
              onClick={() => toggleCode(true)}
              aria-label={t("mbExpand")}
              className="flex h-full min-h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-input text-xs text-muted-foreground hover:text-foreground lg:w-10 lg:flex-col"
            >
              <span className="lg:rotate-90 lg:whitespace-nowrap">{codeTabLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
