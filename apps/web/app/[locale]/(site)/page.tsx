import { packageRegistry } from "@rfjs/web-core";
import { Button } from "@rfjs/web-ui/components/button";
import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Seam } from "@rfjs/web-ui/components/seam";
import Link from "next/link";

import { HeroSpecimen } from "@/components/home/hero-specimen";
import { PackageCard } from "@/components/shared/package-card";

const features = [
  {
    title: "Package Showcase",
    body: "Every tool is a live demo of an @rfjs/* package.",
    href: "/packages",
  },
  { title: "Data Tools", body: "Flatten, convert, decode — all in your browser.", href: "/tools" },
  {
    title: "Query & Filter Playground",
    body: "Build filters, compile them to SQL or Mongo.",
    href: "/playground",
  },
  {
    title: "Templates",
    body: "Scaffold TypeScript projects with start-ts-by.",
    href: "/templates",
  },
];

export default function HomePage() {
  const featuredPackages = packageRegistry.filter((p) => p.status === "ready").slice(0, 6);
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="text-intake">▸ left</span> becomes{" "}
            <span className="text-yield">right ◂</span>
          </span>
          <h1 className="font-sans text-4xl font-semibold tracking-tight sm:text-5xl">rfjs</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Utilities, playgrounds, and developer data tools for JSON, objects, filters, and query
            workflows. Data in one shape, out another — that transformation is the whole site.
          </p>
          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild>
                <Link href="/packages">View Packages</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/tools">Browse Tools</Link>
              </Button>
            </div>
            <CopyButton
              text="pnpm add @rfjs/object-utils"
              label="pnpm add @rfjs/object-utils"
              className="font-mono"
            />
          </div>
        </div>
        <HeroSpecimen />
      </section>

      <div aria-hidden="true">
        <Seam state="current" operation="explore" orientation="horizontal" />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-sans text-lg font-semibold tracking-tight">Start here</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Link
              key={f.title}
              href={f.href}
              className="group relative flex flex-col gap-2 overflow-hidden rounded-md border border-border bg-slab p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake focus-visible:ring-offset-2 focus-visible:ring-offset-bedrock"
            >
              {/* directional accent rule — appears on hover/focus, cool→warm intent */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-px origin-top scale-y-0 bg-intake transition-transform duration-150 group-hover:scale-y-100 group-focus-visible:scale-y-100"
              />
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-sans text-sm font-medium">{f.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{f.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-sans text-lg font-semibold tracking-tight">Packages</h2>
            <p className="text-xs text-muted-foreground">
              The @rfjs/* toolkit — each one a single data gesture.
            </p>
          </div>
          <Link
            href="/packages"
            className="shrink-0 rounded-sm font-mono text-xs text-intake transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake focus-visible:ring-offset-2 focus-visible:ring-offset-bedrock"
          >
            view all →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featuredPackages.map((pkg) => (
            <PackageCard key={pkg.name} pkg={pkg} />
          ))}
        </div>
      </section>
    </div>
  );
}
