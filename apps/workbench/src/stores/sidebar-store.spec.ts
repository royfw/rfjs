import { beforeEach, describe, expect, it } from "vitest";

import { useSidebarStore } from "./sidebar-store";

describe("sidebar store", () => {
  beforeEach(() => {
    useSidebarStore.setState({ collapsed: false, drawerOpen: false });
  });

  it("desktop rail starts expanded and toggles", () => {
    expect(useSidebarStore.getState().collapsed).toBe(false);
    useSidebarStore.getState().toggleCollapsed();
    expect(useSidebarStore.getState().collapsed).toBe(true);
    useSidebarStore.getState().toggleCollapsed();
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });

  it("mobile drawer open/close is independent of rail collapse", () => {
    useSidebarStore.getState().setDrawerOpen(true);
    expect(useSidebarStore.getState().drawerOpen).toBe(true);
    expect(useSidebarStore.getState().collapsed).toBe(false);
    useSidebarStore.getState().toggleCollapsed();
    expect(useSidebarStore.getState().drawerOpen).toBe(true);
    useSidebarStore.getState().setDrawerOpen(false);
    expect(useSidebarStore.getState().drawerOpen).toBe(false);
  });
});
