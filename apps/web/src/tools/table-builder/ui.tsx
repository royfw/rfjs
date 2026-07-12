"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import { ConfigTable, makeHttpFetcher } from "@rfjs/table-builder-ui";
import type { TableLabels, TableSource } from "@rfjs/table-builder-ui";
import { deriveTableConfig, parseTableConfig } from "@rfjs/table-builder";
import type {
  TableConfig,
  TableColumnConfig,
  TablePaginationConfig,
} from "@rfjs/table-builder";
import { inferFieldsFromRows } from "@rfjs/data-schema";
import type { DataFieldMeta, DataResourceMeta, RequestMeta, ResponseMeta } from "@rfjs/data-schema";

import { AiPanel, useAiAssist } from "@rfjs/ai-assist-ui";
import { useAiPanelLabels } from "@/components/shared/ai-panel-labels";
import { ProtocolPanel, type ProtocolPanelLabels } from "@rfjs/data-schema-ui";
import { ToolIntro } from "@/components/shared/tool-intro";

import { SAMPLE_CONFIG, SAMPLE_META, SAMPLE_ROWS } from "./sample";
import { makeFakeFetcher } from "./fake-fetcher";
import { ResourcePanel } from "./resource-panel";
import type { PreviewMode } from "./resource-panel";
import { ColumnsPanel } from "./columns-panel";
import { PaginationPanel } from "./pagination-panel";
import { MetadataPanel } from "./metadata-panel";
import type { MetadataPanelLabels } from "./metadata-panel";
import {
  buildNlTablePrompt,
  buildTableAskPrompt,
  parseNlTableResponse,
} from "./ai-nl-table";

// Task 9 (design spec §6.1) adds the editor panels + live preview on top of Task 8's static
// render: the editor area is tabbed (source / columns / pagination / metadata), and a
// full-width `<ConfigTable>` preview below stays mounted regardless of the active tab, reflecting
// every edit immediately.

// Pre-fill the Source panel's paste box with the default rows as pretty JSON, so the box is a
// usable, editable example of the data driving the initial table (module-scope: stable identity).
const SAMPLE_JSON = JSON.stringify(SAMPLE_ROWS, null, 2);

