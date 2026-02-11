import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";
import { AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BruteForceAlert {
  sourceIp: string;
  failCount: number;
  firstSeen: string;
  lastSeen: string;
}

export function BruteForceActiveAlertsPanel() {
  const { from, to, autoRefresh } = useTimeRangeStore();

  const { data, isLoading } = useQuery({
    queryKey: ["security", "auth", "brute-force", from, to],
    queryFn: () =>
      apiClient.get<BruteForceAlert[]>("/security/auth/brute-force", {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  if (isLoading) {
    return <LoadingSkeletonPlaceholder className="h-48" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
            <AlertTriangle className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">No Active Threats</h3>
            <p className="text-xs text-muted-foreground">
              No brute force attacks detected in the selected time range
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Active Brute Force Alerts
          </h3>
          <p className="text-xs text-muted-foreground">
            {data.length} potential brute force attack{data.length !== 1 ? "s" : ""} detected
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {data.map((alert) => (
          <div
            key={alert.sourceIp}
            className="rounded-md border border-red-500/30 bg-red-500/10 p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-mono text-sm font-semibold text-foreground">
                  {alert.sourceIp}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-red-400">{alert.failCount} failed attempts</span>
                  {" • "}
                  First: {formatDistanceToNow(new Date(alert.firstSeen), { addSuffix: true })}
                  {" • "}
                  Last: {formatDistanceToNow(new Date(alert.lastSeen), { addSuffix: true })}
                </div>
              </div>
              <button className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/30">
                Block
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
