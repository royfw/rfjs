import { packageRegistry } from "@rfjs/web-core";
import type { Metadata } from "next";

import { PackageCard } from "@/components/shared/package-card";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Packages — rfjs" };

export default function PackagesPage() {
  return (
    <>
      <PageHeader title="Packages" description="The @rfjs/* utility toolkit." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {packageRegistry.map((pkg) => (
          <PackageCard key={pkg.name} pkg={pkg} />
        ))}
      </div>
    </>
  );
}
