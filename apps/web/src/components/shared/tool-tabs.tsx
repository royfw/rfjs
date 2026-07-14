"use client";

import type { SectionTab } from "./section-card";

/** Top-level panel switcher (segmented pill bar). Plain <button>s (role=button) so
 * consumers' getByRole("button", …) tab queries keep working. Dedupes the copied bar. */
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
    <div aria-label={ariaLabel} className="inline-flex w-fit gap-0.5 rounded-lg border border-input bg-muted/30 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
            active === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
