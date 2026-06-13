export interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="mb-6 border-b border-border pb-4">
      <h1 className="font-sans text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </header>
  );
}
