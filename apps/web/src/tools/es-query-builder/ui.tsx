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
  useOperatorLabels,
} from "@/tools/_filter-builder";

const SAMPLE = JSON.stringify(
  [
    { status: "open", age: 36, active: true, tags: ["ml", "math"] },
    { status: "closed", age: 12, active: false, tags: ["games"] },
  ],
  null,
  2,
);

export function EsQueryBuilder() {
  const t = useTranslations("ToolUI");
  const operatorLabels = useOperatorLabels();
  const fb = useFilterBuilder({ sample: SAMPLE });

  const treeLabels: FilterTreeLabels = {
    logic: {
      and: t("eqbLogicAnd"),
      or: t("eqbLogicOr"),
      nor: t("eqbLogicNor"),
      not: t("eqbLogicNot"),
    },
    addCondition: t("eqbAddCondition"),
    addGroup: t("eqbAddGroup"),
    removeGroup: t("eqbRemoveGroup"),
    removeCondition: t("eqbRemoveCondition"),
    elemMatch: t("eqbElemMatch"),
    valueHint: t("eqbValueHint"),
    toggleGroup: t("eqbToggleGroup"),
    collapsedConditions: t("eqbCollapsedConditions"),
    collapsedGroups: t("eqbCollapsedGroups"),
    collapsedEmpty: t("eqbCollapsedEmpty"),
    operatorLabels,
  };

  const compiled = useMemo(
    () => getEngine("es-query").compile(treeToFilterGroup(fb.tree), toCompileContext(fb.schema)),
    [fb.tree, fb.schema],
  );

  const reverseText =
    fb.reverseError === "invalidJson"
      ? t("eqbReverseInvalidJson")
      : fb.reverseError === "invalidShape"
        ? t("eqbReverseInvalidShape")
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
          sample: t("eqbSample"),
          invalidSample: t("eqbInvalidSample"),
          rawCount: t("eqbRaw", { count: fb.rows.length }),
          upload: t("eqbUpload"),
        }}
        style={{ animationDelay: "0ms" }}
      />

      <section className="fb-rise rounded-lg border bg-card" style={{ animationDelay: "70ms" }}>
        <div className="border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t("eqbFields")}
          </span>
        </div>
        <div className="p-4">
          <MetadataStrip
            schema={fb.schema}
            onChange={fb.setSchema}
            labels={{
              include: t("eqbInclude", { field: "" }).trim(),
              type: t("eqbType", { field: "" }).trim(),
            }}
          />
        </div>
      </section>

      <section className="fb-rise rounded-lg border bg-card" style={{ animationDelay: "140ms" }}>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t("eqbFilterLogic")}
          </span>
        </div>
        <div className="overflow-x-auto p-5 sm:p-6">
          <FilterTreeEditor
            group={fb.tree}
            engineId="es-query"
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
            output: t("eqbOutput"),
            primaryLabel: t("eqbQuery"),
            secondaryLabel: "",
            canonical: t("eqbCanonical"),
            canonicalHint: t("eqbCanonicalHint"),
            reverseError: reverseText,
            compileError: compiled.ok ? null : t("eqbCompileError", { error: compiled.error }),
            copy: t("eqbCopy"),
          }}
        />
      </div>
    </div>
  );
}
