"use client";

import { runLiveMatch } from "@rfjs/filter-builder";
import { FilterTreeEditor, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  AiNlRow,
  MetadataStrip,
  RISE,
  SampleCard,
  useFilterBuilder,
  useOperatorLabels,
} from "@/tools/_filter-builder";

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
  const live = useMemo(() => runLiveMatch(fb.rows, fb.tree), [fb.rows, fb.tree]);

  const reverseText =
    fb.reverseError === "invalidJson"
      ? t("dfbReverseInvalidJson")
      : fb.reverseError === "invalidShape"
        ? t("dfbReverseInvalidShape")
        : null;

  return (
    <div className="flex flex-col gap-5">
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
      <section className="fb-rise rounded-lg border bg-card" style={{ animationDelay: "70ms" }}>
        <div className="border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t("dfbFields")}
          </span>
        </div>
        <div className="p-4">
          <MetadataStrip
            schema={fb.schema}
            onChange={fb.setSchema}
            labels={{
              include: t("dfbInclude", { field: "" }).trim(),
              type: t("dfbType", { field: "" }).trim(),
            }}
          />
        </div>
      </section>

      {/* Hero — the filter-logic canvas, with a live match stat */}
      <section className="fb-rise rounded-lg border bg-card" style={{ animationDelay: "140ms" }}>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t("dfbFilterLogic")}
          </span>
          <span className="flex items-baseline gap-1.5 tabular-nums">
            <span className="font-mono text-2xl font-semibold text-intake">{live.count}</span>
            <span className="font-mono text-sm text-muted-foreground">/ {fb.rows.length}</span>
            <span className="ml-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("dfbStatLabel")}
            </span>
          </span>
        </div>
        <div className="overflow-x-auto p-5 sm:p-6">
          <FilterTreeEditor
            group={fb.tree}
            engineId="data-filter"
            schema={fb.schema}
            onChange={fb.setTree}
            onCreateField={fb.onCreateField}
            labels={treeLabels}
          />
        </div>
      </section>

      {/* Data panel (collapsible) */}
      <div className="fb-rise" style={{ animationDelay: "210ms" }}>
        <DataPanel
          rows={fb.rows}
          matched={live.matched}
          canonicalJson={fb.canonicalJson}
          onCanonicalChange={fb.onCanonicalChange}
          aiRow={<AiNlRow schema={fb.schema} onApply={fb.onCanonicalChange} />}
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
