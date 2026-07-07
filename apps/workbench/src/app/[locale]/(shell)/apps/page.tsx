import { toolRegistry } from "@rfjs/web-core";
import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/shell/page-header";
import { Link } from "@/i18n/navigation";

export default async function AppsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  const apps = toolRegistry.filter((tool) => tool.surface === "workbench");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("appsTitle")} description={t("appsDescription")} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {apps.map((app) => (
          <Link
            key={app.id}
            href={`/apps/${app.id}`}
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Panel interactive title={app.id}>
              {app.tags?.join(" · ")}
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
