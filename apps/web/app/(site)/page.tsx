import { PageHeader } from "@/components/shared/page-header";

export default function HomePage() {
  return (
    <>
      <PageHeader
        title="rfjs"
        description="Utilities, playgrounds, and developer data tools for the @rfjs/* ecosystem."
      />
      <p className="text-sm text-muted-foreground">Use the navigation to browse the skeleton.</p>
    </>
  );
}
