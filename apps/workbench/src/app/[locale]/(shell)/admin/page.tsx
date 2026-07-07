import { Panel } from "@rfjs/web-ui/components/panel";
import { Lock } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/shell/page-header";

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
      <PageHeader title={t("adminTitle")} description={t("adminDescription")} />
      <Panel>
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <Lock className="size-6" />
          <span>{tNav("adminLocked")}</span>
        </div>
      </Panel>
    </div>
  );
}
