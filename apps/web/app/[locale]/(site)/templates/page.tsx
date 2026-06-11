import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shared/page-header";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pages" });
  return { title: `${t("templatesTitle")} — rfjs` };
}

export default async function TemplatesPage() {
  const t = await getTranslations("Pages");
  return (
    <>
      <PageHeader title={t("templatesTitle")} description={t("templatesDescription")} />
      <p className="text-sm text-muted-foreground">{t("templatesBody")}</p>
    </>
  );
}
