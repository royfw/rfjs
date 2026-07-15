"use client";

import type { SectionTab } from "./section-card";

/** Top-level panel switcher: a gold-underline tab bar. Shares the active-state language
 * with SectionCard's in-card tab-strip (text-primary + a primary underline), but stands
 * on the page rather than inside a card header — signalling a whole-tool mode switch
 * (e.g. Canvas / Preview / JSON) rather than an in-card view switch. Plain <button>s
 * (role=button) so consumers' getByRole("button", …) tab queries keep working. */
export function ToolTabs({
  tabs,
  active,
  onChange,
  ariaLabel,
}: {
  tabs: SectionTab[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div aria-label={ariaLabel} className="flex w-full gap-1 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-4 py-2 text-[13px] font-medium transition-colors ${
            active === t.id
              ? "border-primary font-semibold text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
