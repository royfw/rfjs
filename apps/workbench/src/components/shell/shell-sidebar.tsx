"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { useSidebarStore } from "@/stores/sidebar-store";

import { NAV } from "./nav-items";

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
            {collapsed ? <span className="sr-only">{t(key)}</span> : t(key)}
          </Link>
        );
      })}
      <span
        title={t("adminLocked")}
        aria-disabled="true"
        aria-label={t("adminLocked")}
        className="flex cursor-not-allowed items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground/60"
      >
        <Lock className="size-4 shrink-0" />
        {collapsed ? <span className="sr-only">{t("admin")}</span> : t("admin")}
      </span>
    </aside>
  );
}
