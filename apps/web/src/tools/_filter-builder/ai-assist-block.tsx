"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import type { FieldSchema } from "@rfjs/filter-builder";

import { AiPanel, useAiAssist, type AiPanelAction } from "@rfjs/ai-assist-ui";
import { useAiPanelLabels } from "@/components/shared/ai-panel-labels";
import { buildNlFilterPrompt, parseNlFilterResponse } from "./ai-nl-filter";
import {
  buildAskPrompt,
  buildExplainPrompt,
  type ExplainContext,
} from "./ai-explain";

/** 簡單葉數:遞迴數 filters 內非 group 的條件(「已套用(N 個條件)」用)。 */
function countConditions(json: string): number {
  try {
    const walk = (g: unknown): number => {
      if (
        typeof g !== "object" ||
        g === null ||
        !Array.isArray((g as { filters?: unknown[] }).filters)
      )
        return 0;
      return (g as { filters: unknown[] }).filters.reduce<number>(
        (n, f) =>
          n +
          (typeof f === "object" && f !== null && "filters" in f ? walk(f) : 1),
        0,
      );
    };
    return walk(JSON.parse(json));
  } catch {
    return 0;
  }
}

export function AiAssistBlock({
  schema,
  canonicalJson,
  compiled,
  engineId,
  onApply,
  logKey,
  sampleRows,
}: {
  schema: FieldSchema[];
  canonicalJson: string;
  compiled: string | null;
  engineId: string;
  onApply: (canonicalJson: string) => void;
  logKey: string;
  /** 工具頁目前的樣本資料;prompt 只帶前 AI_SAMPLE_LIMIT 筆(見 ai-explain.ts)。 */
  sampleRows?: unknown[];
}) {
  const t = useTranslations("ToolUI");
  const locale = useLocale();
  const ai = useAiAssist();
  const aiLabels = useAiPanelLabels();
  const ctx: ExplainContext = {
    canonicalJson,
    schema,
    compiled,
    engineId,
    locale,
    sampleRows,
  };

  const actions: AiPanelAction[] = [
    {
      key: "generate",
      label: t("aiGenerate"),
      needsInput: true,
      primary: true,
      run: async (input) => {
        const prompt = buildNlFilterPrompt(
          input,
          schema,
          canonicalJson,
          sampleRows,
        );
        const out = await ai.run(
          { ...prompt, json: true },
          parseNlFilterResponse,
        );
        if (out === null) return null;
        onApply(out);
        return { kind: "generate", prompt: input, appliedJson: out };
      },
    },
    {
      key: "ask",
      label: t("aiAsk"),
      needsInput: true,
      run: async (input) => {
        const out = await ai.runStream(buildAskPrompt(ctx, input), (raw) =>
          raw.trim(),
        );
        return out === null
          ? null
          : { kind: "ask", prompt: input, answer: out };
      },
    },
    {
      key: "explain",
      label: t("aiExplain"),
      run: async () => {
        const out = await ai.runStream(buildExplainPrompt(ctx), (raw) =>
          raw.trim(),
        );
        return out === null ? null : { kind: "explain", answer: out };
      },
    },
  ];

  return (
    <AiPanel
      title={t("aiBlockTitle")}
      placeholder={t("aiBlockPlaceholder")}
      actions={actions}
      logKey={logKey}
      ai={ai}
      labels={aiLabels}
      onReapply={(e) => onApply(e.appliedJson ?? "")}
      appliedSummary={(e) =>
        t("aiApplied", { count: countConditions(e.appliedJson ?? "") })
      }
    />
  );
}
