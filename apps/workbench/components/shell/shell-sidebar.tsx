"use client";

import { Boxes, Database, LayoutDashboard, Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { useSidebarStore } from "@/stores/sidebar-store";

const NAV = [
  { key: "dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { key: "datasets", href: "/datasets", Icon: Database },
  { key: "apps", href: "/apps", Icon: Boxes },
] as const;

export function ShellSidebar() {
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");
  const pathname = usePathname();
  const collapsed = useSidebarStore((s) => s.collapsed);

  return (
    <aside
      className={`flex shrink-0 flex-col gap-1 border-r p-3 transition-[width] ${collapsed ? "w-14" : "w-56"}`}
    >
      <span className="mb-3 px-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        {collapsed ? "rf" : tCommon("appName")}
      </span>
      {NAV.map(({ key, href, Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            title={t(key)}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent aria-[current=page]:text-signal"
          >
            <Icon className="size-4 shrink-0" />
            {collapsed ? null : t(key)}
          </Link>
        );
      })}
      <span
        title={t("adminLocked")}
        className="flex cursor-not-allowed items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground/60"
      >
        <Lock className="size-4 shrink-0" />
        {collapsed ? null : t("admin")}
      </span>
    </aside>
  );
}
