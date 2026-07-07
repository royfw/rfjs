import type { Metadata } from "next";
import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";

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

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  return (
    <>
      <PageHeader title={t("templatesTitle")} description={t("templatesDescription")} />
      <Panel className="mt-4">
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            ▸ soon ◂
          </span>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {t("templatesBody")}
          </p>
        </div>
      </Panel>
    </>
  );
}
