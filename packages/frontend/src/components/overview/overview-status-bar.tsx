import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { cn } from "@/lib/classname-utils";

interface OverviewSummary {
  nodes: {
    total: number;
    active: number;
    warning: number;
    critical: number;
  };
  email: {
    sent24h: number;
    bounced24h: number;
    deferred24h: number;
    queueSize: number;
  };
  ips: {
    total: number;
    active: number;
    paused: number;
    quarantine: number;
    blacklisted: number;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };
}

export function OverviewStatusBar() {
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data, isLoading } = useQuery({
    queryKey: ["overview"],
    queryFn: () => apiClient.get<OverviewSummary>("/overview"),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 rounded-md border border-border bg-surface p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="h-3 w-16 bg-muted animate-pulse rounded"></div>
            <div className="h-6 w-20 bg-muted animate-pulse rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const clusterHealth =
    data.nodes.critical > 0 ? "critical" : data.nodes.warning > 0 ? "warning" : "ok";

  const deliveredCount = data.email.sent24h - data.email.bounced24h - data.email.deferred24h;
  const deliveredRate = data.email.sent24h > 0
    ? ((deliveredCount / data.email.sent24h) * 100).toFixed(1)
    : "0";

  const bounceRate = data.email.sent24h > 0
    ? ((data.email.bounced24h / data.email.sent24h) * 100).toFixed(2)
    : "0";

  const activeAlerts = data.alerts.critical + data.alerts.warning + data.alerts.info;

  const healthColor =
    clusterHealth === "critical"
      ? "text-status-critical"
      : clusterHealth === "warning"
        ? "text-status-warning"
        : "text-status-ok";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 rounded-md border border-border bg-surface p-3">
      <div className="flex flex-col gap-1">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Cluster Health
        </div>
        <div className={cn("text-lg font-bold font-mono-data", healthColor)}>
          {clusterHealth.toUpperCase()}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Sent 24h
        </div>
        <div className="text-lg font-bold font-mono-data text-foreground">
          {(data.email.sent24h ?? 0).toLocaleString()}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Delivered Rate
        </div>
        <div className="text-lg font-bold font-mono-data text-foreground">
          {deliveredRate}%
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Bounce Rate
        </div>
        <div className="text-lg font-bold font-mono-data text-foreground">
          {bounceRate}%
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Queue Size
        </div>
        <div className="text-lg font-bold font-mono-data text-foreground">
          {(data.email.queueSize ?? 0).toLocaleString()}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Active Alerts
        </div>
        <div
          className={cn(
            "text-lg font-bold font-mono-data",
            activeAlerts > 0 ? "text-status-warning" : "text-foreground",
          )}
        >
          {activeAlerts}
        </div>
      </div>
    </div>
  );
}
