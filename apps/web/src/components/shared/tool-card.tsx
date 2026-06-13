import type { ToolDefinition } from "@rfjs/web-core";
import { Seam } from "@rfjs/web-ui/components/seam";

import { Link } from "@/i18n/navigation";

export function ToolCard({
  tool,
  title,
  description,
  statusLabel,
}: {
  tool: ToolDefinition;
  title: string;
  description: string;
  statusLabel: string;
}) {
  return (
    <Link href={tool.href} className="group flex flex-col gap-3 rounded-md border border-border bg-slab p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake focus-visible:ring-offset-2 focus-visible:ring-offset-bedrock">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-sm font-medium">{title}</h3>
        <span className="font-mono text-[10px] text-muted-foreground">{statusLabel}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="h-px opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <Seam state="current" operation={tool.category} orientation="horizontal" />
      </div>
    </Link>
  );
}
