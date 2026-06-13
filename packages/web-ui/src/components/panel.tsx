import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export interface PanelProps {
  title?: string;
  children?: ReactNode;
  className?: string;
}

export function Panel({ title, children, className }: PanelProps) {
  return (
    <section className={cn("rounded-lg border bg-card text-card-foreground", className)}>
      {title ? (
        <h2 className="border-b px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}
