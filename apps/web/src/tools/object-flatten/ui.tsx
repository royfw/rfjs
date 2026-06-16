"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { flattenJson } from "./object-flatten";

import { ToolShell } from "@/tools/_shared/tool-shell";

const SAMPLE = `{
  "user": {
    "name": "Ada",
    "roles": ["admin", "dev"]
  },
  "active": true
}`;

export function ObjectFlatten() {
  const t = useTranslations("ToolUI");
  const [text, setText] = useState(SAMPLE);
  const result = flattenJson(text);

  return (
    <ToolShell
      operation="flatten()"
      input={
        <Panel title={t("jsonInput")}>
          <textarea
            aria-label={t("jsonInput")}
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
          action={result.ok ? <CopyButton text={result.output} label={t("copy")} /> : null}
        >
          {result.ok ? (
            <pre className="overflow-x-auto font-mono text-sm text-signal">{result.output}</pre>
          ) : (
            <p className="font-mono text-sm text-fault">{t(`error.${result.error}`)}</p>
          )}
        </Panel>
      }
    />
  );
}
