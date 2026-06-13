import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function DatasetsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  const tCommon = await getTranslations("Common");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("datasetsTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("datasetsDescription")}</p>
      <Panel>{tCommon("comingSoon")}</Panel>
    </div>
  );
}
