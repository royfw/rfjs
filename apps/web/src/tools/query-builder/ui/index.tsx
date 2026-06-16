"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { treeToFilterGroup } from "@/tools/query-builder/logic/compile";
import { ENGINE_IDS, getEngine, type EngineId } from "@/tools/query-builder/logic/engines";
import { runLiveMatch } from "@/tools/query-builder/logic/live-match";
import { inferSchema } from "@/tools/query-builder/logic/schema-infer";
import { emptyGroup } from "@/tools/query-builder/logic/tree-ops";
import type { BuilderGroup, FieldSchema } from "@/tools/query-builder/logic/types";

import { ToolShell } from "@/tools/_shared/tool-shell";
import { GroupNode } from "./builder-tree";
import { PreviewPanel } from "./preview-panel";
import { SchemaPanel } from "./schema-panel";

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
  const [sampleText, setSampleText] = useState(SAMPLE);
  const [schema, setSchema] = useState<FieldSchema[]>(() => safeInfer(SAMPLE).schema);
  const [error, setError] = useState<string | null>(() => safeInfer(SAMPLE).error);
  const [engineId, setEngineId] = useState<EngineId>("jsonb");
  const [tree, setTree] = useState<BuilderGroup>(() => emptyGroup(id));

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
        fields: schema
          .filter((f) => f.include)
          .map((f) => ({ path: f.path, kind: f.kind, dataType: f.dataType, elementType: f.elementType })),
      }),
    [engineId, tree, schema],
  );
  const live = useMemo(() => runLiveMatch(rows, tree), [rows, tree]);

  return (
    <ToolShell
      operation="buildJsonbQuery() · matchQuery()"
      input={
        <div className="flex flex-col gap-3">
          <SchemaPanel
            sampleText={sampleText}
            schema={schema}
            error={error}
            onSampleChange={onSample}
            onSchemaChange={setSchema}
          />
          <Panel title={t("builder")}>
            <div className="mb-3 flex gap-2">
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
            <GroupNode group={tree} engineId={engineId} schema={schema} onChange={setTree} onCreateField={() => {}} />
          </Panel>
        </div>
      }
      output={<PreviewPanel output={output} live={live} />}
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
