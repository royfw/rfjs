import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Dataset = { id: string; name: string; description: string | null };

async function fetchDatasets(): Promise<Dataset[]> {
  const base = process.env.API_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base}/datasets`, { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as Dataset[];
  } catch {
    return [];
  }
}

export default async function DatasetsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  const datasets = await fetchDatasets();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("datasetsTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("datasetsDescription")}</p>
      <Panel>
        {datasets.length === 0 ? (
          <span className="text-sm text-muted-foreground">No datasets yet.</span>
        ) : (
          <ul className="flex flex-col gap-2">
            {datasets.map((d) => (
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
