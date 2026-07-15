"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Textarea } from "@rfjs/web-ui/components/textarea";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { runMongoQuery } from "./mongo-query-generator";

import { FragmentBar } from "@/components/shared/fragment-bar";
import { SectionCard } from "@/components/shared/section-card";
import { ToolEyebrow } from "@/components/shared/tool-eyebrow";
import { ToolIntro } from "@/components/shared/tool-intro";
import { ToolShell } from "@/tools/_shared/tool-shell";

const SAMPLE = `{
  "logic": "and",
  "filters": [
    { "field": "name", "condition": "eq", "dataType": "string", "value": "Ada" },
    { "field": "age", "condition": "gte", "dataType": "number", "value": 18 }
  ]
}`;

export function MongoQueryGenerator() {
  const t = useTranslations("ToolUI");
  const [text, setText] = useState(SAMPLE);
  const result = runMongoQuery(text);

  return (
    <div className="flex flex-col gap-4">
      <ToolEyebrow>{t("mqgEyebrow")}</ToolEyebrow>
      <ToolIntro
        storageKey="tool-intro:mongo-query-generator"
        question={t("introQuestion")}
        tagline={t("mqgIntroTagline")}
        concepts={[
          { term: t("mqgIntroC1t"), desc: t("mqgIntroC1d") },
          { term: t("mqgIntroC2t"), desc: t("mqgIntroC2d") },
        ]}
        labels={{ expand: t("introExpand"), collapse: t("introCollapse"), dismiss: t("introDismiss") }}
      />
      <ToolShell
        operation="genFilterQuery()"
        input={
          <SectionCard title={t("filter")}>
            <Textarea
              aria-label={t("filter")}
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              rows={10}
              className="resize-y font-mono"
            />
          </SectionCard>
        }
        output={
          <SectionCard
            title={t("output")}
            action={
              result.ok ? (
                <CopyButton text={result.output} label={t("copy")} />
              ) : null
            }
          >
            {result.ok ? (
              <div className="flex flex-col gap-2">
                <FragmentBar>◆ {t("mqgFragment")}</FragmentBar>
                <pre className="overflow-x-auto font-mono text-sm text-foreground">
                  {result.output}
                </pre>
              </div>
            ) : (
              <p className="font-mono text-sm text-fault">
                {t(`error.${result.error}`)}
              </p>
            )}
          </SectionCard>
        }
      />
    </div>
  );
}
