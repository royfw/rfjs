"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ConfigTable } from "@rfjs/table-builder-ui";
import type { TableLabels, TableSource } from "@rfjs/table-builder-ui";
import { deriveTableConfig } from "@rfjs/table-builder";
import type { TableConfig, TableColumnConfig, TablePaginationConfig } from "@rfjs/table-builder";
import { inferFieldsFromRows } from "@rfjs/data-schema";
import type { RequestMeta } from "@rfjs/data-schema";

import { SAMPLE_CONFIG, SAMPLE_META, SAMPLE_ROWS, samplePaginationMeta } from "./sample";
import type { SourceMode } from "./sample";
import { makeFakeFetcher } from "./fake-fetcher";
import { SourcePanel } from "./source-panel";
import { ColumnsPanel } from "./columns-panel";
import { PaginationPanel } from "./pagination-panel";

// Task 9 (design spec §6.1) adds the editor panels + live preview on top of Task 8's static
// render: top row is three side-by-side edit panels (source / columns / pagination), bottom is
// a full-width `<ConfigTable>` preview that reflects every edit immediately.
export function TableBuilderTool() {
  const t = useTranslations("ToolUI");

  const [config, setConfig] = React.useState<TableConfig>(SAMPLE_CONFIG);
  const [sourceMode, setSourceMode] = React.useState<SourceMode>("rows");
  const [rows, setRows] = React.useState<Record<string, unknown>[]>(SAMPLE_ROWS);
  const [dataVersion, setDataVersion] = React.useState(0);

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
    }),
    [t],
  );

  // Filter-TREE editor labels (Task 4's `<ConfigTable filterLabels?>`, a `Partial<FilterTreeLabels>`):
  // the AND/OR/+condition/+group/remove strings shown *inside* `FilterTreeEditor`, distinct from
  // the top-level filter chrome (title/matched/uncoverable/disabled) in `labels` above.
  // `operatorLabels` is omitted for v1 -- ConfigTable falls back to raw operator ids.
  const filterLabels = React.useMemo(
    () => ({
      logic: { and: t("tbFilterAnd"), or: t("tbFilterOr"), nor: t("tbFilterNor"), not: t("tbFilterNot") },
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
      offset: t("tbStrategyOffset"),
      page: t("tbStrategyPage"),
      cursor: t("tbStrategyCursor"),
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

  // Referential stability (Task 8's mandatory pattern): `<ConfigTable>`'s remote-fetch effect
  // keys off `source` identity, so this must stay memoized -- it's only rebuilt when the source
  // kind/strategy changes or the column set changes (the fake fetcher needs the current columns
  // to pick a sort comparator).
  const source: TableSource = React.useMemo(() => {
    if (sourceMode === "rows") return { kind: "rows", rows };
    const request: RequestMeta = { ...SAMPLE_META.request!, pagination: samplePaginationMeta(sourceMode) };
    return {
      kind: "remote",
      request,
      response: SAMPLE_META.response!,
      fetch: makeFakeFetcher(SAMPLE_ROWS, config.columns),
    };
  }, [sourceMode, config.columns, rows]);

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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t("tbEyebrow")}</p>

      <div className="grid gap-4 md:grid-cols-3">
        <SourcePanel
          mode={sourceMode}
          onModeChange={setSourceMode}
          labels={sourcePanelLabels}
          onImport={handleImport}
          importLabels={importLabels}
        />
        <ColumnsPanel columns={config.columns} onChange={handleColumnsChange} labels={columnsPanelLabels} />
        <PaginationPanel
          pagination={config.pagination}
          emptyText={config.emptyText}
          onPaginationChange={handlePaginationChange}
          onEmptyTextChange={handleEmptyTextChange}
          labels={paginationPanelLabels}
        />
      </div>

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
