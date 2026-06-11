"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { AppSidebar } from "./app-sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <Button variant="ghost" size="icon" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu className="size-5" />
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-bedrock/70"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 h-full w-72 max-w-[80%] overflow-y-auto border-r border-border bg-slab">
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X className="size-5" />
              </Button>
            </div>
            <div onClick={() => setOpen(false)}>
              <AppSidebar />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
