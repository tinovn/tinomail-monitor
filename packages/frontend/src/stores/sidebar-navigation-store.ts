import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  collapsed: boolean;
  activeSection: string;
}

interface SidebarActions {
  toggleCollapse: () => void;
  setActiveSection: (section: string) => void;
}

export const useSidebarStore = create<SidebarState & SidebarActions>()(
  persist(
    (set) => ({
      collapsed: false,
      activeSection: "overview",

      toggleCollapse: () => {
        set((state) => ({ collapsed: !state.collapsed }));
      },

      setActiveSection: (section: string) => {
        set({ activeSection: section });
      },
    }),
    {
      name: "sidebar-storage",
    },
  ),
);
