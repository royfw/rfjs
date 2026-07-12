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
import type { RequestMeta, ResponseMeta } from "@rfjs/data-schema";

import { AiPanel, useAiAssist } from "@rfjs/ai-assist-ui";
import { useAiPanelLabels } from "@/components/shared/ai-panel-labels";
import { ProtocolPanel, type ProtocolPanelLabels } from "@rfjs/data-schema-ui";

import { SAMPLE_CONFIG, SAMPLE_META, SAMPLE_ROWS } from "./sample";
import type { SourceMode } from "./sample";
import { makeFakeFetcher } from "./fake-fetcher";
import { SourcePanel } from "./source-panel";
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
  const [sourceMode, setSourceMode] = React.useState<SourceMode>("rows");
  const [transport, setTransport] = React.useState<"memory" | "http">("memory");
  const [request, setRequest] = React.useState<RequestMeta>(SAMPLE_META.request!);
  const [response, setResponse] = React.useState<ResponseMeta>(SAMPLE_META.response!);
  const [rows, setRows] =
    React.useState<Record<string, unknown>[]>(SAMPLE_ROWS);
  const [dataVersion, setDataVersion] = React.useState(0);

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

  const sourcePanelLabels = React.useMemo(
    () => ({
      title: t("tbSourcePanelTitle"),
      rows: t("tbSourceStatic"),
      fetcher: t("tbSourceFetcher"),
      transport: t("tbTransport"),
      transportMemory: t("tbTransportMemory"),
      transportHttp: t("tbTransportHttp"),
    }),
    [t],
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

  // Referential stability (Task 8's mandatory pattern): `<ConfigTable>`'s remote-fetch effect
  // keys off `source` identity, so this must stay memoized -- it's only rebuilt when the source
  // kind/strategy changes or the column set changes (the fake fetcher needs the current columns
  // to pick a sort comparator).
  const source: TableSource = React.useMemo(() => {
    if (sourceMode === "rows") return { kind: "rows", rows };
    return {
      kind: "remote",
      request,
      response,
      fields: SAMPLE_META.fields,
      fetch:
        transport === "http"
          ? makeHttpFetcher(request)
          : makeFakeFetcher(SAMPLE_ROWS, config.columns, SAMPLE_META.fields),
    };
  }, [sourceMode, transport, request, response, config.columns, rows]);

  // Metadata tab inputs (design spec §2.2): rows mode is a pure fields description; remote mode
  // carries the currently edited request/response protocol (see the `<ProtocolPanel>` below).
  const metaRequest: RequestMeta | undefined = sourceMode === "rows" ? undefined : request;
  const metaResponse: ResponseMeta | undefined = sourceMode === "rows" ? undefined : response;

  function handleColumnsChange(columns: TableColumnConfig[]) {
    setConfig((current) => ({ ...current, columns }));
  }

  function handlePaginationChange(pagination: TablePaginationConfig) {
    setConfig((current) => ({ ...current, pagination }));
  }

  function handleEmptyTextChange(emptyText: string) {
    setConfig((current) => ({ ...current, emptyText }));
  }

  function handleImport(nextRows: Record<string, unknown>[]) {
    const meta = { fields: inferFieldsFromRows(nextRows) };
    setConfig(deriveTableConfig(meta));
    setRows(nextRows);
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
            { id: "source", label: t("tbTabSource") },
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
          <SourcePanel
            mode={sourceMode}
            onModeChange={setSourceMode}
            labels={sourcePanelLabels}
            onImport={handleImport}
            importLabels={importLabels}
            defaultText={SAMPLE_JSON}
            transport={transport}
            onTransportChange={setTransport}
          />
          {sourceMode !== "rows" && (
            <ProtocolPanel
              request={request}
              response={response}
              showEnableToggle={false}
              onChange={(n) => {
                if (n.request) setRequest(n.request);
                if (n.response) setResponse(n.response);
              }}
              labels={protocolLabels}
            />
          )}
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
          key={`${sourceMode}:${config.pagination.pageSize}:${dataVersion}`}
          config={config}
          source={source}
          labels={labels}
          filterLabels={filterLabels}
        />
      </div>
    </div>
  );
}
