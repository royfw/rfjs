import { describe, expect, it } from "vitest";

import { useSidebarStore } from "./sidebar-store";

describe("sidebar store", () => {
  it("starts expanded and toggles", () => {
    expect(useSidebarStore.getState().collapsed).toBe(false);
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().collapsed).toBe(true);
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });
});
