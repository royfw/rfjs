import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Templates — rfjs" };

export default function TemplatesPage() {
  return (
    <>
      <PageHeader title="Templates" description="start-ts-by project templates." />
      <p className="text-sm text-muted-foreground">
        Template gallery (sourced from templates/registry.json) arrives in a later phase.
      </p>
    </>
  );
}
