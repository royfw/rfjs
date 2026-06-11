import { packageRegistry } from "@rfjs/web-core";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";

export function generateStaticParams() {
  return packageRegistry.map((pkg) => ({ slug: pkg.href.split("/").pop()! }));
}

export default async function PackageDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pkg = packageRegistry.find((p) => p.href === `/packages/${slug}`);
  if (!pkg) notFound();
  return (
    <>
      <PageHeader title={pkg.name} description={pkg.description} />
      <p className="text-sm text-muted-foreground">Package detail + playground arrive in a later phase.</p>
    </>
  );
}
