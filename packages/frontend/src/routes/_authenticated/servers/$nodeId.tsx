import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Node } from "@tinomail/shared";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";
import { ServerDetailHeaderInfo } from "@/components/servers/server-detail-header-info";
import { RunningServicesPanel } from "@/components/servers/running-services-panel";

interface NodeWithMetrics extends Node {
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
  ramUsedBytes: number | null;
  diskFreeBytes: number | null;
}
import { CpuUsageRealtimeLineChart } from "@/components/servers/cpu-usage-realtime-line-chart";
import { RamUsageStackedAreaChart } from "@/components/servers/ram-usage-stacked-area-chart";
import { DiskUsagePartitionBarChart } from "@/components/servers/disk-usage-partition-bar-chart";
import { NetworkBandwidthDualAxisChart } from "@/components/servers/network-bandwidth-dual-axis-chart";

export const Route = createFileRoute("/_authenticated/servers/$nodeId")({
  component: ServerDetailPage,
});

function ServerDetailPage() {
  const { nodeId } = Route.useParams() as { nodeId: string };
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data: node, isLoading } = useQuery({
    queryKey: ["node", nodeId],
    queryFn: () => apiClient.get<Node>(`/nodes/${nodeId}`),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  // Fetch latest metrics for header summary (reuses the list endpoint, filters client-side)
  const { data: nodesWithMetrics } = useQuery({
    queryKey: ["nodes", "with-metrics"],
    queryFn: () => apiClient.get<NodeWithMetrics[]>("/nodes/with-latest-metrics"),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });
  const metrics = nodesWithMetrics?.find((n) => n.id === nodeId) ?? null;

  if (isLoading || !node) {
    return (
      <div className="space-y-6">
        <LoadingSkeletonPlaceholder className="h-32" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LoadingSkeletonPlaceholder className="h-80" />
          <LoadingSkeletonPlaceholder className="h-80" />
          <LoadingSkeletonPlaceholder className="h-80" />
          <LoadingSkeletonPlaceholder className="h-80" />
        </div>
      </div>
    );
  }

  const processes = (node.metadata?.processes ?? []) as Array<{
    name: string; running: boolean; pid: number | null; cpuPercent: number; memoryMB: number;
  }>;
  const detectedServices = (node.metadata?.detectedServices ?? []) as string[];

  return (
    <div className="space-y-6">
      <ServerDetailHeaderInfo node={node} metrics={metrics} />

      {(processes.length > 0 || detectedServices.length > 0) && (
        <RunningServicesPanel processes={processes} detectedServices={detectedServices} />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-lg font-semibold text-foreground">CPU Usage</h2>
          <CpuUsageRealtimeLineChart nodeId={nodeId} />
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-lg font-semibold text-foreground">RAM Usage</h2>
          <RamUsageStackedAreaChart nodeId={nodeId} />
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Disk Usage</h2>
          <DiskUsagePartitionBarChart nodeId={nodeId} />
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Network Bandwidth</h2>
          <NetworkBandwidthDualAxisChart nodeId={nodeId} />
        </div>
      </div>
    </div>
  );
}
