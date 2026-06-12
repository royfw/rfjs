import { toolRegistry } from "@rfjs/web-core";
import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";

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
      <h1 className="text-xl font-semibold">{t("appsTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("appsDescription")}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {apps.map((app) => (
          <Link key={app.id} href={`/apps/${app.id}`}>
            <Panel title={app.id}>{app.tags?.join(" · ")}</Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
