"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: string) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(
        // @ts-expect-error -- TypeScript validates that only known `params` are
        // used with a given `pathname`. They always match for the current route,
        // so runtime checks can be skipped (next-intl navigation docs).
        { pathname, params },
        { locale: next },
      );
    });
  }

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t("label")}>
      {routing.locales.map((cur) => (
        <Button
          key={cur}
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-pressed={cur === locale}
          className="font-mono text-[11px] aria-pressed:text-intake"
          onClick={() => switchTo(cur)}
        >
          {cur === "zh-TW" ? "中" : "EN"}
        </Button>
      ))}
    </div>
  );
}
