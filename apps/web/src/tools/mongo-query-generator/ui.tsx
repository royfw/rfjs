"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { runMongoQuery } from "./mongo-query-generator";

import { ToolShell } from "@/components/tools/tool-shell";

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
    <ToolShell
      operation="genFilterQuery()"
      input={
        <Panel title={t("filter")}>
          <textarea
            aria-label={t("filter")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={10}
            className="w-full resize-y rounded-sm border bg-transparent p-2 font-mono text-sm"
          />
        </Panel>
      }
      output={
        <Panel
          title={t("output")}
          action={
            result.ok ? (
              <CopyButton text={result.output} label={t("copy")} />
            ) : null
          }
        >
          {result.ok ? (
            <pre className="overflow-x-auto font-mono text-sm text-signal">
              {result.output}
            </pre>
          ) : (
            <p className="font-mono text-sm text-fault">
              {t(`error.${result.error}`)}
            </p>
          )}
        </Panel>
      }
    />
  );
}
