import type { ToolDefinition } from "@rfjs/web-core";
import { Seam } from "@rfjs/web-ui/components/seam";

import { Link } from "@/i18n/navigation";
import { isExternalTool, toolHref } from "@/lib/tool-href";

const cardClass =
  "group flex flex-col gap-3 rounded-md border border-border bg-slab p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake focus-visible:ring-offset-2 focus-visible:ring-offset-bedrock";

export function ToolCard({
  tool,
  title,
  description,
  statusLabel,
  workbenchLabel,
}: {
  tool: ToolDefinition;
  title: string;
  description: string;
  statusLabel: string;
  workbenchLabel: string;
}) {
  const href = toolHref(tool);
  const external = isExternalTool(tool);

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-sans text-sm font-medium">{title}</h3>
        <span className="font-mono text-[10px] text-muted-foreground">
          {external ? workbenchLabel : statusLabel}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="h-px opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <Seam state="current" operation={tool.category} orientation="horizontal" />
      </div>
    </>
  );

  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cardClass}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cardClass}>
      {body}
    </Link>
  );
}
