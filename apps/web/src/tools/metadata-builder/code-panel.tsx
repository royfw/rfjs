"use client";

import * as React from "react";

import { fieldsToFilterSchema } from "@rfjs/table-builder-ui";
import { emptyGroup, type BuilderGroup } from "@rfjs/filter-builder";
import { FilterTreeEditor, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import { parseDataResourceMeta, type DataResourceMeta } from "@rfjs/data-schema";
import { Button } from "@rfjs/web-ui/components/button";
import { PanelRightClose } from "lucide-react";

export interface CodePanelLabels {
  metaTitle: string;
  schemaTitle: string;
  tryTitle: string;
  emptySchema: string;
  copy: string;
  copied: string;
  download: string;
  reset: string;
  collapse: string;
  expand: string;
  showAll: string;
  /** 收合鈕的可視短文字(aria-label 仍用 collapse)。 */
  collapseLabel: string;
  /** 片段狀態條的說明文字。 */
  viewingField: string;
}

export type CodePanelTab = "meta" | "schema" | "try";

// Pure token-wrapping colorizer (design spec §Studio right panel): wraps regex-matched JSON
// tokens (keys/string values/numbers/booleans/null) in colored spans without inserting or
// removing a single character — concatenating every returned piece must reproduce `json`
// exactly, which is what lets a test JSON.parse() the rendered <pre>'s textContent.
const JSON_TOKEN_RE =
  /("(?:\\.|[^"\\])*")(\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

