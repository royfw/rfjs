import { toolRegistry } from "@rfjs/web-core";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/shared/page-header";
import { ToolCard } from "@/components/shared/tool-card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pages" });
  return { title: `${t("toolsTitle")} — rfjs` };
}

export default async function ToolsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  const tTools = await getTranslations("Tools");
  return (
    <>
      <PageHeader title={t("toolsTitle")} description={t("toolsDescription")} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {toolRegistry.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            title={tTools(`${tool.id}.title`)}
            description={tTools(`${tool.id}.description`)}
          />
        ))}
      </div>
    </>
  );
}
