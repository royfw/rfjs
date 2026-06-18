"use client";

import { Textarea } from "@rfjs/web-ui/components/textarea";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  addInferredField,
  emptyGroup,
  filterGroupToTree,
  inferSchema,
  mergeFieldsFromTree,
  parseFilterGroup,
  runLiveMatch,
  treeToFilterGroup,
} from "@rfjs/filter-builder";
import type { BuilderGroup, FieldSchema, ReverseError } from "@rfjs/filter-builder";
import { FilterTreeEditor, type FilterTreeLabels } from "@rfjs/filter-builder-ui";

import { DataPanel } from "./ui/data-panel";
import { MetadataStrip } from "./ui/metadata-strip";

const SAMPLE = JSON.stringify(
  [
    { name: "Ada", age: 36, active: true, tags: ["ml", "math"] },
    { name: "Bo", age: 12, active: false, tags: ["games"] },
  ],
  null,
  2,
);

const id = () => crypto.randomUUID();

const RISE = `
@keyframes dfb-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.dfb-rise { animation: dfb-rise .45s cubic-bezier(.2,.7,.2,1) both; }
@media (prefers-reduced-motion: reduce) { .dfb-rise { animation: none; } }
`;

export function DataFilterBuilder() {
  const t = useTranslations("ToolUI");

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
  };

  const [sampleText, setSampleText] = useState(SAMPLE);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [schema, setSchema] = useState<FieldSchema[]>(() => safeInfer(SAMPLE).schema);
  const [error, setError] = useState<string | null>(() => safeInfer(SAMPLE).error);
  const [tree, setTree] = useState<BuilderGroup>(() => emptyGroup(id));

  // Canonical JSON editor state: the tree is the source of truth; the draft only
  // shadows it while the user is actively editing (avoids clobbering the cursor).
  const [jsonDraft, setJsonDraft] = useState<string | null>(null);
  const [reverseError, setReverseError] = useState<ReverseError | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const rows = useMemo(() => parseRows(sampleText), [sampleText]);
  const live = useMemo(() => runLiveMatch(rows, tree), [rows, tree]);
  const canonical = useMemo(() => JSON.stringify(treeToFilterGroup(tree), null, 2), [tree]);

  function onCanonicalChange(text: string) {
    setJsonDraft(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (text.trim() === "") {
        setReverseError(null);
        return;
      }
      const r = parseFilterGroup(text);
      if (r.ok) {
        setTree(filterGroupToTree(r.group, id));
        setSchema((s) => mergeFieldsFromTree(s, r.group));
        setReverseError(null);
        setJsonDraft(null); // tree now authoritative again
      } else {
        setReverseError(r.error);
      }
    }, 300);
  }

  function onSample(text: string) {
    setSampleText(text);
    const { schema: next, error: err } = safeInfer(text);
    setError(err);
    if (!err) setSchema(next);
  }

  const reverseText =
    reverseError === "invalidJson"
      ? t("dfbReverseInvalidJson")
      : reverseError === "invalidShape"
        ? t("dfbReverseInvalidShape")
        : null;

  return (
    <div className="flex flex-col gap-5">
      <style>{RISE}</style>

      {/* Sample JSON — demoted to a collapsible source */}
      <section className="dfb-rise rounded-lg border bg-card" style={{ animationDelay: "0ms" }}>
        <button
          type="button"
          onClick={() => setSampleOpen((v) => !v)}
          aria-expanded={sampleOpen}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="flex items-center gap-2">
            {sampleOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              {t("dfbSample")}
            </span>
          </span>
          {error ? (
            <span className="font-mono text-xs text-fault">{t("dfbInvalidSample")}</span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground">{t("dfbRaw", { count: rows.length })}</span>
          )}
        </button>
        {sampleOpen ? (
          <div className="border-t p-4">
            <Textarea
              aria-label={t("dfbSample")}
              value={sampleText}
              onChange={(e) => onSample(e.target.value)}
              spellCheck={false}
              rows={6}
              className="resize-y font-mono"
            />
            {error ? (
              <p className="mt-1 font-mono text-sm text-fault">{t("dfbInvalidSample")}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Metadata converter */}
      <div className="dfb-rise" style={{ animationDelay: "70ms" }}>
        <MetadataStrip
          schema={schema}
          onChange={setSchema}
          onInfer={() => {
            const { schema: next, error: err } = safeInfer(sampleText);
            if (!err) setSchema(next);
          }}
          labels={{
            fields: t("dfbFields"),
            infer: t("dfbInfer"),
            include: t("dfbInclude", { field: "" }).trim(),
            type: t("dfbType", { field: "" }).trim(),
          }}
        />
      </div>

      {/* Hero — the filter-logic canvas, with a live match stat */}
      <section className="dfb-rise rounded-lg border bg-card" style={{ animationDelay: "140ms" }}>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t("dfbFilterLogic")}
          </span>
          <span className="flex items-baseline gap-1.5 tabular-nums">
            <span className="font-mono text-2xl font-semibold text-intake">{live.count}</span>
            <span className="font-mono text-sm text-muted-foreground">/ {rows.length}</span>
            <span className="ml-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("dfbStatLabel")}
            </span>
          </span>
        </div>
        <div className="p-5 sm:p-6">
          <FilterTreeEditor
            group={tree}
            engineId="data-filter"
            schema={schema}
            onChange={setTree}
            onCreateField={(path) => setSchema((s) => addInferredField(s, path))}
            labels={treeLabels}
          />
        </div>
      </section>

      {/* Data panel (collapsible) */}
      <div className="dfb-rise" style={{ animationDelay: "210ms" }}>
        <DataPanel
          rows={rows}
          matched={live.matched}
          canonicalJson={jsonDraft ?? canonical}
          onCanonicalChange={onCanonicalChange}
          error={reverseText}
          labels={{
            data: t("dfbData"),
            counts: t("dfbCounts", { raw: "{raw}", matched: "{matched}" }),
            raw: t("dfbRaw", { count: rows.length }),
            matched: t("dfbMatched", { count: live.count }),
            json: t("dfbJson"),
            empty: t("dfbEmpty"),
            canonicalHint: t("dfbCanonicalHint"),
          }}
        />
      </div>
    </div>
  );
}

function parseRows(text: string): unknown[] {
  try {
    const data: unknown = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function safeInfer(text: string): { schema: FieldSchema[]; error: string | null } {
  try {
    return { schema: inferSchema(JSON.parse(text)), error: null };
  } catch {
    return { schema: [], error: "invalidJson" };
  }
}
