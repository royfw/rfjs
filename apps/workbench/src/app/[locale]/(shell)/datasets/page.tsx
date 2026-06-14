import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";

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
      <h1 className="text-xl font-semibold">{t("datasetsTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("datasetsDescription")}</p>
      <Panel>
        {!result.ok ? (
          <span className="text-sm text-destructive">{t("datasetsError")}</span>
        ) : result.datasets.length === 0 ? (
          <span className="text-sm text-muted-foreground">{t("datasetsEmpty")}</span>
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
