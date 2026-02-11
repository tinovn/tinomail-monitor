import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { MetricStatCard } from "@/components/shared/metric-stat-card";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";

interface IpReputationSummary {
  totalIps: number;
  cleanIps: number;
  warningIps: number;
  criticalIps: number;
  inactiveIps: number;
  lastCheckTime: string | null;
}

export function IpReputationSummaryBar() {
  const { data, isLoading } = useQuery({
    queryKey: ["ip-reputation", "summary"],
    queryFn: () => apiClient.get<IpReputationSummary>("/ip-reputation/summary"),
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <LoadingSkeletonPlaceholder key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const cleanPercentage = data.totalIps > 0
    ? ((data.cleanIps / data.totalIps) * 100).toFixed(1)
    : "0";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
      <MetricStatCard
        label="Total IPs"
        value={data.totalIps.toString()}
      />
      <MetricStatCard
        label="Clean IPs"
        value={data.cleanIps.toString()}
        trendValue={`${cleanPercentage}%`}
        className="border-status-ok"
      />
      <MetricStatCard
        label="Warning"
        value={data.warningIps.toString()}
        className={data.warningIps > 0 ? "border-status-warning" : ""}
      />
      <MetricStatCard
        label="Critical"
        value={data.criticalIps.toString()}
        className={data.criticalIps > 0 ? "border-status-critical" : ""}
      />
      <MetricStatCard
        label="Inactive"
        value={data.inactiveIps.toString()}
        className="border-border"
      />
    </div>
  );
}
