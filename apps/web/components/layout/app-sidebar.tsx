"use client";

import { Seam } from "@rfjs/web-ui/components/seam";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { buildSidebarNav } from "@/lib/nav";

export function AppSidebar() {
  const t = useTranslations("Tools");
  const tNav = useTranslations("Pages");
  const pathname = usePathname();
  const groups = buildSidebarNav();
  return (
    <nav aria-label={tNav("toolsTitle")} className="flex flex-col gap-5 p-4">
      {groups.map((group) => (
        <div key={group.packageName} className="flex flex-col gap-1">
          <span className="px-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {group.packageName.replace("@rfjs/", "")}
          </span>
          {group.tools.map((tool) => {
            const active = pathname === tool.href;
            return (
              <Link
                key={tool.id}
                href={tool.href}
                aria-current={active ? "page" : undefined}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake aria-[current=page]:text-signal"
              >
                <span className="h-4 w-px">
                  {active ? <Seam state="current" operation="" orientation="vertical" /> : null}
                </span>
                {t(`${tool.id}.title`)}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
