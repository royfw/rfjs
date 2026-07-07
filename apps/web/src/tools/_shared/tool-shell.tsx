import type { ReactNode } from "react";

// Operation label sits as a centered chip ABOVE the panes (Seam badge
// vocabulary: "▸ op" mono), not floating between them — a between-panes badge
// is wider than the gutter and overlaps the panels' inner edges/content.
export function ToolShell({
  operation,
  input,
  output,
}: {
  operation: string;
  input: ReactNode;
  output: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <span className="rounded-sm border border-border bg-slab px-1.5 py-0.5 font-mono text-[10px] leading-none text-foreground/65">
          ▸ {operation}
        </span>
      </div>
      <div className="flex flex-col items-stretch gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">{input}</div>
        <div className="min-w-0 flex-1">{output}</div>
      </div>
    </div>
  );
}
