import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  const tNav = await getTranslations("Nav");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("adminTitle")}</h1>
      <Panel>{tNav("adminLocked")}</Panel>
    </div>
  );
}
