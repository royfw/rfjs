"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  evaluateTable,
  parseTable,
  tableToJson,
  newRule,
  moveRule,
  type DecisionTable,
  type DecisionRule,
  type EvaluateResult,
} from "@rfjs/decision-table";
import { FilterTreeEditor, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import { addInferredField, type BuilderGroup, type FieldSchema } from "@rfjs/filter-builder";
import { Button } from "@rfjs/web-ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rfjs/web-ui/components/select";

import { RuleSheet } from "./rule-sheet";
import { sampleTable, sampleBatch } from "./sample";

const uuid = () => crypto.randomUUID();

function useFilterLabels(): FilterTreeLabels {
  const t = useTranslations("ToolUI");
  return {
    logic: { and: "AND", or: "OR", nor: "NOR", not: "NOT" },
    addCondition: t("dtFilterAddCondition"),
    addGroup: t("dtFilterAddGroup"),
    removeGroup: t("dtFilterRemoveGroup"),
    removeCondition: t("dtFilterRemoveCondition"),
    elemMatch: t("dtFilterElemMatch"),
  };
}

function outputsSummary(outputs: Record<string, unknown>): string {
  return Object.entries(outputs)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" · ");
}

function ResultView({ result, t }: { result: EvaluateResult; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="space-y-1 text-sm">
      <p>
        <span className="font-semibold">{t("dtMatched")}:</span>{" "}
        {result.matched.length > 0 ? result.matched.join(", ") : t("dtNoMatch")}
        {result.usedDefault ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">{t("dtUsedDefault")}</span> : null}
      </p>
      <pre className="overflow-auto rounded-md border bg-muted/30 p-2 text-xs">{JSON.stringify(result.outputs, null, 2)}</pre>
      {result.ruleErrors.length > 0 ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <p className="font-semibold">{t("dtRuleErrors")}</p>
          {result.ruleErrors.map((e, i) => (
            <p key={i}>{`[${e.kind}] ${e.ruleId}: ${e.message}`}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DecisionTableTool() {
  const t = useTranslations("ToolUI");
  const filterLabels = useFilterLabels();

  const [table, setTable] = React.useState<DecisionTable>(sampleTable);
  const [editingRuleId, setEditingRuleId] = React.useState<string | null>(null);

  // 單筆試算
  const [contextText, setContextText] = React.useState('{"amount": 60000, "dept": "Engineering"}');
  const [singleResult, setSingleResult] = React.useState<EvaluateResult | null>(null);
  const [singleError, setSingleError] = React.useState<string | null>(null);
  // 批次試算
  const [batchText, setBatchText] = React.useState(() => JSON.stringify(sampleBatch, null, 2));
  const [batchResults, setBatchResults] = React.useState<{ context: unknown; result: EvaluateResult }[] | null>(null);
  const [batchError, setBatchError] = React.useState<string | null>(null);
  // JSON 匯入
  const [importText, setImportText] = React.useState("");
  const [importError, setImportError] = React.useState<string | null>(null);

  const evalSeq = React.useRef(0);

  const runSingle = async () => {
    const seq = ++evalSeq.current;
    try {
      const ctx = JSON.parse(contextText);
      const result = await evaluateTable(table, ctx);
      if (seq !== evalSeq.current) return; // 過期結果丟棄
      setSingleError(null);
      setSingleResult(result);
    } catch (e) {
      if (seq !== evalSeq.current) return;
      setSingleResult(null);
      setSingleError(e instanceof SyntaxError ? t("dtInvalidJson") : String(e));
    }
  };

  const runBatch = async () => {
    const seq = ++evalSeq.current;
    try {
      const rows = JSON.parse(batchText);
      if (!Array.isArray(rows)) throw new SyntaxError("not an array");
      const results: { context: unknown; result: EvaluateResult }[] = [];
      for (const row of rows) results.push({ context: row, result: await evaluateTable(table, row) });
      if (seq !== evalSeq.current) return;
      setBatchError(null);
      setBatchResults(results);
    } catch (e) {
      if (seq !== evalSeq.current) return;
      setBatchResults(null);
      setBatchError(e instanceof SyntaxError ? t("dtInvalidJson") : String(e));
    }
  };

  const updateRule = (id: string, patch: Partial<DecisionRule>) => {
    setTable((tb) => ({ ...tb, rules: tb.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  };

  const editingRule = table.rules.find((r) => r.id === editingRuleId) ?? null;
  const schema = (table.inputs ?? []) as FieldSchema[];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t("dtEyebrow")}</p>

      {/* 規則表 */}
      <div className="rounded-md border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">{t("dtRules")}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("dtHitPolicy")}</span>
            <Select
              value={table.hitPolicy}
              onValueChange={(v) => setTable((tb) => ({ ...tb, hitPolicy: v as DecisionTable["hitPolicy"] }))}
            >
              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="first">first</SelectItem>
                <SelectItem value="collect">collect</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => setTable((tb) => ({ ...tb, rules: [...tb.rules, newRule(uuid)] }))}>
              {t("dtAddRule")}
            </Button>
          </div>
        </div>
        <ul className="divide-y" data-testid="dt-rules-list">
          {table.rules.map((rule, i) => (
            <li key={rule.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{rule.description ?? rule.id}</span>
              <span className="hidden max-w-[40%] truncate text-xs text-muted-foreground sm:block">{outputsSummary(rule.outputs)}</span>
              <Button size="sm" variant="ghost" aria-label={t("dtMoveUp")} disabled={i === 0}
                onClick={() => setTable((tb) => moveRule(tb, i, i - 1))}>↑</Button>
              <Button size="sm" variant="ghost" aria-label={t("dtMoveDown")} disabled={i === table.rules.length - 1}
                onClick={() => setTable((tb) => moveRule(tb, i, i + 1))}>↓</Button>
              <Button size="sm" variant="outline" onClick={() => setEditingRuleId(rule.id)}>{t("dtEditRule")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setTable((tb) => ({ ...tb, rules: tb.rules.filter((r) => r.id !== rule.id) }))}>
                {t("dtRemoveRule")}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {/* 單筆試算 */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-semibold">{t("dtSingleEval")}</p>
          <label htmlFor="dt-context" className="text-xs text-muted-foreground">{t("dtContextLabel")}</label>
          <textarea id="dt-context" rows={4} value={contextText} onChange={(e) => setContextText(e.target.value)}
            className="w-full rounded-md border bg-background p-2 font-mono text-xs" />
          <Button size="sm" onClick={runSingle}>{t("dtRun")}</Button>
          {singleError ? <p role="alert" className="text-xs text-destructive">{singleError}</p> : null}
          {singleResult ? (
            <div data-testid="dt-single-result">
              <ResultView result={singleResult} t={t} />
            </div>
          ) : null}
        </div>

        {/* 批次試算 */}
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-semibold">{t("dtBatchEval")}</p>
          <label htmlFor="dt-batch" className="text-xs text-muted-foreground">{t("dtBatchLabel")}</label>
          <textarea id="dt-batch" rows={4} value={batchText} onChange={(e) => setBatchText(e.target.value)}
            className="w-full rounded-md border bg-background p-2 font-mono text-xs" />
          <Button size="sm" onClick={runBatch}>{t("dtRun")}</Button>
          {batchError ? <p role="alert" className="text-xs text-destructive">{batchError}</p> : null}
          {batchResults ? (
            <ul className="space-y-1 text-xs">
              {batchResults.map((r, i) => (
                <li key={i} data-testid="dt-batch-row" className="rounded border px-2 py-1">
                  <span className="text-muted-foreground">{JSON.stringify(r.context)}</span>{" → "}
                  <span className="font-medium">
                    {r.result.matched.length > 0 ? r.result.matched.join(",") : t("dtNoMatch")}
                  </span>{" · "}
                  <span>{JSON.stringify(r.result.outputs)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {/* JSON 面板 */}
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-semibold">{t("dtJson")}</p>
        <pre className="max-h-56 overflow-auto rounded-md border bg-muted/30 p-2 text-[11px]">{tableToJson(table)}</pre>
        <label htmlFor="dt-import" className="text-xs text-muted-foreground">{t("dtImport")}</label>
        <textarea id="dt-import" rows={3} value={importText} onChange={(e) => setImportText(e.target.value)}
          className="w-full rounded-md border bg-background p-2 font-mono text-xs" />
        <Button size="sm" variant="outline" onClick={() => {
          try {
            setTable(parseTable(importText));
            setImportError(null);
          } catch {
            setImportError(t("dtImportInvalid"));
          }
        }}>{t("dtImport")}</Button>
        {importError ? <p role="alert" className="text-xs text-destructive">{importError}</p> : null}
      </div>

      {/* 規則編輯 sheet */}
      {editingRule ? (
        <RuleSheet title={`${t("dtRuleSheetTitle")} — ${editingRule.id}`} closeLabel={t("dtClose")} onClose={() => setEditingRuleId(null)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="dt-rule-desc" className="mb-1 block text-xs text-muted-foreground">{t("dtDescription")}</label>
              <input id="dt-rule-desc" value={editingRule.description ?? ""}
                onChange={(e) => updateRule(editingRule.id, { description: e.target.value })}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t("dtCondition")}</p>
              <FilterTreeEditor
                group={editingRule.when as BuilderGroup}
                engineId="data-filter"
                schema={schema}
                labels={filterLabels}
                onChange={(next) => updateRule(editingRule.id, { when: next })}
                onCreateField={(path) =>
                  setTable((tb) => ({
                    ...tb,
                    inputs: addInferredField((tb.inputs ?? []) as FieldSchema[], path),
                  }))
                }
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t("dtOutputs")}</p>
              {table.outputs.map((def) => (
                <div key={def.key} className="mb-2">
                  <label htmlFor={`dt-out-${def.key}`} className="mb-0.5 block text-xs">{def.label ?? def.key}</label>
                  {/* v1 limitation: output values are `unknown`; editing here always coerces to a string
                      (a plain constant or an "=" expression), since string is the primary authoring path. */}
                  <input
                    id={`dt-out-${def.key}`}
                    value={String(editingRule.outputs[def.key] ?? "")}
                    placeholder={t("dtOutputHint")}
                    onChange={(e) => updateRule(editingRule.id, { outputs: { ...editingRule.outputs, [def.key]: e.target.value } })}
                    className="w-full rounded-md border bg-background px-2 py-1.5 font-mono text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </RuleSheet>
      ) : null}
    </div>
  );
}
