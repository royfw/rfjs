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
  return { title: `${t("playgroundTitle")} — rfjs` };
}

export default async function PlaygroundPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  const playgroundTools = toolRegistry.filter((tool) => tool.href.startsWith("/playground/"));
  return (
    <>
      <PageHeader title={t("playgroundTitle")} description={t("playgroundDescription")} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {playgroundTools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </>
  );
}
