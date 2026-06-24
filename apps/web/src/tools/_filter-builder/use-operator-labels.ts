"use client";

import { OPERATOR_KEYS } from "@rfjs/filter-builder-ui";
import { useTranslations } from "next-intl";

/** Build an op-key -> localized label map from the central `Operators` namespace. */
export function useOperatorLabels(): Record<string, string> {
  const t = useTranslations("Operators");
  return Object.fromEntries(OPERATOR_KEYS.map((k) => [k, t(k)]));
}
