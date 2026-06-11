import { packageRegistry } from "@rfjs/web-core";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PackageCard } from "@/components/shared/package-card";
import { PageHeader } from "@/components/shared/page-header";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pages" });
  return { title: `${t("packagesTitle")} — rfjs` };
}

export default async function PackagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  return (
    <>
      <PageHeader title={t("packagesTitle")} description={t("packagesDescription")} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {packageRegistry.map((pkg) => (
          <PackageCard key={pkg.name} pkg={pkg} />
        ))}
      </div>
    </>
  );
}
