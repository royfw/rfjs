"use client";
import * as React from "react";
import { SectionCard } from "@/components/shared/section-card";

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
  return (
    <SectionCard title={title} collapsible defaultOpen={defaultOpen} action={badge}>
      <div className="flex flex-col gap-2">{children}</div>
    </SectionCard>
  );
}
