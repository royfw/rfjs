"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Input } from "@rfjs/web-ui/components/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@rfjs/web-ui/components/dropdown-menu";
import { Panel } from "@rfjs/web-ui/components/panel";
import { Textarea } from "@rfjs/web-ui/components/textarea";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { JSONB_DIALECTS, runJsonbQuery, type JsonbDialect } from "./jsonb-query-generator";

import { ToolIntro } from "@/components/shared/tool-intro";
import { ToolShell } from "@/tools/_shared/tool-shell";

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
    <div className="flex flex-col gap-4">
      <ToolIntro
        storageKey="tool-intro:jsonb-query-generator"
        question={t("introQuestion")}
        tagline={t("jqgIntroTagline")}
        concepts={[
          { term: t("jqgIntroC1t"), desc: t("jqgIntroC1d") },
          { term: t("jqgIntroC2t"), desc: t("jqgIntroC2d") },
        ]}
        labels={{ expand: t("introExpand"), collapse: t("introCollapse"), dismiss: t("introDismiss") }}
      />
      <ToolShell
        operation="buildJsonbQuery()"
        input={
          <Panel title={t("input")}>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t("column")}
                <Input
                  aria-label={t("column")}
                  value={column}
                  onChange={(e) => setColumn(e.target.value)}
                  className="font-mono"
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
                  <DropdownMenuRadioGroup
                    value={dialect}
                    onValueChange={(next) => setDialect(next as JsonbDialect)}
                  >
                    {JSONB_DIALECTS.map((d) => (
                      <DropdownMenuRadioItem key={d} value={d}>
                        {d}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t("filter")}
                <Textarea
                  aria-label={t("filter")}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  spellCheck={false}
                  rows={8}
                  className="resize-y font-mono"
                />
              </label>
            </div>
          </Panel>
        }
        output={
          <Panel title={t("output")} action={result.ok ? <CopyButton text={result.where} label={t("copy")} /> : null}>
            {result.ok ? (
              <div className="flex flex-col gap-2">
                <pre className="overflow-x-auto font-mono text-sm text-foreground">{result.where}</pre>
                <pre className="overflow-x-auto font-mono text-xs text-muted-foreground">{result.values}</pre>
              </div>
            ) : (
              <p className="font-mono text-sm text-fault">{t(`error.${result.error}`)}</p>
            )}
          </Panel>
        }
      />
    </div>
  );
}
