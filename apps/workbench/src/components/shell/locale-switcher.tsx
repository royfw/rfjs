"use client";

import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("LocaleSwitcher");
  return (
    <select
      aria-label={t("label")}
      value={locale}
      onChange={(e) =>
        router.replace(pathname, { locale: e.target.value as (typeof routing.locales)[number] })
      }
      className="rounded-sm border bg-transparent px-2 py-1 text-sm"
    >
      {routing.locales.map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
    </select>
  );
}
