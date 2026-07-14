"use client";

import {
  buildHighlight,
  paginateAll,
  parseHighlight,
  search,
  type EsHit,
} from "@rfjs/es-client";
import { getEngine, runLiveMatch, treeToFilterGroup } from "@rfjs/filter-builder";
import { FilterTreeEditor, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import { useTranslations } from "next-intl";
import { Fragment, useEffect, useMemo, useState } from "react";

import {
  MetadataStrip,
  RISE,
  SampleCard,
  toCompileContext,
  useFilterBuilder,
  useOperatorLabels,
} from "@/tools/_filter-builder";
import { SectionCard } from "@/components/shared/section-card";
import { ToolEyebrow } from "@/components/shared/tool-eyebrow";
import { ToolIntro } from "@/components/shared/tool-intro";

import { extractTerms, makeMockTransport } from "./mock-transport";

const SAMPLE = JSON.stringify(
  [
    { id: "t-1", status: "open", age: 36, body: "please refund my order" },
    { id: "t-2", status: "open", age: 12, body: "where is my package" },
    { id: "t-3", status: "closed", age: 51, body: "refund processed, thanks" },
    { id: "t-4", status: "open", age: 27, body: "upgrade plan question" },
  ],
  null,
  2,
);

const SCENARIOS = ["search", "paginate", "highlight"] as const;
type Scenario = (typeof SCENARIOS)[number];

interface RunResult {
  kind: Scenario;
  total: number;
  hits: EsHit[];
  batches?: EsHit[][];
}

function Highlighted({ text }: { text: string }) {
  return (
    <>
      {text.split(/(<em>.*?<\/em>)/g).map((part, i) => {
        const m = /^<em>(.*?)<\/em>$/.exec(part);
        return m ? <mark key={i}>{m[1]}</mark> : <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

function toBatches(batches: EsHit[][]): { batch: EsHit[]; bi: number; cursor: string }[] {
  return batches.map((batch, bi) => {
    const prev = bi === 0 ? [] : (batches[bi - 1] ?? []);
    const last = prev[prev.length - 1];
    const cursor = bi === 0 ? "—" : String(last?.sort?.[0] ?? "");
    return { batch, bi, cursor };
  });
}

function snippet(scenario: Scenario): string {
  if (scenario === "search") {
    return `import { buildSearchBody } from "@rfjs/es-query";
import { search, fromElasticClient } from "@rfjs/es-client";

const body = buildSearchBody(tree, { size: 10 });
const { total, hits, sources } = await search(transport, { index: "demo", body });`;
  }
  if (scenario === "paginate") {
    return `import { paginateAll, fromOpenSearchClient } from "@rfjs/es-client";

for await (const batch of paginateAll(transport, {
  index: "demo", body, pageSize: 2,   // search_after + PIT
})) { /* … */ }`;
  }
  return `import { search, buildHighlight, parseHighlight } from "@rfjs/es-client";

const body = { ...buildSearchBody(tree), ...buildHighlight({ fields: ["body"] }) };
const { hits } = await search(transport, { index: "demo", body });
const snippets = parseHighlight(hits[0]); // { body: ["… <em>…</em> …"] }`;
}

export function EsClientDemo() {
  const t = useTranslations("ToolUI");
  const operatorLabels = useOperatorLabels();
  const fb = useFilterBuilder({ sample: SAMPLE });
  const [scenario, setScenario] = useState<Scenario>("search");
  const [result, setResult] = useState<RunResult | null>(null);

  const treeLabels: FilterTreeLabels = {
    logic: {
      and: t("ecdLogicAnd"),
      or: t("ecdLogicOr"),
      nor: t("ecdLogicNor"),
      not: t("ecdLogicNot"),
    },
    addCondition: t("ecdAddCondition"),
    addGroup: t("ecdAddGroup"),
    removeGroup: t("ecdRemoveGroup"),
    removeCondition: t("ecdRemoveCondition"),
    elemMatch: t("ecdElemMatch"),
    valueHint: t("ecdValueHint"),
    toggleGroup: t("ecdToggleGroup"),
    collapsedConditions: t("ecdCollapsedConditions"),
    collapsedGroups: t("ecdCollapsedGroups"),
    collapsedEmpty: t("ecdCollapsedEmpty"),
    operatorLabels,
  };

  const compiled = useMemo(
    () => getEngine("es-query").compile(treeToFilterGroup(fb.tree), toCompileContext(fb.schema)),
    [fb.tree, fb.schema],
  );
  const live = useMemo(() => runLiveMatch(fb.rows, fb.tree), [fb.rows, fb.tree]);

  const bodyText = useMemo(
    () =>
      compiled.ok
        ? JSON.stringify({ query: JSON.parse(compiled.primary), size: 10 }, null, 2)
        : null,
    [compiled],
  );

  useEffect(() => {
    if (!compiled.ok || live.uncoverable) {
      setResult(null);
      return;
    }
    let cancelled = false;
    const query = JSON.parse(compiled.primary) as Record<string, unknown>;
    const matched = live.matched as Record<string, unknown>[];
    const transport = makeMockTransport(matched, { terms: extractTerms(fb.tree), index: "demo" });

    void (async () => {
      if (scenario === "search") {
        const r = await search(transport, { index: "demo", body: { query, size: 10 } });
        if (!cancelled) setResult({ kind: "search", total: r.total, hits: r.hits });
      } else if (scenario === "paginate") {
        const batches: EsHit[][] = [];
        for await (const b of paginateAll(transport, { index: "demo", body: { query }, pageSize: 2 })) {
          batches.push(b);
        }
        if (!cancelled) setResult({ kind: "paginate", total: matched.length, hits: batches.flat(), batches });
      } else {
        const body = { query, size: 10, ...buildHighlight({ fields: ["body"] }) };
        const r = await search(transport, { index: "demo", body });
        if (!cancelled) setResult({ kind: "highlight", total: r.total, hits: r.hits });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [compiled, live, scenario, fb.tree]);

  const reverseText =
    fb.reverseError === "invalidJson"
      ? "Invalid JSON"
      : fb.reverseError === "invalidShape"
        ? "Not a valid filter group"
        : null;

  return (
    <div className="flex flex-col gap-4">
      <ToolEyebrow>{t("ecdEyebrow")}</ToolEyebrow>
      <ToolIntro
        storageKey="tool-intro:es-client-demo"
        question={t("introQuestion")}
        tagline={t("ecdIntroTagline")}
        concepts={[
          { term: t("ecdIntroC1t"), desc: t("ecdIntroC1d") },
          { term: t("ecdIntroC2t"), desc: t("ecdIntroC2d") },
          { term: t("ecdIntroC3t"), desc: t("ecdIntroC3d") },
        ]}
        labels={{
          expand: t("introExpand"),
          collapse: t("introCollapse"),
          dismiss: t("introDismiss"),
        }}
      />
      <style>{RISE}</style>

      <SampleCard
        open={fb.sampleOpen}
        onToggle={() => fb.setSampleOpen((v) => !v)}
        value={fb.sampleText}
        onChange={fb.onSample}
        onUpload={(file) => void fb.onUpload(file)}
        hasError={Boolean(fb.error)}
        labels={{
          sample: t("ecdSample"),
          invalidSample: t("ecdInvalidSample"),
          rawCount: t("ecdRaw", { count: fb.rows.length }),
          upload: t("ecdUpload"),
        }}
        style={{ animationDelay: "0ms" }}
      />

      <SectionCard
        title={t("ecdFields")}
        className="fb-rise"
        style={{ animationDelay: "70ms" }}
      >
        <MetadataStrip
          schema={fb.schema}
          onChange={fb.setSchema}
          labels={{
            include: t("ecdInclude", { field: "" }).trim(),
            type: t("ecdType", { field: "" }).trim(),
          }}
        />
      </SectionCard>

      <SectionCard
        title={t("ecdFilterLogic")}
        className="fb-rise"
        style={{ animationDelay: "140ms" }}
        bodyClassName="overflow-x-auto p-5 sm:p-6"
      >
        <FilterTreeEditor
          group={fb.tree}
          engineId="es-query"
          schema={fb.schema}
          onChange={fb.setTree}
          onCreateField={fb.onCreateField}
          labels={treeLabels}
        />
      </SectionCard>

      <div className="fb-rise grid grid-cols-1 gap-5 lg:grid-cols-2" style={{ animationDelay: "210ms" }}>
        <SectionCard title={t("ecdRequest")} bodyClassName="p-0">
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
            {reverseText ?? bodyText ?? "—"}
          </pre>
        </SectionCard>

        <SectionCard
          title={t("ecdScenario")}
          action={
            <div className="flex gap-1.5">
              {SCENARIOS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScenario(s)}
                  className={`rounded-md border px-2.5 py-1 font-mono text-xs ${
                    scenario === s
                      ? "border-primary text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {t(`ecdScenario${s.charAt(0).toUpperCase()}${s.slice(1)}` as "ecdScenarioSearch")}
                </button>
              ))}
            </div>
          }
        >
          {!compiled.ok ? (
            <p className="font-mono text-xs text-destructive">{compiled.error}</p>
          ) : live.uncoverable ? (
            <p className="font-mono text-xs text-amber-600">{t("ecdUncoverable")}</p>
          ) : !result ? (
            <p className="font-mono text-xs text-muted-foreground">{t("ecdRunHint")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="font-mono text-xs text-emerald-600">
                {t("ecdMatched", { count: result.total })}
              </div>
              {result.kind === "paginate" && result.batches
                ? toBatches(result.batches).map(({ batch, bi, cursor }) => (
                    <div key={bi} className="flex flex-col gap-1.5">
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {t("ecdBatch", { n: bi + 1, cursor })}
                      </div>
                      {batch.map((h) => (
                        <HitRow key={h._id} hit={h} highlight={false} />
                      ))}
                    </div>
                  ))
                : result.hits.map((h) => (
                    <HitRow key={h._id} hit={h} highlight={result.kind === "highlight"} />
                  ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={t("ecdSnippet")}
        className="fb-rise"
        style={{ animationDelay: "280ms" }}
        bodyClassName="p-0"
      >
        <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">{snippet(scenario)}</pre>
      </SectionCard>
    </div>
  );
}

function HitRow({ hit, highlight }: { hit: EsHit; highlight: boolean }) {
  const source = hit._source as Record<string, unknown>;
  const body = typeof source.body === "string" ? source.body : "";
  const marked = highlight ? (parseHighlight(hit).body?.[0] ?? body) : body;
  return (
    <div className="rounded-md border bg-background p-2 font-mono text-xs">
      <div className="text-[11px] text-muted-foreground">
        _id: {hit._id} · _score: {hit._score ?? "—"}
      </div>
      <div>
        {String(source.status ?? "")}
        {body ? " · " : ""}
        {highlight ? <Highlighted text={marked} /> : body}
      </div>
    </div>
  );
}
