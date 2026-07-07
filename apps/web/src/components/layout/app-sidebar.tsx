"use client";

import { Seam } from "@rfjs/web-ui/components/seam";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { sidebarToolGroups } from "@/lib/nav";
import { toolHref } from "@/lib/tool-href";

export function AppSidebar() {
  const t = useTranslations("Tools");
  const tNav = useTranslations("Pages");
  const pathname = usePathname();
  const groups = sidebarToolGroups();

  const toolLinkClass =
    "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake aria-[current=page]:text-foreground";
  const headerLinkClass =
    "rounded-sm px-2 py-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake aria-[current=page]:text-foreground";
  const seam = (active: boolean) => (
    <span className="h-4 w-px">
      {active ? <Seam state="current" operation="" orientation="vertical" /> : null}
    </span>
  );

  return (
    <nav aria-label={tNav("toolsTitle")} className="flex flex-col gap-5 p-4">
      {groups.map(({ pkg, tools }) => {
        const pkgActive = pathname === pkg.href;
        return (
          <div key={pkg.name} className="flex flex-col gap-1">
            <Link
              href={pkg.href}
              aria-current={pkgActive ? "page" : undefined}
              className={headerLinkClass}
            >
              {pkg.name.replace("@rfjs/", "")}
            </Link>
            {tools.map((tool) => {
              const href = toolHref(tool);
              const active = pathname === href;
              return (
                <Link
                  key={tool.id}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={toolLinkClass}
                >
                  {seam(active)}
                  {t(`${tool.id}.title`)}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
