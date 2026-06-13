import { toolRegistry } from "@rfjs/web-core";
import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return toolRegistry
    .filter((tool) => tool.surface === "workbench")
    .map((tool) => ({ slug: tool.id }));
}

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const app = toolRegistry.find((tool) => tool.surface === "workbench" && tool.id === slug);
  if (!app) notFound();
  const tCommon = await getTranslations("Common");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-mono text-xl">{app.id}</h1>
      <Panel>{tCommon("comingSoon")}</Panel>
    </div>
  );
}
