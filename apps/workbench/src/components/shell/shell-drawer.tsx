"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { Button } from "@rfjs/web-ui/components/button";

import { usePathname } from "@/i18n/navigation";
import { useSidebarStore } from "@/stores/sidebar-store";

import { SidebarNav } from "./sidebar-nav";

export function ShellDrawer() {
  const tCommon = useTranslations("Common");
  const open = useSidebarStore((s) => s.drawerOpen);
  const setOpen = useSidebarStore((s) => s.setDrawerOpen);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  // Close when the viewport grows to desktop.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setOpen]);

  // Escape to close, move focus into the panel on open, and restore focus to
  // the opener (the hamburger) on close — mirrors apps/web's mobile-nav.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <button
        aria-label={tCommon("closeMenu")}
        className="absolute inset-0 bg-foreground/40"
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        id="workbench-drawer"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={tCommon("appName")}
        className="relative z-10 flex h-full w-64 max-w-[80%] flex-col overflow-y-auto border-r bg-card outline-none"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {tCommon("appName")}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={tCommon("closeMenu")}
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex flex-col gap-1 p-3">
          <SidebarNav />
        </div>
      </div>
    </div>
  );
}
