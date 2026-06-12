import { describe, expect, it } from "vitest";

import { buildSidebarNav } from "./nav";

describe("buildSidebarNav", () => {
  it("groups tools under their related package name", () => {
    const groups = buildSidebarNav();
    const objectUtils = groups.find((g) => g.packageName === "@rfjs/object-utils");
    expect(objectUtils).toBeDefined();
    expect(objectUtils!.tools.map((t) => t.id)).toContain("object-flatten");
  });

  it("every tool appears in exactly one group", () => {
    const groups = buildSidebarNav();
    const ids = groups.flatMap((g) => g.tools.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
