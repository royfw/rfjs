"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { Textarea } from "@rfjs/web-ui/components/textarea";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { flattenJson } from "./object-flatten";

import { ToolIntro } from "@/components/shared/tool-intro";
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
    <div className="flex flex-col gap-4">
      <ToolIntro
        storageKey="tool-intro:object-flatten"
        question={t("introQuestion")}
        tagline={t("oflIntroTagline")}
        concepts={[
          { term: t("oflIntroC1t"), desc: t("oflIntroC1d") },
          { term: t("oflIntroC2t"), desc: t("oflIntroC2d") },
        ]}
        labels={{ expand: t("introExpand"), collapse: t("introCollapse"), dismiss: t("introDismiss") }}
      />
      <ToolShell
        operation="flatten()"
        input={
          <Panel title={t("jsonInput")}>
            <Textarea
              aria-label={t("jsonInput")}
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              rows={10}
              className="resize-y font-mono"
            />
          </Panel>
        }
        output={
          <Panel
            title={t("output")}
            action={result.ok ? <CopyButton text={result.output} label={t("copy")} /> : null}
          >
            {result.ok ? (
              <pre className="overflow-x-auto font-mono text-sm text-foreground">{result.output}</pre>
            ) : (
              <p className="font-mono text-sm text-fault">{t(`error.${result.error}`)}</p>
            )}
          </Panel>
        }
      />
    </div>
  );
}
