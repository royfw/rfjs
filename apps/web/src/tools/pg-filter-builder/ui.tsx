"use client";

import {
  getEngine,
  treeToFilterGroup,
  type FieldKind,
  type FieldSchema,
} from "@rfjs/filter-builder";
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

const SAMPLE = JSON.stringify(
  [
    {
      name: "Ada",
      age: 36,
      active: true,
      profile: { vip: true, tier: "gold" },
    },
    {
      name: "Bo",
      age: 12,
      active: false,
      profile: { vip: false, tier: "free" },
    },
  ],
  null,
  2,
);

// Top-level scalars read as real SQL columns; nested paths and object/array
// fields read as JSONB — so the tool opens on a genuinely mixed query.
const deriveKind = (f: FieldSchema): FieldKind =>
  f.dataType !== "object" && f.dataType !== "array" && !f.path.includes(".")
    ? "column"
    : "jsonb";

export function PgFilterBuilder() {
  const t = useTranslations("ToolUI");
  const operatorLabels = useOperatorLabels();
  const fb = useFilterBuilder({ sample: SAMPLE, deriveKind });

  const treeLabels: FilterTreeLabels = {
    logic: {
      and: t("pfbLogicAnd"),
      or: t("pfbLogicOr"),
      nor: t("pfbLogicNor"),
      not: t("pfbLogicNot"),
    },
    addCondition: t("pfbAddCondition"),
    addGroup: t("pfbAddGroup"),
    removeGroup: t("pfbRemoveGroup"),
    removeCondition: t("pfbRemoveCondition"),
    elemMatch: t("pfbElemMatch"),
    valueHint: t("pfbValueHint"),
    toggleGroup: t("pfbToggleGroup"),
    collapsedConditions: t("pfbCollapsedConditions"),
    collapsedGroups: t("pfbCollapsedGroups"),
    collapsedEmpty: t("pfbCollapsedEmpty"),
    operatorLabels,
  };

  const compiled = useMemo(
    () =>
      getEngine("pg-filter").compile(
        treeToFilterGroup(fb.tree),
        toCompileContext(fb.schema),
      ),
    [fb.tree, fb.schema],
  );

  const reverseText =
    fb.reverseError === "invalidJson"
      ? t("pfbReverseInvalidJson")
      : fb.reverseError === "invalidShape"
        ? t("pfbReverseInvalidShape")
        : null;

  return (
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
          sample: t("pfbSample"),
          invalidSample: t("pfbInvalidSample"),
          rawCount: t("pfbRaw", { count: fb.rows.length }),
          upload: t("pfbUpload"),
        }}
        style={{ animationDelay: "0ms" }}
      />

      <section
        className="fb-rise rounded-lg border bg-card"
        style={{ animationDelay: "70ms" }}
      >
        <div className="border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t("pfbFields")}
          </span>
        </div>
        <div className="flex flex-col gap-2 p-4">
          <MetadataStrip
            schema={fb.schema}
            onChange={fb.setSchema}
            showKind
            labels={{
              include: t("pfbInclude", { field: "" }).trim(),
              type: t("pfbType", { field: "" }).trim(),
              kind: t("pfbKind", { field: "" }).trim(),
            }}
          />
          <p className="font-mono text-[11px] text-muted-foreground">
            {t("pfbKindHint")}
          </p>
        </div>
      </section>

      <div className="fb-rise" style={{ animationDelay: "140ms" }}>
        <AiAssistBlock
          schema={fb.schema}
          canonicalJson={fb.canonicalJson}
          compiled={compiled.ok ? compiled.primary : null}
          engineId="pg-filter"
          onApply={fb.onCanonicalChange}
          sampleRows={fb.rows}
          logKey="rfjs.ai.log.pg-filter-builder"
        />
      </div>

      <section
        className="fb-rise rounded-lg border bg-card"
        style={{ animationDelay: "140ms" }}
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t("pfbFilterLogic")}
          </span>
        </div>
        <div className="overflow-x-auto p-5 sm:p-6">
          <FilterTreeEditor
            group={fb.tree}
            engineId="pg-filter"
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
            output: t("pfbOutput"),
            primaryLabel: t("pfbWhere"),
            secondaryLabel: t("pfbValues"),
            canonical: t("pfbCanonical"),
            canonicalHint: t("pfbCanonicalHint"),
            reverseError: reverseText,
            compileError: compiled.ok
              ? null
              : t("pfbCompileError", { error: compiled.error }),
            copy: t("pfbCopy"),
          }}
        />
      </div>
    </div>
  );
}
