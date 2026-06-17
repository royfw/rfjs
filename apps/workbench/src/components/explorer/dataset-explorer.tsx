"use client";

import { FilterTreeEditor, useFilterTree, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import { Button } from "@rfjs/web-ui/components/button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { useState } from "react";

import { queryDatasets, type QueryResult } from "@/lib/datasets";
import { buildQueryBody } from "@/lib/dataset-query";
import { DATASET_FIELD_SCHEMA } from "@/lib/dataset-schema";

export type ExplorerLabels = {
  title: string;
  description: string;
  run: string;
  empty: string;
  error: string;
  tree: FilterTreeLabels;
};

export function DatasetExplorer({ labels }: { labels: ExplorerLabels }) {
  const { tree, schema, setTree, createField } = useFilterTree({ schema: DATASET_FIELD_SCHEMA });
  const [res, setRes] = useState<QueryResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setRes(await queryDatasets(buildQueryBody(tree, schema, 1, 20)));
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{labels.title}</h1>
      <p className="text-sm text-muted-foreground">{labels.description}</p>
      <Panel>
        <FilterTreeEditor
          group={tree}
          schema={schema}
          engineId="pg-filter"
          onChange={setTree}
          onCreateField={createField}
          labels={labels.tree}
        />
        <Button className="mt-3" size="sm" disabled={busy} onClick={run}>
          {labels.run}
        </Button>
      </Panel>
      <Panel>
        {res === null ? null : !res.ok ? (
          <span className="text-sm text-destructive">{labels.error}</span>
        ) : res.result.items.length === 0 ? (
          <span className="text-sm text-muted-foreground">{labels.empty}</span>
        ) : (
          <ul className="flex flex-col gap-2">
            {res.result.items.map((d) => (
              <li key={d.id} className="text-sm">
                <span className="font-medium">{d.name}</span>
                {d.description ? <span className="text-muted-foreground"> — {d.description}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
