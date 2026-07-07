"use client";

import { useTranslations } from "next-intl";

import { useSidebarStore } from "@/stores/sidebar-store";

import { SidebarNav } from "./sidebar-nav";

export function ShellSidebar() {
  const tCommon = useTranslations("Common");
  const collapsed = useSidebarStore((s) => s.collapsed);
  return (
    <aside
      className={`hidden shrink-0 flex-col border-r transition-[width] lg:flex ${collapsed ? "w-14" : "w-56"}`}
    >
      <div
        className={`flex h-14 shrink-0 items-center border-b ${collapsed ? "justify-center px-0" : "px-4"}`}
      >
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {collapsed ? tCommon("appNameShort") : tCommon("appName")}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-3">
        <SidebarNav collapsed={collapsed} />
      </div>
    </aside>
  );
}
