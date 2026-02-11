import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { DestinationBounceReasonsPieChart } from "@/components/destinations/destination-bounce-reasons-pie-chart";
import { DestinationDeliveryHeatmapChart } from "@/components/destinations/destination-delivery-heatmap-chart";
import { DestinationSmtpResponseCodeBarChart } from "@/components/destinations/destination-smtp-response-code-bar-chart";
import { DestinationPerIpBreakdownDataTable, type IpBreakdownData } from "@/components/destinations/destination-per-ip-breakdown-data-table";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";

interface DestinationDetail {
  domain: string;
  totalSent: number;
  delivered: number;
  bounced: number;
  deliveredPercent: number;
  bouncePercent: number;
}

interface BounceReasonData {
  category: string;
  count: number;
}

interface SmtpResponseCodeData {
  code: string;
  count: number;
}

interface HeatmapData {
  hour: number;
  weekday: number;
  deliveredPercent: number;
  totalSent: number;
}

interface DestinationDetailResponse {
  detail: DestinationDetail;
  ipBreakdown: IpBreakdownData[];
  bounceReasons: BounceReasonData[];
  smtpResponseCodes: SmtpResponseCodeData[];
}

export const Route = createFileRoute("/_authenticated/destinations/$domain")({
  component: DestinationDetailPage,
});

function DestinationDetailPage() {
  const params = Route.useParams() as { domain: string };
  const domain = params.domain;
  const [sorting, setSorting] = useState<SortingState>([]);
  const { from, to } = useTimeRangeStore();
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data: destinationData, isLoading: isDataLoading } = useQuery({
    queryKey: ["destination-detail", domain, from, to],
    queryFn: () =>
      apiClient.get<DestinationDetailResponse>(`/destinations/${domain}`, {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const { data: heatmap, isLoading: isHeatmapLoading } = useQuery({
    queryKey: ["destination-heatmap", domain, from, to],
    queryFn: () =>
      apiClient.get<HeatmapData[]>(`/destinations/${domain}/heatmap`, {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const isLoading = isDataLoading || isHeatmapLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Destination: {domain}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Detailed delivery performance and analysis
        </p>
      </div>

      {isLoading || !destinationData || !heatmap ? (
        <LoadingSkeletonPlaceholder className="h-96" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Total Sent</div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {(destinationData.detail.totalSent ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Delivered</div>
              <div className="mt-2 text-2xl font-bold text-status-ok">
                {(destinationData.detail.delivered ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Delivery Rate</div>
              <div className="mt-2 text-2xl font-bold text-status-ok">
                {(destinationData.detail.deliveredPercent ?? 0).toFixed(1)}%
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-sm text-muted-foreground">Bounce Rate</div>
              <div className="mt-2 text-2xl font-bold text-status-warning">
                {(destinationData.detail.bouncePercent ?? 0).toFixed(1)}%
              </div>
            </div>
          </div>

          <DestinationDeliveryHeatmapChart data={heatmap} />

          <DestinationPerIpBreakdownDataTable
            ipData={destinationData.ipBreakdown}
            sorting={sorting}
            onSortingChange={setSorting}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DestinationBounceReasonsPieChart data={destinationData.bounceReasons} />
            <DestinationSmtpResponseCodeBarChart data={destinationData.smtpResponseCodes} />
          </div>
        </>
      )}
    </div>
  );
}
