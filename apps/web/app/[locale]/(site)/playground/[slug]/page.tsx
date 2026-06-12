import { toolRegistry } from "@rfjs/web-core";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";

export function generateStaticParams() {
  return toolRegistry
    .filter((tool) => tool.href.startsWith("/playground/"))
    .map((tool) => ({ slug: tool.href.split("/").pop()! }));
}

export default async function PlaygroundToolPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const tool = toolRegistry.find((t) => t.href === `/playground/${slug}`);
  if (!tool) notFound();
  const t = await getTranslations({ locale, namespace: "Tools" });
  const tDetail = await getTranslations({ locale, namespace: "Detail" });
  const tStatus = await getTranslations({ locale, namespace: "Status" });
  return (
    <>
      <PageHeader title={t(`${tool.id}.title`)} description={t(`${tool.id}.description`)} />
      <p className="text-sm text-muted-foreground">{tDetail("playgroundComingSoon")}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        {tDetail("status", { status: tStatus(tool.status) })}
      </p>
    </>
  );
}
