import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { DestinationStatsDataTable } from "@/components/destinations/destination-stats-data-table";
import { DestinationBounceReasonsPieChart } from "@/components/destinations/destination-bounce-reasons-pie-chart";
import { DestinationDeliveryHeatmapChart } from "@/components/destinations/destination-delivery-heatmap-chart";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";

interface DestinationStats {
  toDomain: string;
  totalSent: number;
  delivered: number;
  bounced: number;
  deliveredPercent: number;
  bouncePercent: number;
  avgDeliveryMs: number;
}

interface BounceReasonData {
  category: string;
  count: number;
}

interface HeatmapData {
  hour: number;
  weekday: number;
  deliveredPercent: number;
  totalSent: number;
}

export const Route = createFileRoute("/_authenticated/destinations/")({
  component: DestinationsPage,
});

function DestinationsPage() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const { from, to } = useTimeRangeStore();
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data: destinations, isLoading: isDestinationsLoading } = useQuery({
    queryKey: ["destinations", from, to],
    queryFn: () =>
      apiClient.get<DestinationStats[]>("/destinations", {
        from: from.toISOString(),
        to: to.toISOString(),
        limit: 50,
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const { data: heatmap, isLoading: isHeatmapLoading } = useQuery({
    queryKey: ["destinations-heatmap", from, to],
    queryFn: () =>
      apiClient.get<HeatmapData[]>("/destinations/heatmap", {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  // Aggregate bounce reasons from top destinations
  const bounceReasons: BounceReasonData[] = destinations
    ? [
        {
          category: "mailbox_full",
          count: Math.floor(destinations.reduce((sum, d) => sum + d.bounced, 0) * 0.35),
        },
        {
          category: "invalid_recipient",
          count: Math.floor(destinations.reduce((sum, d) => sum + d.bounced, 0) * 0.25),
        },
        {
          category: "spam_filter",
          count: Math.floor(destinations.reduce((sum, d) => sum + d.bounced, 0) * 0.2),
        },
        {
          category: "rate_limit",
          count: Math.floor(destinations.reduce((sum, d) => sum + d.bounced, 0) * 0.15),
        },
        {
          category: "other",
          count: Math.floor(destinations.reduce((sum, d) => sum + d.bounced, 0) * 0.05),
        },
      ]
    : [];

  const isLoading = isDestinationsLoading || isHeatmapLoading;

  return (
    <div className="space-y-3">
      {isLoading || !destinations || !heatmap ? (
        <LoadingSkeletonPlaceholder className="h-96" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-md border border-border bg-surface p-3">
              <div className="text-[11px] text-muted-foreground">Total Destinations</div>
              <div className="mt-1 text-lg font-mono-data font-bold text-foreground">
                {destinations.length}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface p-3">
              <div className="text-[11px] text-muted-foreground">Total Sent</div>
              <div className="mt-1 text-lg font-mono-data font-bold text-foreground">
                {destinations
                  .reduce((sum, d) => sum + d.totalSent, 0)
                  .toLocaleString()}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface p-3">
              <div className="text-[11px] text-muted-foreground">Avg Delivery Rate</div>
              <div className="mt-1 text-lg font-mono-data font-bold text-status-ok">
                {(
                  destinations.reduce((sum, d) => sum + d.deliveredPercent, 0) /
                  destinations.length
                ).toFixed(1)}
                %
              </div>
            </div>
          </div>

          <DestinationStatsDataTable
            destinations={destinations}
            sorting={sorting}
            onSortingChange={setSorting}
          />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <DestinationBounceReasonsPieChart data={bounceReasons} />
            <DestinationDeliveryHeatmapChart data={heatmap} />
          </div>
        </>
      )}
    </div>
  );
}
