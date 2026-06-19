import { packageRegistry, toolRegistry } from "@rfjs/web-core";
import { describe, expect, it } from "vitest";

import { sidebarToolGroups } from "./nav";

describe("sidebarToolGroups", () => {
  it("emits groups in packageRegistry order, only packages that have web tools", () => {
    const webPrimaries = new Set(
      toolRegistry.filter((t) => t.surface === "web").map((t) => t.relatedPackages?.[0]),
    );
    const expected = packageRegistry.map((p) => p.name).filter((name) => webPrimaries.has(name));

    expect(sidebarToolGroups().map((g) => g.pkg.name)).toEqual(expected);
    // a lib-only package with no web tool must not appear
    expect(sidebarToolGroups().some((g) => g.pkg.name === "@rfjs/pg-toolkit")).toBe(false);
  });

  it("places every web tool under exactly one group (no orphans, no dupes)", () => {
    const webIds = toolRegistry
      .filter((t) => t.surface === "web")
      .map((t) => t.id)
      .sort();
    const groupedIds = sidebarToolGroups()
      .flatMap((g) => g.tools.map((t) => t.id))
      .sort();

    expect(groupedIds).toEqual(webIds);
  });

  it("places a multi-package tool under its primary package only", () => {
    const groups = sidebarToolGroups();
    const jsonb = groups.find((g) => g.pkg.name === "@rfjs/jsonb-query");
    const dataFilter = groups.find((g) => g.pkg.name === "@rfjs/data-filter");

    expect(jsonb?.tools.map((t) => t.id)).toContain("query-builder");
    expect(dataFilter?.tools.map((t) => t.id) ?? []).not.toContain("query-builder");
  });

  it("keeps tools within a group in toolRegistry order", () => {
    const jsonb = sidebarToolGroups().find((g) => g.pkg.name === "@rfjs/jsonb-query");
    expect(jsonb?.tools.map((t) => t.id)).toEqual([
      "jsonb-query-generator",
      "query-builder",
      "jsonb-query-builder",
    ]);
  });

  it("excludes workbench-surface tools", () => {
    const ids = sidebarToolGroups().flatMap((g) => g.tools.map((t) => t.id));
    expect(ids).not.toContain("object-transformer");
  });
});
