"use client";

import { Menu, PanelLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@rfjs/web-ui/components/button";
import { ThemeToggle } from "@rfjs/web-ui/components/theme-toggle";

import { useSidebarStore } from "@/stores/sidebar-store";

import { LocaleSwitcher } from "./locale-switcher";

export function ShellTopbar() {
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const setDrawerOpen = useSidebarStore((s) => s.setDrawerOpen);
  const drawerOpen = useSidebarStore((s) => s.drawerOpen);

  return (
    <header className="flex h-14 items-center gap-3 border-b px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={tCommon("openMenu")}
        aria-expanded={drawerOpen}
        aria-controls="workbench-drawer"
        onClick={() => setDrawerOpen(true)}
        className="lg:hidden"
      >
        <Menu className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("toggleSidebar")}
        aria-expanded={!collapsed}
        onClick={toggleCollapsed}
        className="hidden lg:inline-flex"
      >
        <PanelLeft className="size-4" />
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
        <Button asChild variant="ghost" size="sm">
          <a href="https://github.com/royfw/rfjs" target="_blank" rel="noreferrer">
            {tCommon("github")}
          </a>
        </Button>
      </div>
    </header>
  );
}
