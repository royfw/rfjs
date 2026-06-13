import { Seam } from "@rfjs/web-ui/components/seam";
import type { ReactNode } from "react";

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
    <div className="flex flex-col items-stretch gap-3 lg:flex-row">
      <div className="min-w-0 flex-1">{input}</div>
      <div className="flex shrink-0 items-center justify-center py-1 lg:px-1 lg:py-0">
        <Seam state="current" operation={operation} orientation="horizontal" className="lg:hidden" />
        <Seam state="current" operation={operation} orientation="vertical" className="hidden lg:flex" />
      </div>
      <div className="min-w-0 flex-1">{output}</div>
    </div>
  );
}
