"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@rfjs/web-ui/components/button";
import { Input } from "@rfjs/web-ui/components/input";
import type { FieldSchema } from "@rfjs/filter-builder";

import { useAiAssist } from "@/lib/ai/use-ai-assist";
import { buildNlFilterPrompt, parseNlFilterResponse } from "./ai-nl-filter";

export function AiNlRow({ schema, onApply }: { schema: FieldSchema[]; onApply: (canonicalJson: string) => void }) {
  const t = useTranslations("ToolUI");
  const ai = useAiAssist();
  const [nl, setNl] = React.useState("");

  const onGenerate = async () => {
    if (!nl.trim()) return;
    const prompt = buildNlFilterPrompt(nl, schema);
    const out = await ai.run({ ...prompt, json: true }, parseNlFilterResponse);
    if (out !== null) onApply(out);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={nl}
          placeholder={t("aiNlPlaceholder")}
          onChange={(e) => setNl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onGenerate();
          }}
        />
        {ai.loading ? (
          <Button size="sm" variant="outline" onClick={ai.cancel}>
            {t("aiCancel")}
          </Button>
        ) : (
          <Button size="sm" onClick={() => void onGenerate()} disabled={!ai.ready}>
            {t("aiGenerate")}
          </Button>
        )}
      </div>
      {!ai.ready ? <p className="text-xs text-muted-foreground">{t("aiNotConfigured")}</p> : null}
      {ai.error ? (
        <div role="alert" className="text-xs text-fault">
          <p>
            [{ai.error.kind}] {ai.error.message}
          </p>
          {ai.error.kind === "parse" && ai.error.detail ? (
            <details>
              <summary>{t("aiViewRaw")}</summary>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs">{ai.error.detail}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
