"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Textarea } from "@rfjs/web-ui/components/textarea";

export interface CanonicalEditorLabels {
  canonicalHint: string;
  copy: string;
}

export function CanonicalEditor({
  value,
  onChange,
  error,
  labels,
}: {
  value: string;
  onChange: (text: string) => void;
  error: string | null;
  labels: CanonicalEditorLabels;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Textarea
          aria-label={labels.canonicalHint}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          rows={12}
          className="resize-y pr-24 font-mono"
        />
        <CopyButton text={value} label={labels.copy} className="absolute top-2 right-2" />
      </div>
      {error ? <p className="font-mono text-sm text-fault">{error}</p> : null}
    </div>
  );
}
