"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Textarea } from "@rfjs/web-ui/components/textarea";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { runFilterTest } from "./data-filter-tester";

import { SectionCard } from "@/components/shared/section-card";
import { ToolEyebrow } from "@/components/shared/tool-eyebrow";
import { ToolIntro } from "@/components/shared/tool-intro";
import { ToolShell } from "@/tools/_shared/tool-shell";

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

  return (
    <div className="flex flex-col gap-4">
      <ToolEyebrow>{t("dftEyebrow")}</ToolEyebrow>
      <ToolIntro
        storageKey="tool-intro:data-filter-tester"
        question={t("introQuestion")}
        tagline={t("dftIntroTagline")}
        concepts={[
          { term: t("dftIntroC1t"), desc: t("dftIntroC1d") },
          { term: t("dftIntroC2t"), desc: t("dftIntroC2d") },
          { term: t("dftIntroC3t"), desc: t("dftIntroC3d") },
        ]}
        labels={{ expand: t("introExpand"), collapse: t("introCollapse"), dismiss: t("introDismiss") }}
      />
      <ToolShell
        operation="matchQuery()"
        input={
          <SectionCard title={t("input")}>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t("data")}
                <Textarea
                  aria-label={t("data")}
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  spellCheck={false}
                  rows={6}
                  className="resize-y font-mono"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t("filter")}
                <Textarea
                  aria-label={t("filter")}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  spellCheck={false}
                  rows={6}
                  className="resize-y font-mono"
                />
              </label>
            </div>
          </SectionCard>
        }
        output={
          <SectionCard
            title={t("output")}
            action={result.ok ? <CopyButton text={result.output} label={t("copy")} /> : null}
          >
            {result.ok ? (
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] text-muted-foreground">{t("matched", { count: result.count })}</span>
                <pre className="overflow-x-auto font-mono text-sm text-foreground">{result.output}</pre>
              </div>
            ) : (
              <p className="font-mono text-sm text-fault">{t(`error.${result.error}`)}</p>
            )}
          </SectionCard>
        }
      />
    </div>
  );
}
