import type { ComponentType } from "react";

import type { routing } from "@/i18n/routing";

export type Locale = (typeof routing.locales)[number];

/** A tool's i18n fragment: one nested message object per locale. */
export type LocaleMessages = Record<Locale, Record<string, unknown>>;

/** apps/web local "implementation" registry entry, aligned to the @rfjs/web-core catalog by id. */
export interface ToolModule {
  id: string;
  Component: ComponentType;
}
