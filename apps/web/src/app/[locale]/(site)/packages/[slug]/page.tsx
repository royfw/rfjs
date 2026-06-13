import { packageRegistry } from "@rfjs/web-core";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { packageSlug } from "@/lib/i18n-content";

export function generateStaticParams() {
  return packageRegistry.map((pkg) => ({ slug: pkg.href.split("/").pop()! }));
}

export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const pkg = packageRegistry.find((p) => p.href === `/packages/${slug}`);
  if (!pkg) notFound();
  const t = await getTranslations({ locale, namespace: "Packages" });
  const tDetail = await getTranslations({ locale, namespace: "Detail" });
  return (
    <>
      <PageHeader title={pkg.name} description={t(`${packageSlug(pkg.name)}.description`)} />
      <p className="text-sm text-muted-foreground">{tDetail("packageComingSoon")}</p>
    </>
  );
}
