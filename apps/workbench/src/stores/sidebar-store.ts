import { create } from "zustand";

interface SidebarState {
  // Desktop rail width preference. Not persisted (unlike web's ui-store):
  // avoids the hydration flash; revisit if users ask.
  collapsed: boolean;
  toggleCollapsed: () => void;
  // Mobile drawer overlay — independent of the desktop rail collapse.
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  drawerOpen: false,
  setDrawerOpen: (open) => set({ drawerOpen: open }),
}));
