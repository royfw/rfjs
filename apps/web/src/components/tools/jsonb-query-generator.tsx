"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rfjs/web-ui/components/dropdown-menu";
import { Panel } from "@rfjs/web-ui/components/panel";
import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { JSONB_DIALECTS, runJsonbQuery, type JsonbDialect } from "@/lib/tools/jsonb-query-generator";

import { ToolShell } from "./tool-shell";

const SAMPLE = `{
  "logic": "and",
  "filters": [
    { "field": "age", "dataType": "numeric", "operator": "gt", "value": 18 }
  ]
}`;

export function JsonbQueryGenerator() {
  const t = useTranslations("ToolUI");
  const [column, setColumn] = useState("data");
  const [dialect, setDialect] = useState<JsonbDialect>("legacy");
  const [filter, setFilter] = useState(SAMPLE);
  const result = runJsonbQuery(column, filter, dialect);

  return (
    <ToolShell
      operation="buildJsonbQuery()"
      input={
        <Panel title={t("input")}>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("column")}
              <input
                aria-label={t("column")}
                value={column}
                onChange={(e) => setColumn(e.target.value)}
                className="w-full rounded-sm border bg-transparent px-2 py-1.5 font-mono text-sm"
              />
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label={t("dialect")} className="justify-between gap-2">
                  {dialect}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {JSONB_DIALECTS.map((d) => (
                  <DropdownMenuItem key={d} onSelect={() => setDialect(d)}>
                    <Check className={d === dialect ? "size-4 opacity-100" : "size-4 opacity-0"} />
                    {d}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("filter")}
              <textarea
                aria-label={t("filter")}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                spellCheck={false}
                rows={8}
                className="w-full resize-y rounded-sm border bg-transparent p-2 font-mono text-sm"
              />
            </label>
          </div>
        </Panel>
      }
      output={
        <Panel title={t("output")} action={result.ok ? <CopyButton text={result.where} label={t("copy")} /> : null}>
          {result.ok ? (
            <div className="flex flex-col gap-2">
              <pre className="overflow-x-auto font-mono text-sm text-signal">{result.where}</pre>
              <pre className="overflow-x-auto font-mono text-xs text-muted-foreground">{result.values}</pre>
            </div>
          ) : (
            <p className="font-mono text-sm text-fault">{t(`error.${result.error}`)}</p>
          )}
        </Panel>
      }
    />
  );
}
