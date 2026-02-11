import { cn } from "@/lib/classname-utils";

interface ReportSummaryStats {
  totalSent: number;
  bounceRate: number;
  deliveredPercent: number;
  clusterHealth: "healthy" | "degraded" | "critical";
  activeAlerts: number;
}

interface ReportSummaryStatCardsProps {
  stats: ReportSummaryStats;
  isLoading?: boolean;
}

export function ReportSummaryStatCards({ stats, isLoading }: ReportSummaryStatCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-md border border-border bg-surface p-4">
            <div className="h-4 w-24 rounded bg-muted"></div>
            <div className="mt-2 h-8 w-16 rounded bg-muted"></div>
          </div>
        ))}
      </div>
    );
  }

  const healthColors = {
    healthy: { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/20" },
    degraded: { bg: "bg-yellow-500/10", text: "text-yellow-500", border: "border-yellow-500/20" },
    critical: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20" },
  };

  const healthColor = healthColors[stats.clusterHealth];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* Total Sent */}
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-sm text-muted-foreground">Total Sent</p>
        <p className="mt-1 text-2xl font-bold text-foreground">
          {stats.totalSent.toLocaleString()}
        </p>
      </div>

      {/* Bounce Rate */}
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-sm text-muted-foreground">Bounce Rate</p>
        <p
          className={cn(
            "mt-1 text-2xl font-bold",
            stats.bounceRate > 5 ? "text-red-500" : "text-green-500",
          )}
        >
          {stats.bounceRate.toFixed(2)}%
        </p>
      </div>

      {/* Delivered % */}
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-sm text-muted-foreground">Delivered</p>
        <p
          className={cn(
            "mt-1 text-2xl font-bold",
            stats.deliveredPercent >= 95 ? "text-green-500" : "text-yellow-500",
          )}
        >
          {stats.deliveredPercent.toFixed(1)}%
        </p>
      </div>

      {/* Cluster Health */}
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-sm text-muted-foreground">Cluster Health</p>
        <span
          className={cn(
            "mt-1 inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-medium capitalize",
            healthColor.bg,
            healthColor.text,
            healthColor.border,
          )}
        >
          {stats.clusterHealth}
        </span>
      </div>

      {/* Active Alerts */}
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-sm text-muted-foreground">Active Alerts</p>
        <p
          className={cn(
            "mt-1 text-2xl font-bold",
            stats.activeAlerts === 0 ? "text-green-500" : "text-red-500",
          )}
        >
          {stats.activeAlerts}
        </p>
      </div>
    </div>
  );
}
