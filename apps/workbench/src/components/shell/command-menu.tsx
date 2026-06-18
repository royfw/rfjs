"use client";

import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

import { NAV } from "./nav-items";

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations("CommandMenu");
  const tNav = useTranslations("Nav");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label={t("placeholder")}
      className="fixed left-1/2 top-1/4 z-50 w-full max-w-md -translate-x-1/2 rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg"
      overlayClassName="fixed inset-0 z-40 bg-foreground/40"
    >
      <Command.Input
        placeholder={t("placeholder")}
        className="w-full border-b bg-transparent px-2 py-2 text-sm outline-none"
      />
      <Command.List className="max-h-60 overflow-auto pt-2">
        <Command.Empty className="px-2 py-4 text-sm text-muted-foreground">{t("empty")}</Command.Empty>
        <Command.Group
          heading={t("navigation")}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          {NAV.map(({ key, href }) => (
            <Command.Item
              key={key}
              onSelect={() => {
                router.push(href);
                setOpen(false);
              }}
              className="cursor-pointer rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
            >
              {tNav(key)}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
