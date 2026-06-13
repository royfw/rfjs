"use client";

import { useTranslations } from "next-intl";

import { useSidebarStore } from "@/stores/sidebar-store";

import { SidebarNav } from "./sidebar-nav";

export function ShellSidebar() {
  const tCommon = useTranslations("Common");
  const collapsed = useSidebarStore((s) => s.collapsed);
  return (
    <aside
      className={`hidden shrink-0 flex-col gap-1 border-r p-3 transition-[width] lg:flex ${collapsed ? "w-14" : "w-56"}`}
    >
      <span className="mb-3 px-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        {collapsed ? tCommon("appNameShort") : tCommon("appName")}
      </span>
      <SidebarNav collapsed={collapsed} />
    </aside>
  );
}
