import { toolRegistry } from "@rfjs/web-core";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { TOOL_COMPONENTS } from "@/tools";

export function generateStaticParams() {
  return toolRegistry
    .filter((tool) => tool.surface === "web")
    .map((tool) => ({ slug: tool.id }));
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const tool = toolRegistry.find((t) => t.surface === "web" && t.id === slug);
  if (!tool) notFound();
  const t = await getTranslations({ locale, namespace: "Tools" });
  const tDetail = await getTranslations({ locale, namespace: "Detail" });
  const tStatus = await getTranslations({ locale, namespace: "Status" });
  const Tool = TOOL_COMPONENTS[tool.id];
  return (
    <>
      <PageHeader title={t(`${tool.id}.title`)} description={t(`${tool.id}.description`)} />
      {Tool ? (
        <Tool />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{tDetail("toolComingSoon")}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {tDetail("status", { status: tStatus(tool.status) })}
          </p>
        </>
      )}
    </>
  );
}
