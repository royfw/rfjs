"use client";

import { FilterTreeEditor, useFilterTree, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import { Button } from "@rfjs/web-ui/components/button";
import { Panel } from "@rfjs/web-ui/components/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rfjs/web-ui/components/table";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { queryDatasets, type QueryResult } from "@/lib/datasets";
import { buildQueryBody } from "@/lib/dataset-query";
import { DATASET_FIELD_SCHEMA } from "@/lib/dataset-schema";

export type ExplorerLabels = {
  title: string;
  description: string;
  run: string;
  running: string;
  loading: string;
  empty: string;
  error: string;
  results: string;
  columnName: string;
  columnDescription: string;
  columnCreated: string;
  columnUpdated: string;
  emptyDescription: string;
  tree: FilterTreeLabels;
};

function StateBlock({
  icon,
  children,
  tone = "muted",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 py-10 text-center text-sm ${
        tone === "error" ? "text-fault" : "text-muted-foreground"
      }`}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}

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
      <PageHeader title={labels.title} description={labels.description} />
      <Panel
        action={
          <Button size="sm" disabled={busy} onClick={run}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {labels.running}
              </>
            ) : (
              labels.run
            )}
          </Button>
        }
      >
        <FilterTreeEditor
          group={tree}
          schema={schema}
          engineId="pg-filter"
          onChange={setTree}
          onCreateField={createField}
          labels={labels.tree}
        />
      </Panel>
      <Panel>
        {busy ? (
          <StateBlock icon={<Loader2 className="size-6 animate-spin" />}>{labels.loading}</StateBlock>
        ) : res === null ? (
          <StateBlock icon={<Inbox className="size-6" />}>{labels.emptyDescription}</StateBlock>
        ) : !res.ok ? (
          <StateBlock icon={<AlertTriangle className="size-6" />} tone="error">
            {labels.error}
          </StateBlock>
        ) : res.result.items.length === 0 ? (
          <StateBlock icon={<Inbox className="size-6" />}>{labels.empty}</StateBlock>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground tabular-nums">
              {res.result.total} {labels.results}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{labels.columnName}</TableHead>
                  <TableHead>{labels.columnDescription}</TableHead>
                  <TableHead>{labels.columnCreated}</TableHead>
                  <TableHead>{labels.columnUpdated}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {res.result.items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">{d.description ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                      {d.createdAt}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                      {d.updatedAt}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
