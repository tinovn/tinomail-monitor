import { create } from "zustand";
import { subHours, subDays } from "date-fns";

type TimePreset = "1h" | "6h" | "24h" | "7d" | "30d" | "custom";
type AutoRefreshInterval = 15 | 30 | 60 | 300 | false;

interface TimeRangeState {
  from: Date;
  to: Date;
  preset: TimePreset;
  autoRefresh: AutoRefreshInterval;
}

interface TimeRangeActions {
  setPreset: (preset: TimePreset) => void;
  setCustomRange: (from: Date, to: Date) => void;
  setAutoRefresh: (interval: AutoRefreshInterval) => void;
}

const getPresetRange = (preset: TimePreset): { from: Date; to: Date } => {
  const now = new Date();
  switch (preset) {
    case "1h":
      return { from: subHours(now, 1), to: now };
    case "6h":
      return { from: subHours(now, 6), to: now };
    case "24h":
      return { from: subHours(now, 24), to: now };
    case "7d":
      return { from: subDays(now, 7), to: now };
    case "30d":
      return { from: subDays(now, 30), to: now };
    default:
      return { from: subHours(now, 6), to: now };
  }
};

export const useTimeRangeStore = create<TimeRangeState & TimeRangeActions>()(
  (set) => ({
    ...getPresetRange("6h"),
    preset: "6h",
    autoRefresh: 30,

    setPreset: (preset: TimePreset) => {
      if (preset === "custom") return;
      const range = getPresetRange(preset);
      set({ ...range, preset });
    },

    setCustomRange: (from: Date, to: Date) => {
      set({ from, to, preset: "custom" });
    },

    setAutoRefresh: (interval: AutoRefreshInterval) => {
      set({ autoRefresh: interval });
    },
  }),
);