export function colorJson(json: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let nodeKey = 0;
  let match: RegExpExecArray | null;
  JSON_TOKEN_RE.lastIndex = 0;
  while ((match = JSON_TOKEN_RE.exec(json)) !== null) {
    if (match.index > lastIndex) nodes.push(json.slice(lastIndex, match.index));
    const [full, keyStr, colonPart, strVal, num, lit] = match;
    if (keyStr !== undefined) {
      nodes.push(
        <span key={nodeKey++} className="text-sky-600 dark:text-sky-400">
          {keyStr}
        </span>,
      );
      if (colonPart) nodes.push(colonPart);
    } else if (strVal !== undefined) {
      nodes.push(
        <span key={nodeKey++} className="text-emerald-600 dark:text-emerald-400">
          {strVal}
        </span>,
      );
    } else if (num !== undefined || lit !== undefined) {
      nodes.push(
        <span key={nodeKey++} className="text-amber-600 dark:text-amber-400">
          {num ?? lit}
        </span>,
      );
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < json.length) nodes.push(json.slice(lastIndex));
  return nodes;
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 font-mono text-xs transition-colors ${
        active
          ? "bg-card font-semibold text-primary shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function FragmentBar({
  fieldKey,
  viewingLabel,
  showAllLabel,
  onShowAll,
}: {
  fieldKey: string;
  viewingLabel: string;
  showAllLabel: string;
  onShowAll: () => void;
}) {
  // 片段「狀態條」(polish mockup):金色淡底,說明+欄位名在左,顯示整份靠右。
  return (
    <div className="mb-2 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{viewingLabel}</span>
      <span className="font-mono font-semibold text-primary">{fieldKey}</span>
      <button
        type="button"
        className="ml-auto rounded-md border border-input bg-card px-2 py-0.5 hover:bg-muted/50"
        onClick={onShowAll}
      >
        {showAllLabel}
      </button>
    </div>
  );
}

// Controlled code panel (design spec §Studio right column): tab state lives in the parent
// (ui.tsx) so the collapsed bar can still show the active tab name and switching tabs survives
// a collapse/expand round trip. Fragment mode narrows the meta/schema tabs to the selected
// field when one is picked in the left field list — `showAll` is the escape hatch and resets
// whenever the selection changes (a stale "show all" pinned to the previous field would be
// confusing). Copy/Download always operate on the full document; only the *view* narrows.
export function CodePanel({
  meta,
  selectedFieldKey,
  tab,
  onTabChange,
  onReset,
  onCollapse,
  labels,
  treeLabels,
}: {
  meta: DataResourceMeta;
  selectedFieldKey: string | null;
  tab: CodePanelTab;
  onTabChange: (tab: CodePanelTab) => void;
  onReset: () => void;
  onCollapse: () => void;
  labels: CodePanelLabels;
  treeLabels: FilterTreeLabels;
}) {
  const [copied, setCopied] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [tree, setTree] = React.useState<BuilderGroup>(() => emptyGroup(() => crypto.randomUUID()));

  // A newly selected field starts back in fragment mode — "show all" doesn't carry over.
  React.useEffect(() => setShowAll(false), [selectedFieldKey]);

  const metaResult = React.useMemo(() => {
    try {
      return { value: parseDataResourceMeta(meta), error: undefined as string | undefined };
    } catch (err) {
      return { value: undefined, error: err instanceof Error ? err.message : String(err) };
    }
  }, [meta]);

  const fullJson = React.useMemo(
    () => (metaResult.value === undefined ? undefined : JSON.stringify(metaResult.value, null, 2)),
    [metaResult.value],
  );

  const schema = React.useMemo(() => fieldsToFilterSchema(meta.fields), [meta.fields]);
  const fullSchemaJson = React.useMemo(() => JSON.stringify(schema, null, 2), [schema]);

  const metaFragmentJson = React.useMemo(() => {
    if (selectedFieldKey === null || metaResult.value === undefined) return undefined;
    const field = metaResult.value.fields.find((f) => f.key === selectedFieldKey);
    return field === undefined ? undefined : JSON.stringify(field, null, 2);
  }, [metaResult.value, selectedFieldKey]);

  const schemaFragmentJson = React.useMemo(() => {
    if (selectedFieldKey === null) return undefined;
    const entry = schema.find((s) => s.path === selectedFieldKey);
    return entry === undefined ? undefined : JSON.stringify(entry, null, 2);
  }, [schema, selectedFieldKey]);

  const inFragmentMode = selectedFieldKey !== null && !showAll;
  const metaDisplay = (inFragmentMode ? metaFragmentJson : undefined) ?? fullJson ?? "";
  const schemaDisplay = (inFragmentMode ? schemaFragmentJson : undefined) ?? fullSchemaJson;

  // meta 變更(內容或投影)使先前的 "Copied" 確認失效。
  React.useEffect(() => setCopied(false), [fullJson]);

  const onCopy = async () => {
    if (fullJson === undefined) return;
    try {
      await navigator.clipboard.writeText(fullJson);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const onDownload = () => {
    if (fullJson === undefined) return;
    const url = URL.createObjectURL(new Blob([fullJson], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "meta.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-md border">
      {/* ① 頁籤列(soft 底,獨占頂部;收合鈕帶文字、佔尾端)— polish mockup */}
      <div className="flex items-stretch border-b bg-muted/30">
        <TabButton label={labels.metaTitle} active={tab === "meta"} onClick={() => onTabChange("meta")} />
        <TabButton label={labels.schemaTitle} active={tab === "schema"} onClick={() => onTabChange("schema")} />
        <TabButton label={labels.tryTitle} active={tab === "try"} onClick={() => onTabChange("try")} />
        <button
          type="button"
          aria-label={labels.collapse}
          onClick={onCollapse}
          className="ml-auto flex items-center gap-1.5 border-l px-3 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
          {labels.collapseLabel}
        </button>
      </div>

      {metaResult.error !== undefined && (
        <p className="mx-3 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">{metaResult.error}</p>
      )}

      <div className="p-3">
        {tab === "meta" && (
          <div>
            {inFragmentMode && metaFragmentJson !== undefined && (
              <FragmentBar fieldKey={selectedFieldKey!} viewingLabel={labels.viewingField} showAllLabel={labels.showAll} onShowAll={() => setShowAll(true)} />
            )}
            <pre data-testid="meta-json" className="max-h-80 overflow-auto rounded-md bg-muted/30 p-3 font-mono text-xs">
              {colorJson(metaDisplay)}
            </pre>
          </div>
        )}

        {tab === "schema" && (
          <div>
            {inFragmentMode && schemaFragmentJson !== undefined && (
              <FragmentBar fieldKey={selectedFieldKey!} viewingLabel={labels.viewingField} showAllLabel={labels.showAll} onShowAll={() => setShowAll(true)} />
            )}
            <pre data-testid="schema-json" className="max-h-80 overflow-auto rounded-md bg-muted/30 p-3 font-mono text-xs">
              {colorJson(schemaDisplay)}
            </pre>
          </div>
        )}

        {tab === "try" &&
          (schema.length === 0 ? (
            <p className="text-xs text-muted-foreground">{labels.emptySchema}</p>
          ) : (
            /* FilterTreeEditor 的條件列有固定寬度且不換行(紅線套件,容器端圍堵):
               橫向捲動取代爆框。 */
            <div className="overflow-x-auto">
              <FilterTreeEditor
                group={tree}
                engineId="pg-filter"
                schema={schema}
                onChange={setTree}
                onCreateField={() => {}}
                labels={treeLabels}
              />
            </div>
          ))}
      </div>

      {/* ④ 底部動作列(soft 底):Copy/下載靠左,Reset(破壞性)靠右隔離 — polish mockup */}
      <div className="flex items-center gap-2 border-t bg-muted/30 px-3 py-2">
        <Button size="xs" variant="outline" onClick={() => void onCopy()} disabled={fullJson === undefined}>
          {copied ? labels.copied : labels.copy}
        </Button>
        <Button size="xs" variant="outline" onClick={onDownload} disabled={fullJson === undefined}>
          {labels.download}
        </Button>
        <Button size="xs" variant="outline" className="ml-auto" onClick={onReset}>
          {labels.reset}
        </Button>
      </div>
    </div>
  );
}
