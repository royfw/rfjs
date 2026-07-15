"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { useState } from "react";

import { FragmentBar } from "@/components/shared/fragment-bar";
import { SectionCard } from "@/components/shared/section-card";
import { CanonicalEditor } from "@/tools/_filter-builder";

export interface QueryOutputLabels {
  output: string;
  primaryLabel: string; // "WHERE" | "filter" — what `primary` is
  secondaryLabel: string; // "values" | "" — what `secondary` is (empty hides it)
  canonical: string;
  canonicalHint: string;
  reverseError: string | null;
  compileError: string | null; // already-formatted
  copy: string;
}

export function QueryOutputPanel({
  primary,
  secondary,
  canonicalJson,
  onCanonicalChange,
  labels,
}: {
  primary: string | null;
  secondary: string | null;
  canonicalJson: string;
  onCanonicalChange: (text: string) => void;
  labels: QueryOutputLabels;
}) {
  const [tab, setTab] = useState<"output" | "canonical">("output");

  return (
    <SectionCard
      collapsible
      collapseLabel={labels.output}
      tabs={[
        { id: "output", label: labels.output },
        { id: "canonical", label: labels.canonical },
      ]}
      activeTab={tab}
      onTabChange={(id) => setTab(id as "output" | "canonical")}
    >
      {tab === "output" ? (
        labels.compileError ? (
          <p className="font-mono text-sm text-fault">{labels.compileError}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <FragmentBar>
              ◆ {labels.primaryLabel}
              {labels.secondaryLabel && secondary ? ` · ${labels.secondaryLabel}` : ""}
            </FragmentBar>
            <div className="relative">
              <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 pr-12 font-mono text-xs text-foreground">
                {primary || "—"}
              </pre>
              <CopyButton text={primary ?? ""} label={labels.copy} className="absolute top-2 right-2" />
            </div>
            {labels.secondaryLabel && secondary ? (
              <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs text-foreground">
                {secondary}
              </pre>
            ) : null}
          </div>
        )
      ) : null}

      {tab === "canonical" ? (
        <div className="flex flex-col gap-3">
          <CanonicalEditor
            value={canonicalJson}
            onChange={onCanonicalChange}
            error={labels.reverseError}
            labels={{ canonicalHint: labels.canonicalHint, copy: labels.copy }}
          />
        </div>
      ) : null}
    </SectionCard>
  );
}
