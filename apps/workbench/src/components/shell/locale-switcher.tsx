"use client";

import { Button } from "@rfjs/web-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rfjs/web-ui/components/dropdown-menu";
import { Check, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  "zh-TW": "繁體中文",
};

const LOCALE_SHORT: Record<string, string> = {
  en: "EN",
  "zh-TW": "繁中",
};

export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("LocaleSwitcher");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("label")} className="gap-1.5">
          <Languages className="size-4" />
          {LOCALE_SHORT[locale] ?? locale}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onSelect={() =>
              router.replace(pathname, { locale: l as (typeof routing.locales)[number] })
            }
          >
            <Check className={l === locale ? "size-4 opacity-100" : "size-4 opacity-0"} />
            {LOCALE_LABELS[l] ?? l}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
