"use client";

import { Seam } from "@rfjs/web-ui/components/seam";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { sidebarPackages, sidebarTools } from "@/lib/nav";
import { toolHref } from "@/lib/tool-href";

export function AppSidebar() {
  const t = useTranslations("Tools");
  const tNav = useTranslations("Pages");
  const pathname = usePathname();
  const packages = sidebarPackages();
  const tools = sidebarTools();

  const linkClass =
    "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake aria-[current=page]:text-signal";
  const seam = (active: boolean) => (
    <span className="h-4 w-px">
      {active ? <Seam state="current" operation="" orientation="vertical" /> : null}
    </span>
  );

  return (
    <nav aria-label={tNav("packagesTitle")} className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-1">
        <span className="px-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {tNav("packagesTitle")}
        </span>
        {packages.map((pkg) => {
          const active = pathname === pkg.href;
          return (
            <Link key={pkg.name} href={pkg.href} aria-current={active ? "page" : undefined} className={linkClass}>
              {seam(active)}
              {pkg.name.replace("@rfjs/", "")}
            </Link>
          );
        })}
      </div>
      <div className="flex flex-col gap-1">
        <span className="px-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {tNav("toolsTitle")}
        </span>
        {tools.map((tool) => {
          const href = toolHref(tool);
          const active = pathname === href;
          return (
            <Link key={tool.id} href={href} aria-current={active ? "page" : undefined} className={linkClass}>
              {seam(active)}
              {t(`${tool.id}.title`)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
