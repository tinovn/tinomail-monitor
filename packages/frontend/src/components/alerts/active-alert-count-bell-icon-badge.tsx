import { Bell } from "lucide-react";
import { useAlertNotificationStore } from "@/stores/alert-notification-toast-and-count-store";
import { cn } from "@/lib/classname-utils";

export function ActiveAlertCountBellIconBadge() {
  const activeAlertCount = useAlertNotificationStore((state) => state.activeAlertCount);

  if (activeAlertCount === 0) {
    return (
      <div className="relative">
        <Bell className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  // Determine badge color based on severity (assuming critical alerts increment differently)
  const badgeColor = activeAlertCount >= 5 ? "bg-red-500" : "bg-yellow-500";

  return (
    <div className="relative">
      <Bell className="h-5 w-5 text-foreground" />
      <span
        className={cn(
          "absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white",
          badgeColor
        )}
      >
        {activeAlertCount > 9 ? "9+" : activeAlertCount}
      </span>
    </div>
  );
}