export function TableBuilderTool() {
  const t = useTranslations("ToolUI");
  const locale = useLocale();
  const ai = useAiAssist();
  const aiLabels = useAiPanelLabels();

  const [config, setConfig] = React.useState<TableConfig>(SAMPLE_CONFIG);
  const [request, setRequest] = React.useState<RequestMeta | undefined>(SAMPLE_META.request);
  const [response, setResponse] = React.useState<ResponseMeta | undefined>(SAMPLE_META.response);
  const [fields, setFields] = React.useState<DataFieldMeta[]>(SAMPLE_META.fields);
  const [preview, setPreview] = React.useState<PreviewMode>("offline");
  const [rows, setRows] =
    React.useState<Record<string, unknown>[]>(SAMPLE_ROWS);
  const [dataVersion, setDataVersion] = React.useState(0);

  const hasProtocol = request !== undefined && response !== undefined;

  type EditorTab = "source" | "columns" | "pagination" | "metadata";
  const [tab, setTab] = React.useState<EditorTab>("source");

  const labels: TableLabels = React.useMemo(
    () => ({
      empty: t("tbEmpty"),
      loading: t("tbLoading"),
      error: t("tbErrorState"),
      retry: t("tbRetry"),
      prev: t("tbPrev"),
      next: t("tbNext"),
      // template labels carry literal {page}/{count}/{total} for ConfigTable's own
      // substitution -- t() would ICU-parse and throw (see the next-intl placeholder trap);
      // t.raw() bypasses ICU.
      pageOf: t.raw("tbPageOf") as string,
      total: t.raw("tbTotalRows") as string,
      pageSize: t("tbPageSizeLabel"),
      filterTitle: t("tbFilterTitle"),
      filterMatched: t.raw("tbFilterMatched") as string,
      filterUncoverable: t("tbFilterUncoverable"),
      filterDisabled: t("tbFilterDisabled"),
      filterApply: t("tbFilterApply"),
    }),
    [t],
  );

  // Filter-TREE editor labels (Task 4's `<ConfigTable filterLabels?>`, a `Partial<FilterTreeLabels>`):
  // the AND/OR/+condition/+group/remove strings shown *inside* `FilterTreeEditor`, distinct from
  // the top-level filter chrome (title/matched/uncoverable/disabled) in `labels` above.
  // `operatorLabels` is omitted for v1 -- ConfigTable falls back to raw operator ids.
  const filterLabels = React.useMemo(
    () => ({
      logic: {
        and: t("tbFilterAnd"),
        or: t("tbFilterOr"),
        nor: t("tbFilterNor"),
        not: t("tbFilterNot"),
      },
      addCondition: t("tbFilterAddCond"),
      addGroup: t("tbFilterAddGroup"),
      removeGroup: t("tbFilterRemoveGroup"),
      removeCondition: t("tbFilterRemoveCond"),
      elemMatch: t("tbFilterElemMatch"),
    }),
    [t],
  );

  const resourcePanelLabels = React.useMemo(
    () => ({
      title: t("tbResourceTitle"),
      seedMeta: t("tbSeedImportMeta"),
      seedRows: t("tbSeedPasteRows"),
      seedSample: t("tbSeedSample"),
      metaPlaceholder: t("tbSeedMetaPlaceholder"),
      metaHint: t("tbSeedMetaHint"),
      metaInvalid: t("tbSeedMetaInvalid"),
      sampleHint: t("tbSeedSampleHint"),
      sampleLoad: t("tbSeedSampleLoad"),
      fieldsSummary: t("tbFieldsSummary", { count: fields.length }),
      protoHint: t("tbProtoHint"),
      previewLabel: t("tbPreviewData"),
      previewOffline: t("tbPreviewOffline"),
      previewLive: t("tbPreviewLive"),
    }),
    [t, fields.length],
  );

  // protocolLabels reuses the metadata-builder tool's `mb*` ToolUI keys (all tool messages
  // aggregate into one `ToolUI` namespace) so `<ProtocolPanel>` doesn't need its own copy set.
  // `mbTryRows` carries a raw `{count}` for ProtocolPanel's own substitution -- `t.raw` bypasses
  // next-intl's ICU parsing (see the next-intl placeholder trap).
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
      try: t("mbTry"),
      tryRows: t.raw("mbTryRows") as string,
      tryError: t("mbTryError"),
    }),
    [t],
  );

  const importLabels = React.useMemo(
    () => ({
      paste: t("tbImportPaste"),
      upload: t("tbImportUpload"),
      load: t("tbImportLoad"),
      json: t("tbImportJson"),
      csv: t("tbImportCsv"),
    }),
    [t],
  );

  const columnsPanelLabels = React.useMemo(
    () => ({
      title: t("tbColumnsPanelTitle"),
      visible: t("tbColumnVisible"),
      label: t("tbColumnLabel"),
      format: t("tbColumnFormat"),
      formatNone: t("tbColumnFormatNone"),
      sortable: t("tbColumnSortable"),
      filter: t("tbColumnFilter"),
      pin: t("tbColumnPin"),
      pinNone: t("tbPinNone"),
      pinLeft: t("tbPinLeft"),
      pinRight: t("tbPinRight"),
    }),
    [t],
  );

  const paginationPanelLabels = React.useMemo(
    () => ({
      title: t("tbPaginationPanelTitle"),
      pageSize: t("tbPaginationPageSizeLabel"),
      emptyText: t("tbEmptyTextLabel"),
    }),
    [t],
  );

  const metadataPanelLabels: MetadataPanelLabels = React.useMemo(
    () => ({
      hint: t("tbMetaHint"),
      copy: t("tbMetaCopy"),
      copied: t("tbMetaCopied"),
      download: t("tbMetaDownload"),
    }),
    [t],
  );

  // One data truth (design spec ② Z-model): the offline fetcher simulates the protocol over the
  // RESOURCE's own rows/fields -- never the SAMPLE_* constants (the pre-Z divergence trap where
  // imported rows and the in-memory preview queried different data).
  const source: TableSource = React.useMemo(() => {
    if (!request || !response) return { kind: "rows", rows };
    return {
      kind: "remote",
      request,
      response,
      fields,
      fetch:
        preview === "live"
          ? makeHttpFetcher(request)
          : makeFakeFetcher(rows, config.columns, fields),
    };
  }, [request, response, preview, config.columns, rows, fields]);

  // Metadata tab carries whatever protocol the resource declares (undefined = none).
  const metaRequest: RequestMeta | undefined = request;
  const metaResponse: ResponseMeta | undefined = response;

  function handleColumnsChange(columns: TableColumnConfig[]) {
    setConfig((current) => ({ ...current, columns }));
  }

  function handlePaginationChange(pagination: TablePaginationConfig) {
    setConfig((current) => ({ ...current, pagination }));
  }

  function handleEmptyTextChange(emptyText: string) {
    setConfig((current) => ({ ...current, emptyText }));
  }

  function handleImportRows(nextRows: Record<string, unknown>[]) {
    const nextFields = inferFieldsFromRows(nextRows);
    setFields(nextFields);
    setConfig(deriveTableConfig({ fields: nextFields }));
    setRows(nextRows);
    // pasted rows seed a NEW protocol-less resource (design spec ②) -- re-add via the switch
    setRequest(undefined);
    setResponse(undefined);
    setPreview("offline");
    setDataVersion((v) => v + 1);
  }

  function handleImportMeta(meta: DataResourceMeta) {
    setFields(meta.fields);
    setRequest(meta.request);
    setResponse(meta.response);
    setConfig(deriveTableConfig(meta));
    setPreview("offline");
    setDataVersion((v) => v + 1);
  }

  function handleSampleReset() {
    setFields(SAMPLE_META.fields);
    setRows(SAMPLE_ROWS);
    setRequest(SAMPLE_META.request);
    setResponse(SAMPLE_META.response);
    setConfig(SAMPLE_CONFIG);
    setPreview("offline");
    setDataVersion((v) => v + 1);
  }

  function applyGeneratedConfig(json: string) {
    try {
      setConfig(parseTableConfig(JSON.parse(json)));
    } catch {
      // stale/foreign log entry — leave the current config untouched
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground">
        {t("tbEyebrow")}
      </p>

      <ToolIntro
        storageKey="tool-intro:table-builder"
        question={t("tbIntroQuestion")}
        tagline={t("tbIntroTagline")}
        concepts={[
          { term: t("tbIntroC1t"), desc: t("tbIntroC1d") },
          { term: t("tbIntroC2t"), desc: t("tbIntroC2d") },
          { term: t("tbIntroC3t"), desc: t("tbIntroC3d") },
        ]}
        labels={{ expand: t("tbIntroExpand"), collapse: t("tbIntroCollapse"), dismiss: t("tbIntroDismiss") }}
      />

      <AiPanel
        title={t("aiBlockTitle")}
        placeholder={t("tbAiPlaceholder")}
        logKey="rfjs.ai.log.table-builder"
        ai={ai}
        labels={aiLabels}
        onReapply={(e) => applyGeneratedConfig(e.appliedJson ?? "")}
        appliedSummary={(e) => {
          let n = 0;
          try {
            const parsed = JSON.parse(e.appliedJson ?? "") as {
              columns?: unknown[];
            };
            n = Array.isArray(parsed.columns) ? parsed.columns.length : 0;
          } catch {
            n = 0;
          }
          return t("tbAiApplied", { count: n });
        }}
        actions={[
          {
            key: "generate",
            label: t("tbAiGenerate"),
            needsInput: true,
            primary: true,
            run: async (input) => {
              const out = await ai.run(
                { ...buildNlTablePrompt(input, config), json: true },
                parseNlTableResponse,
              );
              if (out === null) return null;
              applyGeneratedConfig(out);
              return { kind: "generate", prompt: input, appliedJson: out };
            },
          },
          {
            key: "ask",
            label: t("aiAsk"),
            needsInput: true,
            run: async (input) => {
              const out = await ai.runStream(
                buildTableAskPrompt(
                  { configJson: JSON.stringify(config, null, 2), locale },
                  input,
                ),
                (raw) => raw.trim(),
              );
              return out === null
                ? null
                : { kind: "ask", prompt: input, answer: out };
            },
          },
        ]}
      />

      {/* B-layout (design spec §2.1): editor panels are tabs, full width each; the ConfigTable
          preview below stays mounted no matter which tab is active. Panels are conditionally
          rendered — all editor state lives in this component or panel props, except the source
          panel's paste text (internal state, resets to defaultText on tab switch; accepted v1). */}
      <div className="inline-flex w-fit gap-0.5 rounded-lg border border-input bg-muted/30 p-1">
        {(
          [
            { id: "source", label: t("tbTabResource") },
            { id: "columns", label: t("tbTabColumns") },
            { id: "pagination", label: t("tbTabPagination") },
            { id: "metadata", label: t("tbTabMetadata") },
          ] as { id: EditorTab; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-selected={tab === item.id}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === item.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "source" ? (
        <>
          <ResourcePanel
            labels={resourcePanelLabels}
            importLabels={importLabels}
            onImportRows={handleImportRows}
            onImportMeta={handleImportMeta}
            onSampleReset={handleSampleReset}
            defaultRowsText={SAMPLE_JSON}
            hasProtocol={hasProtocol}
            preview={preview}
            onPreviewChange={setPreview}
          />
          <ProtocolPanel
            request={request}
            response={response}
            onChange={(n) => {
              setRequest(n.request);
              setResponse(n.response);
            }}
            labels={protocolLabels}
          />
        </>
      ) : null}
      {tab === "columns" ? (
        <ColumnsPanel
          columns={config.columns}
          onChange={handleColumnsChange}
          labels={columnsPanelLabels}
        />
      ) : null}
      {tab === "pagination" ? (
        <PaginationPanel
          pagination={config.pagination}
          emptyText={config.emptyText}
          onPaginationChange={handlePaginationChange}
          onEmptyTextChange={handleEmptyTextChange}
          labels={paginationPanelLabels}
        />
      ) : null}
      {tab === "metadata" ? (
        <MetadataPanel
          config={config}
          request={metaRequest}
          response={metaResponse}
          labels={metadataPanelLabels}
        />
      ) : null}

      <div className="rounded-md border p-3">
        <p className="mb-2 text-sm font-semibold">{t("tbPreviewTitle")}</p>
        {/* `key` forces a remount when the pagination-panel's `pageSize`, the source strategy, or
            the imported dataset changes -- `useConfigTable` only reads `config.pagination.pageSize`
            as its initial `useState` value (design constraint: only this tool's files, not
            table-builder-ui, are in scope), so a fresh key is how "pageSize edit reflects
            immediately" is achieved without touching the hook itself. `dataVersion` is bumped on
            every successful import so re-importing also remounts -- and clears -- the table's
            internal filter tree. */}
        <ConfigTable
          key={`${hasProtocol ? "remote" : "rows"}:${config.pagination.pageSize}:${dataVersion}`}
          config={config}
          source={source}
          labels={labels}
          filterLabels={filterLabels}
        />
      </div>
    </div>
  );
}
