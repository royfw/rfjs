"use client";

import * as React from "react";

import { tableConfigToResourceMeta } from "@rfjs/table-builder";
import type { TableConfig } from "@rfjs/table-builder";
import type { RequestMeta, ResponseMeta } from "@rfjs/data-schema";
import { Button } from "@rfjs/web-ui/components/button";

export interface MetadataPanelLabels {
  hint: string;
  copy: string;
  copied: string;
  download: string;
}

export interface MetadataPanelProps {
  config: TableConfig;
  request?: RequestMeta;
  response?: ResponseMeta;
  labels: MetadataPanelLabels;
}

// Metadata tab (design spec §2.2): a live, read-only reverse projection of the current config.
// The Columns panel IS the editing surface for this data — no second editor here.
export function MetadataPanel({ config, request, response, labels }: MetadataPanelProps) {
  const [copied, setCopied] = React.useState(false);

  const json = React.useMemo(
    () => JSON.stringify(tableConfigToResourceMeta(config, request, response), null, 2),
    [config, request, response],
  );

  // Any edit that changes the projection invalidates the "Copied" confirmation.
  React.useEffect(() => setCopied(false), [json]);

  const onCopy = async () => {
    // Clipboard can be unavailable/denied (spec §4): swallow the rejection so the button
    // simply stays on its "copy" label instead of surfacing an unhandled rejection.
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const onDownload = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "meta.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs text-muted-foreground">{labels.hint}</p>
        <Button size="sm" variant="outline" onClick={() => void onCopy()}>
          {copied ? labels.copied : labels.copy}
        </Button>
        <Button size="sm" variant="outline" onClick={onDownload}>
          {labels.download}
        </Button>
      </div>
      <pre data-testid="metadata-json" className="max-h-80 overflow-auto rounded-md bg-muted/30 p-3 font-mono text-xs">
        {json}
      </pre>
    </div>
  );
}
