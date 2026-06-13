import { packageRegistry, toolRegistry } from "@rfjs/web-core";
import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { ToolCard } from "@/components/shared/tool-card";
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
  const tTools = await getTranslations({ locale, namespace: "Tools" });
  const tStatus = await getTranslations({ locale, namespace: "Status" });

  const installCmd = `pnpm add ${pkg.name}`;
  const related = toolRegistry.filter((tool) => tool.relatedPackages?.includes(pkg.name));

  return (
    <>
      <PageHeader title={pkg.name} description={t(`${packageSlug(pkg.name)}.description`)} />

      <section className="mt-2 flex flex-col gap-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {tDetail("install")}
        </h2>
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-slab p-3">
          <code className="font-mono text-sm">{installCmd}</code>
          <CopyButton text={installCmd} label={tDetail("install")} />
        </div>
        <div className="flex gap-3 text-xs">
          {pkg.npm ? (
            <a href={pkg.npm} target="_blank" rel="noreferrer" className="text-intake hover:underline">
              {tDetail("viewOnNpm")}
            </a>
          ) : null}
          {pkg.github ? (
            <a href={pkg.github} target="_blank" rel="noreferrer" className="text-intake hover:underline">
              {tDetail("viewOnGithub")}
            </a>
          ) : null}
        </div>
      </section>

      {related.length > 0 ? (
        <section className="mt-6 flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {tDetail("relatedTools")}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {related.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                title={tTools(`${tool.id}.title`)}
                description={tTools(`${tool.id}.description`)}
                statusLabel={tStatus(tool.status)}
                workbenchLabel={tDetail("workbenchBadge")}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
