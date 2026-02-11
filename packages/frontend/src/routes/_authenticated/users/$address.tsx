import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { MailUserRiskLevelBadge } from "@/components/users/mail-user-risk-level-badge";
import { MailUserActivityTrendChart } from "@/components/users/mail-user-activity-trend-chart";
import { MailUserAbuseFlagsPanel, type AbuseFlagItem } from "@/components/users/mail-user-abuse-flags-panel";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";

interface UserDetail {
  address: string;
  sent24h: number;
  received24h: number;
  bounceRate: number;
  spamReports: number;
  riskLevel: "Low" | "Medium" | "High";
  topDestinations: Array<{ domain: string; count: number }>;
}

interface ActivityDataPoint {
  timestamp: string;
  sent: number;
  received: number;
}

export const Route = createFileRoute("/_authenticated/users/$address")({
  component: UserDetailPage,
});

function UserDetailPage() {
  const params = Route.useParams() as { address: string };
  const address = decodeURIComponent(params.address);
  const { from, to } = useTimeRangeStore();
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data: userDetail, isLoading: isUserLoading } = useQuery({
    queryKey: ["user-detail", address],
    queryFn: () => apiClient.get<UserDetail>(`/mail-users/${encodeURIComponent(address)}`),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const { data: activity, isLoading: isActivityLoading } = useQuery({
    queryKey: ["user-activity", address, from, to],
    queryFn: () =>
      apiClient.get<ActivityDataPoint[]>(
        `/mail-users/${encodeURIComponent(address)}/activity`,
        {
          from: from.toISOString(),
          to: to.toISOString(),
        }
      ),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const { data: abuseFlags, isLoading: isAbuseFlagsLoading } = useQuery({
    queryKey: ["user-abuse-flags"],
    queryFn: () => apiClient.get<AbuseFlagItem[]>("/mail-users/abuse-flags"),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const isLoading = isUserLoading || isActivityLoading || isAbuseFlagsLoading;

  const userAbuseFlags = abuseFlags?.filter((flag) => flag.userAddress === address) || [];

  const topDestinations = userDetail?.topDestinations ?? [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">User: {address}</h1>
          {userDetail && <MailUserRiskLevelBadge level={userDetail.riskLevel} />}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Detailed activity and behavior analysis
        </p>
      </div>

      {isLoading || !userDetail || !activity ? (
        <LoadingSkeletonPlaceholder className="h-96" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Sent (24h)</div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {(userDetail.sent24h ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Received (24h)</div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {(userDetail.received24h ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Bounce Rate</div>
              <div className="mt-2 text-2xl font-bold text-status-warning">
                {(userDetail.bounceRate ?? 0).toFixed(1)}%
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Spam Reports</div>
              <div className="mt-2 text-2xl font-bold text-status-critical">
                {userDetail.spamReports}
              </div>
            </div>
          </div>

          <MailUserActivityTrendChart data={activity} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-4">
              <h3 className="mb-4 text-sm font-semibold text-foreground">
                Top Destinations
              </h3>
              <div className="space-y-2">
                {topDestinations.map((dest) => (
                  <div
                    key={dest.domain}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                  >
                    <div>
                      <div className="font-mono text-sm font-medium text-foreground">
                        {dest.domain}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(dest.count ?? 0).toLocaleString()} emails
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <MailUserAbuseFlagsPanel flags={userAbuseFlags} />
          </div>
        </>
      )}
    </div>
  );
}
