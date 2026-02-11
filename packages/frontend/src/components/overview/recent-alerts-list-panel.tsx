import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";
import { EmptyStatePlaceholder } from "@/components/shared/empty-state-placeholder";
import { cn } from "@/lib/classname-utils";
import { formatDistanceToNow } from "date-fns";

interface AlertEvent {
  id: string;
  ruleId: string;
  severity: "critical" | "warning" | "info";
  message: string;
  triggeredAt: Date;
  status: string;
}

export function RecentAlertsListPanel() {
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["recent-alerts"],
    queryFn: () =>
      apiClient.get<AlertEvent[]>("/alerts/recent", { limit: 8 }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <LoadingSkeletonPlaceholder key={i} className="h-12" />
        ))}
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return <EmptyStatePlaceholder message="No recent alerts" />;
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-status-critical border-status-critical";
      case "warning":
        return "text-status-warning border-status-warning";
      case "info":
        return "text-status-ok border-status-ok";
      default:
        return "text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-1.5">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "rounded border bg-surface p-2",
            getSeverityColor(alert.severity),
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded px-1 py-0.5 text-[10px] font-medium uppercase",
                    alert.severity === "critical"
                      ? "bg-status-critical/20 text-status-critical"
                      : alert.severity === "warning"
                        ? "bg-status-warning/20 text-status-warning"
                        : "bg-status-ok/20 text-status-ok",
                  )}
                >
                  {alert.severity}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-foreground">{alert.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
