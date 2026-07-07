"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";

export function Section({
  title,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  /** Optional indicator (e.g. a "has content" dot or count) shown at the header's end. */
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
        {title}
        {badge != null ? <span className="ml-auto flex items-center">{badge}</span> : null}
      </button>
      {open ? <div className="flex flex-col gap-2 border-t border-border p-3">{children}</div> : null}
    </div>
  );
}
