"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ConfigTable } from "@rfjs/table-builder-ui";
import type { TableLabels, TableSource } from "@rfjs/table-builder-ui";

import { SAMPLE_CONFIG, SAMPLE_ROWS } from "./sample";

// Task 8 ships the static preview only (design spec §6.1's editor panels -- data source /
// columns / pagination -- land in Task 9). `<ConfigTable>` requires `source` to stay
// referentially stable across renders (its remote-fetch effect keys off `source` identity), so
// even this static `{ kind: 'rows' }` object is built via `useMemo`, never an inline literal.
export function TableBuilderTool() {
  const t = useTranslations("ToolUI");

  const labels: TableLabels = React.useMemo(
    () => ({
      empty: t("tbEmpty"),
      loading: t("tbLoading"),
      error: t("tbErrorState"),
      retry: t("tbRetry"),
      prev: t("tbPrev"),
      next: t("tbNext"),
      pageOf: t("tbPageOf"),
      total: t("tbTotalRows"),
      pageSize: t("tbPageSizeLabel"),
    }),
    [t],
  );

  const source: TableSource = React.useMemo(() => ({ kind: "rows", rows: SAMPLE_ROWS }), []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t("tbEyebrow")}</p>
      <div className="rounded-md border p-3">
        <p className="mb-2 text-sm font-semibold">{t("tbPreviewTitle")}</p>
        <ConfigTable config={SAMPLE_CONFIG} source={source} labels={labels} />
      </div>
    </div>
  );
}
