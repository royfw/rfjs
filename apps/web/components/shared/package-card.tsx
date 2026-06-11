import type { PackageDefinition } from "@rfjs/web-core";
import Link from "next/link";

export function PackageCard({ pkg }: { pkg: PackageDefinition }) {
  return (
    <Link
      href={pkg.href}
      className="flex flex-col gap-2 rounded-md border border-border bg-slab p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake focus-visible:ring-offset-2 focus-visible:ring-offset-bedrock"
    >
      <span className="font-mono text-sm text-signal">{pkg.name}</span>
      <p className="text-xs text-muted-foreground">{pkg.description}</p>
    </Link>
  );
}
