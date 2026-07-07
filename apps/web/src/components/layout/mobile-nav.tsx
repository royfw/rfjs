"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AppSidebar } from "./app-sidebar";

export function MobileNav() {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // Lock background scroll while the drawer is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <Button
        ref={openerRef}
        variant="ghost"
        size="icon"
        aria-label={t("openMenu")}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      {/* Portal to <body>: the header's `backdrop-blur` makes it the containing
          block for `position: fixed` descendants, which would trap this overlay
          inside the 56px header. Rendering at the body escapes that. */}
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex">
              <button
                aria-label={t("closeMenu")}
                className="absolute inset-0 bg-bedrock/70"
                onClick={() => setOpen(false)}
              />
              <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={t("openMenu")}
                className="relative z-10 h-full w-72 max-w-[80%] overflow-y-auto border-r border-border bg-slab outline-none"
              >
                <div className="flex justify-end p-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("closeMenu")}
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-5" />
                  </Button>
                </div>
                <div onClick={() => setOpen(false)}>
                  <AppSidebar />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
