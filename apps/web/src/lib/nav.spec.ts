import { describe, expect, it } from "vitest";

import { sidebarPackages, sidebarTools } from "./nav";

describe("sidebar nav", () => {
  it("lists every package", () => {
    expect(sidebarPackages().length).toBeGreaterThanOrEqual(10);
  });

  it("lists only web-surface quick tools (workbench apps excluded)", () => {
    const tools = sidebarTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every((t) => t.surface === "web")).toBe(true);
    expect(tools.some((t) => t.surface === "workbench")).toBe(false);
  });
});
