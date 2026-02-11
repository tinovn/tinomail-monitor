import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { IpCheckResultsTable } from "@/components/ip-reputation/ip-check-results-table";
import { IpCheckHistoryChart } from "@/components/ip-reputation/ip-check-history-chart";
import { IpBlacklistTimelineChart } from "@/components/ip-reputation/ip-blacklist-timeline-chart";

export const Route = createFileRoute("/_authenticated/ip-reputation/$ip")({
  component: IpDetailPage,
});

interface IpCheckHistory {
  time: string;
  blacklist: string;
  tier: string;
  listed: boolean;
  response: string | null;
}

function IpDetailPage() {
  const { ip } = Route.useParams() as { ip: string };

  const { data: checkHistory, isLoading } = useQuery({
    queryKey: ["ip-reputation", ip, "checks"],
    queryFn: () => apiClient.get<IpCheckHistory[]>(`/ip-reputation/${ip}/checks`, { hours: "24" }),
    refetchInterval: 60000,
  });

  // Get latest check results (one per blacklist)
  const latestResults = checkHistory
    ? Object.values(
        checkHistory.reduce(
          (acc, check) => {
            if (!acc[check.blacklist] || new Date(check.time) > new Date(acc[check.blacklist].time)) {
              acc[check.blacklist] = check;
            }
            return acc;
          },
          {} as Record<string, IpCheckHistory>,
        ),
      )
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          IP Reputation: <span className="font-mono">{ip}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Detailed blacklist check results and history
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Latest Check Results</h2>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <IpCheckResultsTable data={latestResults} />
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Check History (24h)</h2>
        <IpCheckHistoryChart ip={ip} hours={24} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Listing/Delisting Timeline (7 days)</h2>
        <IpBlacklistTimelineChart ip={ip} days={7} />
      </div>
    </div>
  );
}
