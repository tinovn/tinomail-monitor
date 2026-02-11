import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import type { SendingDomain } from "@tinomail/shared";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { DomainHealthScoreGaugeChart } from "@/components/domains/domain-health-score-gauge-chart";
import { DomainAuthHealthPanel } from "@/components/domains/domain-auth-health-panel";
import { DomainDeliveryQualityPanel } from "@/components/domains/domain-delivery-quality-panel";
import { DomainVolumeTrendLineChart } from "@/components/domains/domain-volume-trend-line-chart";
import { DomainTopSendersDataTable } from "@/components/domains/domain-top-senders-data-table";
import { DomainSendingPatternHeatmapChart } from "@/components/domains/domain-sending-pattern-heatmap-chart";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";

interface DomainWithHealthScore extends SendingDomain {
  healthScore: number;
  sent24h: number;
  deliveredPercent: number;
  bouncePercent: number;
}

interface DomainStats {
  timestamp: string;
  delivered: number;
  bounced: number;
  total: number;
  avgDeliveryMs: number;
  p50DeliveryMs: number;
  p95DeliveryMs: number;
  p99DeliveryMs: number;
  dkimPass: number;
  spfPass: number;
  dmarcPass: number;
}

interface TopSender {
  sender: string;
  totalSent: number;
  delivered: number;
  bounced: number;
  complained: number;
  bounceRate: number;
}

interface HeatmapDataPoint {
  hour: number;
  weekday: number;
  value: number;
}

export const Route = createFileRoute("/_authenticated/domains/$domain")({
  component: DomainDetailPage,
});

function DomainDetailPage() {
  const params = Route.useParams() as { domain: string };
  const domain = params.domain;
  const [sorting, setSorting] = useState<SortingState>([]);
  const { from, to } = useTimeRangeStore();
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data: domainDetail, isLoading: isDomainLoading } = useQuery({
    queryKey: ["domain", domain],
    queryFn: () => apiClient.get<DomainWithHealthScore>(`/domains/${domain}`),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["domain-stats", domain, from, to],
    queryFn: () =>
      apiClient.get<DomainStats[]>(`/domains/${domain}/stats`, {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const { data: topSenders, isLoading: isSendersLoading } = useQuery({
    queryKey: ["domain-senders", domain, from, to],
    queryFn: () =>
      apiClient.get<TopSender[]>(`/domains/${domain}/senders`, {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const { data: heatmapData, isLoading: isHeatmapLoading } = useQuery({
    queryKey: ["domain-heatmap", domain, from, to],
    queryFn: () =>
      apiClient.get<HeatmapDataPoint[]>(`/domains/${domain}/sending-pattern`, {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const isLoading = isDomainLoading || isStatsLoading || isSendersLoading || isHeatmapLoading;

  // Aggregate stats for delivery quality panel
  const aggregatedStats = stats
    ? stats.reduce(
        (acc, curr) => ({
          totalSent: acc.totalSent + curr.total,
          delivered: acc.delivered + curr.delivered,
          bounced: acc.bounced + curr.bounced,
          avgDeliveryMs: acc.avgDeliveryMs + curr.avgDeliveryMs,
          p50DeliveryMs: Math.max(acc.p50DeliveryMs, curr.p50DeliveryMs),
          p95DeliveryMs: Math.max(acc.p95DeliveryMs, curr.p95DeliveryMs),
          p99DeliveryMs: Math.max(acc.p99DeliveryMs, curr.p99DeliveryMs),
        }),
        {
          totalSent: 0,
          delivered: 0,
          bounced: 0,
          avgDeliveryMs: 0,
          p50DeliveryMs: 0,
          p95DeliveryMs: 0,
          p99DeliveryMs: 0,
        }
      )
    : null;

  if (aggregatedStats && stats && stats.length > 0) {
    aggregatedStats.avgDeliveryMs /= stats.length;
  }

  return (
    <div className="space-y-3">
      {isLoading || !domainDetail || !stats || !aggregatedStats || !topSenders || !heatmapData ? (
        <LoadingSkeletonPlaceholder className="h-96" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div>
              <DomainHealthScoreGaugeChart
                score={domainDetail.healthScore}
                title="Health Score"
              />
            </div>
            <div className="lg:col-span-2">
              <DomainDeliveryQualityPanel data={aggregatedStats} />
            </div>
          </div>

          <DomainAuthHealthPanel
            data={stats.map((s) => ({
              timestamp: s.timestamp,
              dkimPass: s.dkimPass,
              spfPass: s.spfPass,
              dmarcPass: s.dmarcPass,
              total: s.total,
            }))}
          />

          <DomainVolumeTrendLineChart
            data={stats.map((s) => ({
              timestamp: s.timestamp,
              delivered: s.delivered,
              bounced: s.bounced,
              total: s.total,
            }))}
          />

          <DomainTopSendersDataTable
            senders={topSenders}
            sorting={sorting}
            onSortingChange={setSorting}
          />

          <DomainSendingPatternHeatmapChart data={heatmapData} />
        </>
      )}
    </div>
  );
}
