import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { AuthSuccessFailTrendChart } from "@/components/spam-security/auth-success-fail-trend-chart";
import { AuthFailedByIpDataTable } from "@/components/spam-security/auth-failed-by-ip-data-table";
import { BruteForceActiveAlertsPanel } from "@/components/spam-security/brute-force-active-alerts-panel";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";

export const Route = createFileRoute("/_authenticated/spam-security/authentication")({
  component: AuthenticationMonitoringPage,
});

interface AuthSummary {
  successCount: number;
  failCount: number;
  uniqueIps: number;
}

function AuthenticationMonitoringPage() {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data: summary, isLoading } = useQuery({
    queryKey: ["security", "auth", "summary", from, to],
    queryFn: () =>
      apiClient.get<AuthSummary>("/security/auth/summary", {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const successRate = summary
    ? ((summary.successCount / (summary.successCount + summary.failCount)) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-3">
      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <LoadingSkeletonPlaceholder key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-green-500/10 p-2">
            <div className="text-[11px] font-medium text-muted-foreground">Successful Logins</div>
            <div className="mt-1 text-lg font-mono-data font-bold text-green-500">
              {summary?.successCount.toLocaleString() || 0}
            </div>
            <div className="text-[10px] text-muted-foreground">{successRate}% success rate</div>
          </div>

          <div className="rounded-md border border-border bg-red-500/10 p-2">
            <div className="text-[11px] font-medium text-muted-foreground">Failed Attempts</div>
            <div className="mt-1 text-lg font-mono-data font-bold text-red-500">
              {summary?.failCount.toLocaleString() || 0}
            </div>
            <div className="text-[10px] text-muted-foreground">Potential threats</div>
          </div>

          <div className="rounded-md border border-border bg-blue-500/10 p-2">
            <div className="text-[11px] font-medium text-muted-foreground">Unique Source IPs</div>
            <div className="mt-1 text-lg font-mono-data font-bold text-blue-500">
              {summary?.uniqueIps.toLocaleString() || 0}
            </div>
            <div className="text-[10px] text-muted-foreground">Active connections</div>
          </div>
        </div>
      )}

      {/* Trend Chart */}
      <div className="rounded-md border border-border bg-surface p-3">
        <AuthSuccessFailTrendChart />
      </div>

      {/* Brute Force Alerts */}
      <BruteForceActiveAlertsPanel />

      {/* Failed IPs Table */}
      <div className="rounded-md border border-border bg-surface p-3">
        <AuthFailedByIpDataTable />
      </div>
    </div>
  );
}
