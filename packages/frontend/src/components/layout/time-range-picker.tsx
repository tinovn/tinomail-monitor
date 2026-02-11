import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { cn } from "@/lib/classname-utils";

const presets = [
  { value: "1h" as const, label: "1h" },
  { value: "6h" as const, label: "6h" },
  { value: "24h" as const, label: "24h" },
  { value: "7d" as const, label: "7d" },
  { value: "30d" as const, label: "30d" },
];

export function TimeRangePicker() {
  const { preset, setPreset } = useTimeRangeStore();

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
      {presets.map((item) => (
        <button
          key={item.value}
          onClick={() => setPreset(item.value)}
          className={cn(
            "rounded px-3 py-1 text-xs font-medium transition-colors",
            preset === item.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
