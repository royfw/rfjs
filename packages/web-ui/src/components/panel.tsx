import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export interface PanelProps {
  title?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Panel({ title, action, children, className }: PanelProps) {
  const hasHeader = Boolean(title) || Boolean(action);
  return (
    <section className={cn("rounded-lg border bg-card text-card-foreground", className)}>
      {hasHeader ? (
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          {title ? (
            <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}
