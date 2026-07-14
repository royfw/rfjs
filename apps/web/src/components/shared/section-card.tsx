"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export type SectionTab = { id: string; label: string };

/**
 * The single studio-style section card (design D2). Header is either a solo
 * mono-uppercase title (slab) or a tab-strip (underline-active). Optionally
 * collapsible (controlled via open/onOpenChange, else uncontrolled via
 * defaultOpen) — the studio look includes collapsible cards (AiPanel). Supersedes
 * the hand-rolled card recipes. `className`/`style` reach the <section> (so
 * `fb-rise` animation survives); `bodyClassName` overrides the default p-4 body
 * (so the filter-logic canvas keeps `overflow-x-auto p-5 sm:p-6`).
 */
export function SectionCard({
  title,
  tabs,
  activeTab,
  onTabChange,
  action,
  collapsible,
  collapseLabel,
  defaultOpen = true,
  open,
  onOpenChange,
  className,
  style,
  bodyClassName,
  children,
}: {
  title?: string;
  tabs?: SectionTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  action?: React.ReactNode;
  collapsible?: boolean;
  collapseLabel?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = collapsible ? (isControlled ? open : internalOpen) : true;

  function toggle() {
    onOpenChange?.(!isOpen);
    if (!isControlled) setInternalOpen((v) => !v);
  }

  const titleEl = title ? (
    <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{title}</h2>
  ) : null;

  const tabStrip =
    tabs && tabs.length > 0 ? (
      <>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange?.(t.id)}
            aria-selected={activeTab === t.id}
            className={`px-4 py-2 text-[13px] font-medium transition-colors ${
              activeTab === t.id
                ? "bg-card font-semibold text-primary shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </>
    ) : null;

  const hasHeader = Boolean(titleEl) || Boolean(tabStrip) || Boolean(action) || collapsible;

  return (
    <section
      className={`overflow-hidden rounded-lg border bg-card text-card-foreground${className ? ` ${className}` : ""}`}
      style={style}
    >
      {hasHeader ? (
        collapsible ? (
          tabs && tabs.length > 0 ? (
            <div className="flex items-stretch border-b bg-muted/30">
              <button
                type="button"
                onClick={toggle}
                aria-expanded={isOpen}
                aria-label={collapseLabel}
                className="flex items-center px-3 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
              {tabStrip}
              {action ? <div className="ml-auto flex items-center px-4">{action}</div> : null}
            </div>
          ) : (
            <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
              <button
                type="button"
                onClick={toggle}
                aria-expanded={isOpen}
                className="flex flex-1 items-center gap-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                {titleEl}
              </button>
              {action}
            </div>
          )
        ) : tabStrip ? (
          <div className="flex items-stretch border-b bg-muted/30">
            {tabStrip}
            {action ? <div className="ml-auto flex items-center px-4">{action}</div> : null}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
            {titleEl ?? <span />}
            {action}
          </div>
        )
      ) : null}
      {isOpen ? <div className={bodyClassName ?? "p-4"}>{children}</div> : null}
    </section>
  );
}
