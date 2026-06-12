"use client";

import { PanelLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@rfjs/web-ui/components/theme-toggle";

import { useSidebarStore } from "@/stores/sidebar-store";

import { LocaleSwitcher } from "./locale-switcher";

export function ShellTopbar() {
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");
  const toggle = useSidebarStore((s) => s.toggle);

  return (
    <header className="flex items-center gap-3 border-b px-4 py-2">
      <button
        type="button"
        aria-label={t("toggleSidebar")}
        onClick={toggle}
        className="rounded-sm p-1.5 transition-colors hover:bg-accent"
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
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {tCommon("github")}
        </a>
      </div>
    </header>
  );
}
