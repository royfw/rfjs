"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Textarea } from "@rfjs/web-ui/components/textarea";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { flattenJson } from "./object-flatten";

import { SectionCard } from "@/components/shared/section-card";
import { ToolEyebrow } from "@/components/shared/tool-eyebrow";
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
      <ToolEyebrow>{t("oflEyebrow")}</ToolEyebrow>
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
          <SectionCard title={t("jsonInput")}>
            <Textarea
              aria-label={t("jsonInput")}
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
            action={result.ok ? <CopyButton text={result.output} label={t("copy")} /> : null}
          >
            {result.ok ? (
              <pre className="overflow-x-auto font-mono text-sm text-foreground">{result.output}</pre>
            ) : (
              <p className="font-mono text-sm text-fault">{t(`error.${result.error}`)}</p>
            )}
          </SectionCard>
        }
      />
    </div>
  );
}
