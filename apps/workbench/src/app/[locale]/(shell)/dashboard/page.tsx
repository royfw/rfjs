import { packageRegistry, toolRegistry } from "@rfjs/web-core";
import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/shell/page-header";
import { Link } from "@/i18n/navigation";

function Metric({ value, caption }: { value: number; caption: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{caption}</span>
    </div>
  );
}

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
      <PageHeader title={t("dashboardTitle")} description={t("dashboardDescription")} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Panel title={t("datasetsTitle")} className="text-muted-foreground">
          <span className="text-sm">{tCommon("comingSoon")}</span>
        </Panel>
        <Link
          href="/apps"
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Panel interactive title={t("appsTitle")}>
            <Metric value={apps.length} caption={t("dashboardAppsCaption")} />
          </Panel>
        </Link>
        <Panel title="@rfjs/*">
          <Metric value={packageRegistry.length} caption={t("dashboardPackagesCaption")} />
        </Panel>
      </div>
    </div>
  );
}
