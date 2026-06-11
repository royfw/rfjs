import { toolRegistry } from "@rfjs/web-core";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";

export function generateStaticParams() {
  return toolRegistry.map((tool) => ({ slug: tool.href.split("/").pop()! }));
}

export default async function ToolDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = toolRegistry.find((t) => t.href.endsWith(`/${slug}`));
  if (!tool) notFound();
  return (
    <>
      <PageHeader title={tool.title} description={tool.description} />
      <p className="text-sm text-muted-foreground">
        This tool ships in a later phase (status: {tool.status}).
      </p>
    </>
  );
}
