import { create } from "zustand";

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

// Not persisted (unlike web's ui-store): avoids the hydration flash; revisit if users ask.
export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
}));
