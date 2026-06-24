"use client";

import { getEngine, treeToFilterGroup } from "@rfjs/filter-builder";
import { FilterTreeEditor, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  MetadataStrip,
  QueryOutputPanel,
  RISE,
  SampleCard,
  toCompileContext,
  useFilterBuilder,
} from "@/tools/_filter-builder";

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
  };

  const compiled = useMemo(
    () => getEngine("jsonb").compile(treeToFilterGroup(fb.tree), toCompileContext(fb.schema)),
    [fb.tree, fb.schema],
  );

  const reverseText =
    fb.reverseError === "invalidJson"
      ? t("jqbReverseInvalidJson")
      : fb.reverseError === "invalidShape"
        ? t("jqbReverseInvalidShape")
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
          sample: t("jqbSample"),
          invalidSample: t("jqbInvalidSample"),
          rawCount: t("jqbRaw", { count: fb.rows.length }),
          upload: t("jqbUpload"),
        }}
        style={{ animationDelay: "0ms" }}
      />

      <section className="fb-rise rounded-lg border bg-card" style={{ animationDelay: "70ms" }}>
        <div className="border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t("jqbFields")}
          </span>
        </div>
        <div className="p-4">
          <MetadataStrip
            schema={fb.schema}
            onChange={fb.setSchema}
            labels={{
              include: t("jqbInclude", { field: "" }).trim(),
              type: t("jqbType", { field: "" }).trim(),
            }}
          />
        </div>
      </section>

      <section className="fb-rise rounded-lg border bg-card" style={{ animationDelay: "140ms" }}>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t("jqbFilterLogic")}
          </span>
        </div>
        <div className="overflow-x-auto p-5 sm:p-6">
          <FilterTreeEditor
            group={fb.tree}
            engineId="jsonb"
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
            output: t("jqbOutput"),
            primaryLabel: t("jqbWhere"),
            secondaryLabel: t("jqbValues"),
            canonical: t("jqbCanonical"),
            canonicalHint: t("jqbCanonicalHint"),
            reverseError: reverseText,
            compileError: compiled.ok ? null : t("jqbCompileError", { error: compiled.error }),
            copy: t("jqbCopy"),
          }}
        />
      </div>
    </div>
  );
}
