"use client";

import { getEngine, treeToFilterGroup } from "@rfjs/filter-builder";
import {
  FilterTreeEditor,
  type FilterTreeLabels,
} from "@rfjs/filter-builder-ui";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  AiAssistBlock,
  MetadataStrip,
  QueryOutputPanel,
  RISE,
  SampleCard,
  toCompileContext,
  useFilterBuilder,
  useOperatorLabels,
} from "@/tools/_filter-builder";
import { SectionCard } from "@/components/shared/section-card";
import { ToolEyebrow } from "@/components/shared/tool-eyebrow";
import { ToolIntro } from "@/components/shared/tool-intro";

const SAMPLE = JSON.stringify(
  [
    { name: "Ada", age: 36, active: true, tags: ["ml", "math"] },
    { name: "Bo", age: 12, active: false, tags: ["games"] },
  ],
  null,
  2,
);

export function JsonbQueryBuilder() {
  const t = useTranslations("ToolUI");
  const operatorLabels = useOperatorLabels();
  const fb = useFilterBuilder({ sample: SAMPLE });

  const treeLabels: FilterTreeLabels = {
    logic: {
      and: t("jqbLogicAnd"),
      or: t("jqbLogicOr"),
      nor: t("jqbLogicNor"),
      not: t("jqbLogicNot"),
    },
    addCondition: t("jqbAddCondition"),
    addGroup: t("jqbAddGroup"),
    removeGroup: t("jqbRemoveGroup"),
    removeCondition: t("jqbRemoveCondition"),
    elemMatch: t("jqbElemMatch"),
    valueHint: t("jqbValueHint"),
    toggleGroup: t("jqbToggleGroup"),
    collapsedConditions: t("jqbCollapsedConditions"),
    collapsedGroups: t("jqbCollapsedGroups"),
    collapsedEmpty: t("jqbCollapsedEmpty"),
    operatorLabels,
  };

  const compiled = useMemo(
    () =>
      getEngine("jsonb").compile(
        treeToFilterGroup(fb.tree),
        toCompileContext(fb.schema),
      ),
    [fb.tree, fb.schema],
  );

  const reverseText =
    fb.reverseError === "invalidJson"
      ? t("jqbReverseInvalidJson")
      : fb.reverseError === "invalidShape"
        ? t("jqbReverseInvalidShape")
        : null;

  return (
    <div className="flex flex-col gap-4">
      <ToolEyebrow>{t("jqbEyebrow")}</ToolEyebrow>
      <ToolIntro
        storageKey="tool-intro:jsonb-query-builder"
        question={t("introQuestion")}
        tagline={t("jqbIntroTagline")}
        concepts={[
          { term: t("jqbIntroC1t"), desc: t("jqbIntroC1d") },
          { term: t("jqbIntroC2t"), desc: t("jqbIntroC2d") },
          { term: t("jqbIntroC3t"), desc: t("jqbIntroC3d") },
        ]}
        labels={{
          expand: t("introExpand"),
          collapse: t("introCollapse"),
          dismiss: t("introDismiss"),
        }}
      />
      <style>{RISE}</style>

      <SampleCard
        open={fb.sampleOpen}
        onToggle={() => fb.setSampleOpen((v) => !v)}
        value={fb.sampleText}
        onChange={fb.onSample}
        onUpload={(file) => void fb.onUpload(file)}
        hasError={Boolean(fb.error)}
        labels={{
          sample: t("jqbSample"),
          invalidSample: t("jqbInvalidSample"),
          rawCount: t("jqbRaw", { count: fb.rows.length }),
          upload: t("jqbUpload"),
        }}
        style={{ animationDelay: "0ms" }}
      />

      <SectionCard
        title={t("jqbFields")}
        className="fb-rise"
        style={{ animationDelay: "70ms" }}
      >
        <MetadataStrip
          schema={fb.schema}
          onChange={fb.setSchema}
          labels={{
            include: t("jqbInclude", { field: "" }).trim(),
            type: t("jqbType", { field: "" }).trim(),
          }}
        />
      </SectionCard>

      <div className="fb-rise" style={{ animationDelay: "140ms" }}>
        <AiAssistBlock
          schema={fb.schema}
          canonicalJson={fb.canonicalJson}
          compiled={compiled.ok ? compiled.primary : null}
          engineId="jsonb"
          onApply={fb.onCanonicalChange}
          sampleRows={fb.rows}
          logKey="rfjs.ai.log.jsonb-query-builder"
        />
      </div>

      <SectionCard
        title={t("jqbFilterLogic")}
        className="fb-rise"
        style={{ animationDelay: "140ms" }}
        bodyClassName="p-4"
      >
        <div className="overflow-x-auto rounded-lg border border-dashed border-input p-4">
          <FilterTreeEditor
            group={fb.tree}
            engineId="jsonb"
            schema={fb.schema}
            onChange={fb.setTree}
            onCreateField={fb.onCreateField}
            labels={treeLabels}
          />
        </div>
      </SectionCard>

      <div className="fb-rise" style={{ animationDelay: "210ms" }}>
        <QueryOutputPanel
          primary={compiled.ok ? compiled.primary : null}
          secondary={compiled.ok ? (compiled.secondary ?? null) : null}
          canonicalJson={fb.canonicalJson}
          onCanonicalChange={fb.onCanonicalChange}
          labels={{
            output: t("jqbOutput"),
            primaryLabel: t("jqbWhere"),
            secondaryLabel: t("jqbValues"),
            canonical: t("jqbCanonical"),
            canonicalHint: t("jqbCanonicalHint"),
            reverseError: reverseText,
            compileError: compiled.ok
              ? null
              : t("jqbCompileError", { error: compiled.error }),
            copy: t("jqbCopy"),
          }}
        />
      </div>
    </div>
  );
}
