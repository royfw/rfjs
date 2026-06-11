import { toolRegistry } from "@rfjs/web-core";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { ToolCard } from "@/components/shared/tool-card";

export const metadata: Metadata = { title: "Tools — rfjs" };

export default function ToolsPage() {
  return (
    <>
      <PageHeader title="Tools" description="Developer data tools, each powered by an @rfjs/* package." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {toolRegistry.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </>
  );
}
