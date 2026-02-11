import { create } from "zustand";
import type { AlertEvent } from "@tinomail/shared";

interface AlertNotificationState {
  activeAlertCount: number;
  latestAlert: AlertEvent | null;
  addAlert: (alert: AlertEvent) => void;
  clearLatest: () => void;
  decrementCount: () => void;
  setActiveCount: (count: number) => void;
}

export const useAlertNotificationStore = create<AlertNotificationState>()(
  (set) => ({
    activeAlertCount: 0,
    latestAlert: null,

    addAlert: (alert: AlertEvent) => {
      set((state) => ({
        activeAlertCount: state.activeAlertCount + 1,
        latestAlert: alert,
      }));
    },

    clearLatest: () => {
      set({ latestAlert: null });
    },

    decrementCount: () => {
      set((state) => ({
        activeAlertCount: Math.max(0, state.activeAlertCount - 1),
      }));
    },

    setActiveCount: (count: number) => {
      set({ activeAlertCount: count });
    },
  }),
);
