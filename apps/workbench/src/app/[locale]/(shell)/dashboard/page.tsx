import { packageRegistry, toolRegistry } from "@rfjs/web-core";
import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  const tCommon = await getTranslations("Common");
  const apps = toolRegistry.filter((tool) => tool.surface === "workbench");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("dashboardTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("dashboardDescription")}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Panel title={t("datasetsTitle")}>{tCommon("comingSoon")}</Panel>
        <Panel title={t("appsTitle")}>{apps.length}</Panel>
        <Panel title="@rfjs/*">{packageRegistry.length}</Panel>
      </div>
    </div>
  );
}
