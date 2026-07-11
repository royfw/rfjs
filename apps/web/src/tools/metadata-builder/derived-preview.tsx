"use client";

import * as React from "react";

import { fieldsToFilterSchema } from "@rfjs/table-builder-ui";
import { emptyGroup, type BuilderGroup } from "@rfjs/filter-builder";
import { FilterTreeEditor, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import { parseDataResourceMeta, type DataResourceMeta } from "@rfjs/data-schema";
import { Button } from "@rfjs/web-ui/components/button";

export interface DerivedPreviewLabels {
  metaTitle: string;
  schemaTitle: string;
  tryTitle: string;
  emptySchema: string;
  copy: string;
  copied: string;
  download: string;
  reset: string;
}

// 恆在預覽(design spec 預覽區):meta 的正規化 JSON + fieldsToFilterSchema 投影 + 吃該 schema 的
// 即時試篩樹。編輯器產生的 meta 理論上恆合法,parse 仍用 try/catch 包住 —— 避免任何邊界情況白屏。
export function DerivedPreview({
  meta,
  onReset,
  labels,
  treeLabels,
}: {
  meta: DataResourceMeta;
  onReset: () => void;
  labels: DerivedPreviewLabels;
  treeLabels: FilterTreeLabels;
}) {
  const [copied, setCopied] = React.useState(false);
  const [tree, setTree] = React.useState<BuilderGroup>(() => emptyGroup(() => crypto.randomUUID()));

  const jsonResult = React.useMemo(() => {
    try {
      return { json: JSON.stringify(parseDataResourceMeta(meta), null, 2), error: undefined };
    } catch (err) {
      return { json: undefined, error: err instanceof Error ? err.message : String(err) };
    }
  }, [meta]);

  const schema = React.useMemo(() => fieldsToFilterSchema(meta.fields), [meta.fields]);

  // meta 變更(內容或投影)使先前的 "Copied" 確認失效。
  React.useEffect(() => setCopied(false), [jsonResult.json]);

  const onCopy = async () => {
    if (jsonResult.json === undefined) return;
    try {
      await navigator.clipboard.writeText(jsonResult.json);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const onDownload = () => {
    if (jsonResult.json === undefined) return;
    const url = URL.createObjectURL(new Blob([jsonResult.json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "meta.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="xs" variant="outline" onClick={() => void onCopy()} disabled={jsonResult.json === undefined}>
          {copied ? labels.copied : labels.copy}
        </Button>
        <Button size="xs" variant="outline" onClick={onDownload} disabled={jsonResult.json === undefined}>
          {labels.download}
        </Button>
        <Button size="xs" variant="outline" onClick={onReset}>
          {labels.reset}
        </Button>
      </div>

      {jsonResult.error !== undefined && (
        <p className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">{jsonResult.error}</p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{labels.metaTitle}</p>
          <pre data-testid="meta-json" className="max-h-80 overflow-auto rounded-md bg-muted/30 p-3 font-mono text-xs">
            {jsonResult.json ?? ""}
          </pre>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">{labels.schemaTitle}</p>
            <pre data-testid="schema-json" className="max-h-40 overflow-auto rounded-md bg-muted/30 p-3 font-mono text-xs">
              {JSON.stringify(schema, null, 2)}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">{labels.tryTitle}</p>
            {schema.length === 0 ? (
              <p className="text-xs text-muted-foreground">{labels.emptySchema}</p>
            ) : (
              <FilterTreeEditor
                group={tree}
                engineId="pg-filter"
                schema={schema}
                onChange={setTree}
                onCreateField={() => {}}
                labels={treeLabels}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
