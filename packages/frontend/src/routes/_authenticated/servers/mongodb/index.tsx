import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";
import { EmptyStatePlaceholder } from "@/components/shared/empty-state-placeholder";
import { ReplicaSetStatusPanel } from "@/components/mongodb/replica-set-status-panel";
import { ReplicationLagTimeseriesChart } from "@/components/mongodb/replication-lag-timeseries-chart";
import { OpsPerSecStackedAreaChart } from "@/components/mongodb/ops-per-sec-stacked-area-chart";
import { ConnectionsPerNodeBarChart } from "@/components/mongodb/connections-per-node-bar-chart";
import { WiredtigerCacheGaugeChart } from "@/components/mongodb/wiredtiger-cache-gauge-chart";
import { DatabaseSizeComparisonBarChart } from "@/components/mongodb/database-size-comparison-bar-chart";
import { OplogWindowStatusDisplay } from "@/components/mongodb/oplog-window-status-display";

export const Route = createFileRoute("/_authenticated/servers/mongodb/")({
  component: MongodbClusterOverviewPage,
});

interface MongodbNodeStatus {
  nodeId: string;
  time: string;
  role: string | null;
  connectionsCurrent: number | null;
  connectionsAvailable: number | null;
  opsInsert: number | null;
  opsQuery: number | null;
  opsUpdate: number | null;
  opsDelete: number | null;
  opsCommand: number | null;
  replLagSeconds: number | null;
  dataSizeBytes: number | null;
  indexSizeBytes: number | null;
  storageSizeBytes: number | null;
  oplogWindowHours: number | null;
  wtCacheUsedBytes: number | null;
  wtCacheMaxBytes: number | null;
}

function MongodbClusterOverviewPage() {
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data: nodes, isLoading } = useQuery({
    queryKey: ["mongodb", "cluster-status"],
    queryFn: () =>
      apiClient.get<MongodbNodeStatus[]>("/mongodb/cluster-status"),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  if (isLoading) {
    return <LoadingSkeletonPlaceholder className="h-96" />;
  }

  if (!nodes || nodes.length === 0) {
    return <EmptyStatePlaceholder message="No MongoDB nodes found" />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">MongoDB Cluster</h1>

      <ReplicaSetStatusPanel nodes={nodes} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Replication Lag
          </h2>
          <ReplicationLagTimeseriesChart />
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Operations per Second
          </h2>
          <OpsPerSecStackedAreaChart />
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Current Connections
          </h2>
          <ConnectionsPerNodeBarChart nodes={nodes} />
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            WiredTiger Cache Usage
          </h2>
          <WiredtigerCacheGaugeChart nodes={nodes} />
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Database Storage Size
          </h2>
          <DatabaseSizeComparisonBarChart nodes={nodes} />
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Oplog Window
          </h2>
          <OplogWindowStatusDisplay nodes={nodes} />
        </div>
      </div>
    </div>
  );
}
