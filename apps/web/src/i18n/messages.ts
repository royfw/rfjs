import type { Locale } from "@/tools/types";
import { toolMessages } from "@/tools/messages";

import en from "../messages/en.json";
import zhTW from "../messages/zh-TW.json";

const central: Record<Locale, Record<string, unknown>> = { en, "zh-TW": zhTW };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown>,
): T {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const prev = out[k];
    out[k] = isPlainObject(prev) && isPlainObject(v) ? deepMerge(prev, v) : v;
  }
  return out as T;
}

export function assembleMessages(locale: Locale): Record<string, unknown> {
  return toolMessages
    .map((m) => m[locale])
    .reduce<Record<string, unknown>>((acc, frag) => deepMerge(acc, frag), { ...central[locale] });
}
