"use client";

import { runLiveMatch } from "@rfjs/filter-builder";
import {
  FilterTreeEditor,
  type FilterTreeLabels,
} from "@rfjs/filter-builder-ui";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  AiAssistBlock,
  MetadataStrip,
  RISE,
  SampleCard,
  useFilterBuilder,
  useOperatorLabels,
} from "@/tools/_filter-builder";
import { SectionCard } from "@/components/shared/section-card";
import { ToolEyebrow } from "@/components/shared/tool-eyebrow";
import { ToolIntro } from "@/components/shared/tool-intro";

import { DataPanel } from "./ui/data-panel";

const SAMPLE = JSON.stringify(
  [
    { name: "Ada", age: 36, active: true, tags: ["ml", "math"] },
    { name: "Bo", age: 12, active: false, tags: ["games"] },
  ],
  null,
  2,
);

export function DataFilterBuilder() {
  const t = useTranslations("ToolUI");
  const operatorLabels = useOperatorLabels();

  const treeLabels: FilterTreeLabels = {
    logic: {
      and: t("dfbLogicAnd"),
      or: t("dfbLogicOr"),
      nor: t("dfbLogicNor"),
      not: t("dfbLogicNot"),
    },
    addCondition: t("dfbAddCondition"),
    addGroup: t("dfbAddGroup"),
    removeGroup: t("dfbRemoveGroup"),
    removeCondition: t("dfbRemoveCondition"),
    elemMatch: t("dfbElemMatch"),
    valueHint: t("dfbValueHint"),
    toggleGroup: t("dfbToggleGroup"),
    collapsedConditions: t("dfbCollapsedConditions"),
    collapsedGroups: t("dfbCollapsedGroups"),
    collapsedEmpty: t("dfbCollapsedEmpty"),
    operatorLabels,
  };

  const fb = useFilterBuilder({ sample: SAMPLE });

  // Live in-memory match is data-filter's unique output; it stays in this tool.
  const live = useMemo(
    () => runLiveMatch(fb.rows, fb.tree),
    [fb.rows, fb.tree],
  );

  const reverseText =
    fb.reverseError === "invalidJson"
      ? t("dfbReverseInvalidJson")
      : fb.reverseError === "invalidShape"
        ? t("dfbReverseInvalidShape")
        : null;

  return (
    <div className="flex flex-col gap-4">
      <ToolEyebrow>{t("dfbEyebrow")}</ToolEyebrow>
      <ToolIntro
        storageKey="tool-intro:data-filter-builder"
        question={t("introQuestion")}
        tagline={t("dfbIntroTagline")}
        concepts={[
          { term: t("dfbIntroC1t"), desc: t("dfbIntroC1d") },
          { term: t("dfbIntroC2t"), desc: t("dfbIntroC2d") },
          { term: t("dfbIntroC3t"), desc: t("dfbIntroC3d") },
        ]}
        labels={{
          expand: t("introExpand"),
          collapse: t("introCollapse"),
          dismiss: t("introDismiss"),
        }}
      />
      <style>{RISE}</style>

      {/* Sample JSON — demoted to a collapsible source */}
      <SampleCard
        open={fb.sampleOpen}
        onToggle={() => fb.setSampleOpen((v) => !v)}
        value={fb.sampleText}
        onChange={fb.onSample}
        onUpload={fb.onUpload}
        hasError={fb.error !== null}
        labels={{
          sample: t("dfbSample"),
          invalidSample: t("dfbInvalidSample"),
          rawCount: t("dfbRaw", { count: fb.rows.length }),
          upload: t("dfbUpload"),
        }}
        style={{ animationDelay: "0ms" }}
      />

      {/* Metadata converter — framed like the hero card */}
      <SectionCard
        title={t("dfbFields")}
        className="fb-rise"
        style={{ animationDelay: "70ms" }}
      >
        <MetadataStrip
          schema={fb.schema}
          onChange={fb.setSchema}
          labels={{
            include: t("dfbInclude", { field: "" }).trim(),
            type: t("dfbType", { field: "" }).trim(),
          }}
        />
      </SectionCard>

      {/* Hero — the filter-logic canvas, with a live match stat */}
      <div className="fb-rise" style={{ animationDelay: "140ms" }}>
        <AiAssistBlock
          schema={fb.schema}
          canonicalJson={fb.canonicalJson}
          compiled={null}
          engineId="data-filter"
          onApply={fb.onCanonicalChange}
          sampleRows={fb.rows}
          logKey="rfjs.ai.log.data-filter-builder"
        />
      </div>

      <SectionCard
        title={t("dfbFilterLogic")}
        className="fb-rise"
        style={{ animationDelay: "140ms" }}
        bodyClassName="overflow-x-auto p-5 sm:p-6"
        action={
          <span className="flex items-baseline gap-1.5 tabular-nums">
            <span className="font-mono text-2xl font-semibold text-intake">
              {live.count}
            </span>
            <span className="font-mono text-sm text-muted-foreground">
              / {fb.rows.length}
            </span>
            <span className="ml-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("dfbStatLabel")}
            </span>
          </span>
        }
      >
        <FilterTreeEditor
          group={fb.tree}
          engineId="data-filter"
          schema={fb.schema}
          onChange={fb.setTree}
          onCreateField={fb.onCreateField}
          labels={treeLabels}
        />
      </SectionCard>

      {/* Data panel (collapsible) */}
      <div className="fb-rise" style={{ animationDelay: "210ms" }}>
        <DataPanel
          rows={fb.rows}
          matched={live.matched}
          canonicalJson={fb.canonicalJson}
          onCanonicalChange={fb.onCanonicalChange}
          error={reverseText}
          labels={{
            data: t("dfbData"),
            counts: t("dfbCounts", { raw: "{raw}", matched: "{matched}" }),
            raw: t("dfbRaw", { count: fb.rows.length }),
            matched: t("dfbMatched", { count: live.count }),
            json: t("dfbJson"),
            empty: t("dfbEmpty"),
            canonicalHint: t("dfbCanonicalHint"),
            copy: t("dfbCopy"),
          }}
        />
      </div>
    </div>
  );
}
