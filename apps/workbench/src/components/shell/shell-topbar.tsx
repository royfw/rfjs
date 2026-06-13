"use client";

import { Menu, PanelLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@rfjs/web-ui/components/theme-toggle";

import { useSidebarStore } from "@/stores/sidebar-store";

import { LocaleSwitcher } from "./locale-switcher";

const btnClass =
  "rounded-sm p-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake";

export function ShellTopbar() {
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const setDrawerOpen = useSidebarStore((s) => s.setDrawerOpen);
  const drawerOpen = useSidebarStore((s) => s.drawerOpen);

  return (
    <header className="flex items-center gap-3 border-b px-4 py-2">
      <button
        type="button"
        aria-label={tCommon("openMenu")}
        aria-expanded={drawerOpen}
        aria-controls="workbench-drawer"
        onClick={() => setDrawerOpen(true)}
        className={`${btnClass} lg:hidden`}
      >
        <Menu className="size-4" />
      </button>
      <button
        type="button"
        aria-label={t("toggleSidebar")}
        aria-expanded={!collapsed}
        onClick={toggleCollapsed}
        className={`${btnClass} hidden lg:inline-flex`}
      >
        <PanelLeft className="size-4" />
      </button>
      <div className="ml-auto flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
        <a
          href="https://github.com/royfw/rfjs"
          target="_blank"
          rel="noreferrer"
          className="rounded-sm px-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake"
        >
          {tCommon("github")}
        </a>
      </div>
    </header>
  );
}
