"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

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
        className="absolute inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        id="workbench-drawer"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={tCommon("appName")}
        className="relative z-10 flex h-full w-64 max-w-[80%] flex-col gap-1 overflow-y-auto border-r bg-card p-3 outline-none"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="px-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {tCommon("appName")}
          </span>
          <button
            type="button"
            aria-label={tCommon("closeMenu")}
            onClick={() => setOpen(false)}
            className="rounded-sm p-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake"
          >
            <X className="size-4" />
          </button>
        </div>
        <SidebarNav />
      </div>
    </div>
  );
}
