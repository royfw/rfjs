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
import { ToolIntro } from "@/components/shared/tool-intro";

const SAMPLE = JSON.stringify(
  [
    { name: "Ada", age: 36, active: true, tags: ["ml", "math"] },
    { name: "Bo", age: 12, active: false, tags: ["games"] },
  ],
  null,
  2,
);

export function SqlFilterBuilder() {
  const t = useTranslations("ToolUI");
  const operatorLabels = useOperatorLabels();
  const fb = useFilterBuilder({ sample: SAMPLE });

  const treeLabels: FilterTreeLabels = {
    logic: {
      and: t("sfbLogicAnd"),
      or: t("sfbLogicOr"),
      nor: t("sfbLogicNor"),
      not: t("sfbLogicNot"),
    },
    addCondition: t("sfbAddCondition"),
    addGroup: t("sfbAddGroup"),
    removeGroup: t("sfbRemoveGroup"),
    removeCondition: t("sfbRemoveCondition"),
    elemMatch: t("sfbElemMatch"),
    valueHint: t("sfbValueHint"),
    toggleGroup: t("sfbToggleGroup"),
    collapsedConditions: t("sfbCollapsedConditions"),
    collapsedGroups: t("sfbCollapsedGroups"),
    collapsedEmpty: t("sfbCollapsedEmpty"),
    operatorLabels,
  };

  const compiled = useMemo(
    () =>
      getEngine("sql-filter").compile(
        treeToFilterGroup(fb.tree),
        toCompileContext(fb.schema),
      ),
    [fb.tree, fb.schema],
  );

  const reverseText =
    fb.reverseError === "invalidJson"
      ? t("sfbReverseInvalidJson")
      : fb.reverseError === "invalidShape"
        ? t("sfbReverseInvalidShape")
        : null;

  return (
    <div className="flex flex-col gap-4">
      <ToolIntro
        storageKey="tool-intro:sql-filter-builder"
        question={t("introQuestion")}
        tagline={t("sfbIntroTagline")}
        concepts={[
          { term: t("sfbIntroC1t"), desc: t("sfbIntroC1d") },
          { term: t("sfbIntroC2t"), desc: t("sfbIntroC2d") },
          { term: t("sfbIntroC3t"), desc: t("sfbIntroC3d") },
        ]}
        labels={{
          expand: t("introExpand"),
          collapse: t("introCollapse"),
          dismiss: t("introDismiss"),
        }}
      />
      <div className="flex flex-col gap-5">
        <style>{RISE}</style>

        <SampleCard
          open={fb.sampleOpen}
          onToggle={() => fb.setSampleOpen((v) => !v)}
          value={fb.sampleText}
          onChange={fb.onSample}
          onUpload={(file) => void fb.onUpload(file)}
          hasError={Boolean(fb.error)}
          labels={{
            sample: t("sfbSample"),
            invalidSample: t("sfbInvalidSample"),
            rawCount: t("sfbRaw", { count: fb.rows.length }),
            upload: t("sfbUpload"),
          }}
          style={{ animationDelay: "0ms" }}
        />

        <section
          className="fb-rise rounded-lg border bg-card"
          style={{ animationDelay: "70ms" }}
        >
          <div className="border-b px-5 py-3">
            <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              {t("sfbFields")}
            </span>
          </div>
          <div className="p-4">
            <MetadataStrip
              schema={fb.schema}
              onChange={fb.setSchema}
              labels={{
                include: t("sfbInclude", { field: "" }).trim(),
                type: t("sfbType", { field: "" }).trim(),
              }}
            />
          </div>
        </section>

        <div className="fb-rise" style={{ animationDelay: "140ms" }}>
          <AiAssistBlock
            schema={fb.schema}
            canonicalJson={fb.canonicalJson}
            compiled={compiled.ok ? compiled.primary : null}
            engineId="sql-filter"
            onApply={fb.onCanonicalChange}
            sampleRows={fb.rows}
            logKey="rfjs.ai.log.sql-filter-builder"
          />
        </div>

        <section
          className="fb-rise rounded-lg border bg-card"
          style={{ animationDelay: "140ms" }}
        >
          <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
            <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              {t("sfbFilterLogic")}
            </span>
          </div>
          <div className="overflow-x-auto p-5 sm:p-6">
            <FilterTreeEditor
              group={fb.tree}
              engineId="sql-filter"
              schema={fb.schema}
              onChange={fb.setTree}
              onCreateField={fb.onCreateField}
              labels={treeLabels}
            />
          </div>
        </section>

        <div className="fb-rise" style={{ animationDelay: "210ms" }}>
          <QueryOutputPanel
            primary={compiled.ok ? compiled.primary : null}
            secondary={compiled.ok ? (compiled.secondary ?? null) : null}
            canonicalJson={fb.canonicalJson}
            onCanonicalChange={fb.onCanonicalChange}
            labels={{
              output: t("sfbOutput"),
              primaryLabel: t("sfbWhere"),
              secondaryLabel: t("sfbValues"),
              canonical: t("sfbCanonical"),
              canonicalHint: t("sfbCanonicalHint"),
              reverseError: reverseText,
              compileError: compiled.ok
                ? null
                : t("sfbCompileError", { error: compiled.error }),
              copy: t("sfbCopy"),
            }}
          />
        </div>
      </div>
    </div>
  );
}
