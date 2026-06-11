import type { ToolDefinition } from "@rfjs/web-core";
import { Seam } from "@rfjs/web-ui/components/seam";
import Link from "next/link";

const statusLabel: Record<ToolDefinition["status"], string> = {
  ready: "Ready",
  preview: "Preview",
  planned: "Planned",
};

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  return (
    <Link
      href={tool.href}
      className="group flex flex-col gap-3 rounded-md border border-border bg-slab p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake focus-visible:ring-offset-2 focus-visible:ring-offset-bedrock"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-sm font-medium">{tool.title}</h3>
        <span className="font-mono text-[10px] text-muted-foreground">{statusLabel[tool.status]}</span>
      </div>
      <p className="text-xs text-muted-foreground">{tool.description}</p>
      <div className="h-px opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <Seam state="current" operation={tool.category} orientation="horizontal" />
      </div>
    </Link>
  );
}
