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

export function MongoQueryBuilder() {
  const t = useTranslations("ToolUI");
  const fb = useFilterBuilder({ sample: SAMPLE });

  const treeLabels: FilterTreeLabels = {
    logic: {
      and: t("mqbLogicAnd"),
      or: t("mqbLogicOr"),
      nor: t("mqbLogicNor"),
      not: t("mqbLogicNot"),
    },
    addCondition: t("mqbAddCondition"),
    addGroup: t("mqbAddGroup"),
    removeGroup: t("mqbRemoveGroup"),
    removeCondition: t("mqbRemoveCondition"),
    elemMatch: t("mqbElemMatch"),
    valueHint: t("mqbValueHint"),
  };

  const compiled = useMemo(
    () => getEngine("mongo").compile(treeToFilterGroup(fb.tree), toCompileContext(fb.schema)),
    [fb.tree, fb.schema],
  );

  const reverseText =
    fb.reverseError === "invalidJson"
      ? t("mqbReverseInvalidJson")
      : fb.reverseError === "invalidShape"
        ? t("mqbReverseInvalidShape")
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
          sample: t("mqbSample"),
          invalidSample: t("mqbInvalidSample"),
          rawCount: t("mqbRaw", { count: fb.rows.length }),
          upload: t("mqbUpload"),
        }}
        style={{ animationDelay: "0ms" }}
      />

      <section className="fb-rise rounded-lg border bg-card" style={{ animationDelay: "70ms" }}>
        <div className="border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t("mqbFields")}
          </span>
        </div>
        <div className="p-4">
          <MetadataStrip
            schema={fb.schema}
            onChange={fb.setSchema}
            labels={{
              include: t("mqbInclude", { field: "" }).trim(),
              type: t("mqbType", { field: "" }).trim(),
            }}
          />
        </div>
      </section>

      <section className="fb-rise rounded-lg border bg-card" style={{ animationDelay: "140ms" }}>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t("mqbFilterLogic")}
          </span>
        </div>
        <div className="overflow-x-auto p-5 sm:p-6">
          <FilterTreeEditor
            group={fb.tree}
            engineId="mongo"
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
            output: t("mqbOutput"),
            primaryLabel: t("mqbQuery"),
            secondaryLabel: "",
            canonical: t("mqbCanonical"),
            canonicalHint: t("mqbCanonicalHint"),
            reverseError: reverseText,
            compileError: compiled.ok
              ? null
              : compiled.error === "mongoNoNot"
                ? t("mqbNoNot")
                : t("mqbCompileError", { error: compiled.error }),
            copy: t("mqbCopy"),
          }}
        />
      </div>
    </div>
  );
}
