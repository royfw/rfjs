"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { runFilterTest } from "@/lib/tools/data-filter-tester";

import { ToolShell } from "./tool-shell";

const SAMPLE_DATA = `[
  { "name": "Ada", "age": 30 },
  { "name": "Bo", "age": 15 }
]`;
const SAMPLE_FILTER = `{
  "logic": "and",
  "filters": [
    { "field": "age", "dataType": "numeric", "operator": "gte", "value": 18 }
  ]
}`;

export function DataFilterTester() {
  const t = useTranslations("ToolUI");
  const [data, setData] = useState(SAMPLE_DATA);
  const [filter, setFilter] = useState(SAMPLE_FILTER);
  const result = runFilterTest(data, filter);
  const taClass = "w-full resize-y rounded-sm border bg-transparent p-2 font-mono text-sm";

  return (
    <ToolShell
      operation="matchQuery()"
      input={
        <Panel title={t("input")}>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("data")}
              <textarea aria-label={t("data")} value={data} onChange={(e) => setData(e.target.value)} spellCheck={false} rows={6} className={taClass} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("filter")}
              <textarea aria-label={t("filter")} value={filter} onChange={(e) => setFilter(e.target.value)} spellCheck={false} rows={6} className={taClass} />
            </label>
          </div>
        </Panel>
      }
      output={
        <Panel title={t("output")} action={result.ok ? <CopyButton text={result.output} label={t("copy")} /> : null}>
          {result.ok ? (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-muted-foreground">{t("matched", { count: result.count })}</span>
              <pre className="overflow-x-auto font-mono text-sm text-signal">{result.output}</pre>
            </div>
          ) : (
            <p className="font-mono text-sm text-fault">{t(`error.${result.error}`)}</p>
          )}
        </Panel>
      }
    />
  );
}
