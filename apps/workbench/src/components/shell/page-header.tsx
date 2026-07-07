import type { ReactNode } from "react";

/**
 * Page-level heading used across the (shell) routes: a primary title plus an
 * optional supporting description. Keeps the title/description rhythm uniform so
 * pages don't each re-spell the same Tailwind classes.
 */
export function PageHeader({
  title,
  description,
  mono = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Render the title in the mono face (used for slug-style headings). */
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className={`text-xl font-semibold ${mono ? "font-mono" : ""}`}>{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
