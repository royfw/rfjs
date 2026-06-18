"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { treeToFilterGroup, ENGINE_IDS, getEngine, addInferredField, runLiveMatch, filterGroupToTree, mergeFieldsFromTree, parseFilterGroup, inferSchema, emptyGroup } from "@rfjs/filter-builder";
import type { EngineId, ReverseError, BuilderGroup, FieldSchema } from "@rfjs/filter-builder";

import { FilterTreeEditor, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import { CanonicalEditor } from "./canonical-editor";
import { PreviewPanel, LiveMatchView } from "./preview-panel";
import { SchemaPanel } from "./schema-panel";
import { ThreePane } from "./three-pane";

const SAMPLE = JSON.stringify(
  [
    { name: "Ada", age: 36, active: true, tags: ["ml", "math"] },
    { name: "Bo", age: 12, active: false, tags: ["games"] },
  ],
  null,
  2,
);

const id = () => crypto.randomUUID();

export function QueryBuilder() {
  const t = useTranslations("ToolUI");
  const treeLabels: FilterTreeLabels = {
    logic: { and: "全部成立 / All", or: "擇一成立 / Any", nor: "皆不成立 / None", not: "非全部 / Not all" },
    addCondition: "+ 條件",
    addGroup: "+ 群組",
    removeGroup: "remove group",
    removeCondition: "remove condition",
    elemMatch: t("elemMatchPlaceholder"),
  };
  const [sampleText, setSampleText] = useState(SAMPLE);
  const [schema, setSchema] = useState<FieldSchema[]>(() => safeInfer(SAMPLE).schema);
  const [error, setError] = useState<string | null>(() => safeInfer(SAMPLE).error);
  const [engineId, setEngineId] = useState<EngineId>("pg-filter");
  const [tree, setTree] = useState<BuilderGroup>(() => emptyGroup(id));
  const [reverseError, setReverseError] = useState<ReverseError | null>(null);

  function onReverseParse(text: string) {
    if (text.trim() === "") {
      setReverseError(null);
      return;
    }
    const r = parseFilterGroup(text);
    if (r.ok) {
      setTree(filterGroupToTree(r.group, id));
      setSchema((s) => mergeFieldsFromTree(s, r.group));
      setReverseError(null);
    } else {
      setReverseError(r.error);
    }
  }

  function onSample(text: string) {
    setSampleText(text);
    const { schema: next, error: err } = safeInfer(text);
    setError(err);
    if (!err) setSchema(next);
  }

  const rows = useMemo(() => parseRows(sampleText), [sampleText]);
  const output = useMemo(
    () =>
      getEngine(engineId).compile(treeToFilterGroup(tree), {
        fields: schema.map((f) => ({
          path: f.path,
          kind: f.kind,
          dataType: f.dataType,
          elementType: f.elementType,
        })),
      }),
    [engineId, tree, schema],
  );
  const live = useMemo(() => runLiveMatch(rows, tree), [rows, tree]);

  return (
    <ThreePane
      source={
        <SchemaPanel
          sampleText={sampleText}
          schema={schema}
          error={error}
          onSampleChange={onSample}
          onSchemaChange={setSchema}
        />
      }
      builder={
        <Panel title={t("builder")}>
          <FilterTreeEditor
            group={tree}
            engineId={engineId}
            schema={schema}
            onChange={setTree}
            onCreateField={(path) => setSchema((s) => addInferredField(s, path))}
            labels={treeLabels}
          />
        </Panel>
      }
      output={
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {ENGINE_IDS.map((eid) => (
              <Button
                key={eid}
                size="sm"
                variant={eid === engineId ? "default" : "outline"}
                onClick={() => setEngineId(eid)}
              >
                {getEngine(eid).label}
              </Button>
            ))}
          </div>
          {engineId === "data-filter" ? (
            <>
              <CanonicalEditor
                serialized={JSON.stringify(treeToFilterGroup(tree), null, 2)}
                errorText={
                  reverseError === "invalidJson"
                    ? t("reverseInvalidJson")
                    : reverseError === "invalidShape"
                      ? t("reverseInvalidShape")
                      : null
                }
                hint={t("canonicalEditable")}
                onParse={onReverseParse}
              />
              <LiveMatchView live={live} />
            </>
          ) : (
            <PreviewPanel output={output} live={live} />
          )}
        </div>
      }
    />
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
