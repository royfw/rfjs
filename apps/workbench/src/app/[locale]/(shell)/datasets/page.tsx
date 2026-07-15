import { Panel } from "@rfjs/web-ui/components/panel";
import { AlertTriangle, Inbox } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/shell/page-header";
import { fetchDatasets } from "@/lib/datasets";

export default async function DatasetsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  const result = await fetchDatasets();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("datasetsTitle")} description={t("datasetsDescription")} />
      <Panel>
        {!result.ok ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-fault">
            <AlertTriangle className="size-6" />
            <span>{t("datasetsError")}</span>
          </div>
        ) : result.datasets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Inbox className="size-6" />
            <span>{t("datasetsEmpty")}</span>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {result.datasets.map((d) => (
              <li key={d.id} className="text-sm">
                <span className="font-medium">{d.name}</span>
                {d.description ? (
                  <span className="text-muted-foreground"> — {d.description}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
