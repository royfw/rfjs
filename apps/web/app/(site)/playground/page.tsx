import { toolRegistry } from "@rfjs/web-core";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { ToolCard } from "@/components/shared/tool-card";

export const metadata: Metadata = { title: "Playground — rfjs" };

export default function PlaygroundPage() {
  const playgroundTools = toolRegistry.filter((t) => t.href.startsWith("/playground/"));
  return (
    <>
      <PageHeader title="Playground" description="Interactive builders for @rfjs/* workflows." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {playgroundTools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </>
  );
}
