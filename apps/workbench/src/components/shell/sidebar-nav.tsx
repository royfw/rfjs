"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

import { NAV } from "./nav-items";

const linkClass =
  "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake aria-[current=page]:text-signal";

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ key, href, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            title={t(key)}
            onClick={onNavigate}
            className={linkClass}
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
    </nav>
  );
}
