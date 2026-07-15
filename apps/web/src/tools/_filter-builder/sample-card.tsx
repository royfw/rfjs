"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { Textarea } from "@rfjs/web-ui/components/textarea";
import { Upload } from "lucide-react";
import type { CSSProperties } from "react";

import { SectionCard } from "@/components/shared/section-card";

export interface SampleCardLabels {
  sample: string;
  invalidSample: string;
  rawCount: string; // already-formatted "raw (N)" string
  upload: string;
}

export function SampleCard({
  open,
  onToggle,
  value,
  onChange,
  onUpload,
  hasError,
  labels,
  style,
}: {
  open: boolean;
  onToggle: () => void;
  value: string;
  onChange: (text: string) => void;
  onUpload: (file: File | undefined) => void;
  hasError: boolean;
  labels: SampleCardLabels;
  style?: CSSProperties;
}) {
  return (
    <SectionCard
      title={labels.sample}
      collapsible
      open={open}
      onOpenChange={onToggle}
      action={
        hasError ? (
          <span className="font-mono text-xs text-fault">{labels.invalidSample}</span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">{labels.rawCount}</span>
        )
      }
      className="fb-rise"
      style={style}
    >
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Textarea
            aria-label={labels.sample}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            rows={6}
            className="resize-y pr-24 font-mono"
          />
          <Button asChild variant="outline" size="sm" className="absolute top-2 right-2">
            <label className="cursor-pointer">
              <Upload className="size-3.5" />
              {labels.upload}
              <input
                type="file"
                accept=".json,.csv,application/json,text/csv"
                className="sr-only"
                onChange={(e) => {
                  onUpload(e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </Button>
        </div>
        {hasError ? <p className="font-mono text-sm text-fault">{labels.invalidSample}</p> : null}
      </div>
    </SectionCard>
  );
}
