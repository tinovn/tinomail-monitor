import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { MtaNodeStats } from "@tinomail/shared";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { MtaNodeCardGrid } from "@/components/zonemta/mta-node-card-grid";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";
import { EmptyStatePlaceholder } from "@/components/shared/empty-state-placeholder";

export const Route = createFileRoute("/_authenticated/servers/zonemta/")({
  component: ZonemtaClusterOverviewPage,
});

function ZonemtaClusterOverviewPage() {
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data: nodes, isLoading } = useQuery({
    queryKey: ["zonemta", "nodes"],
    queryFn: () => apiClient.get<MtaNodeStats[]>("/zonemta/nodes"),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  return (
    <div className="space-y-3">
      {isLoading ? (
        <LoadingSkeletonPlaceholder className="h-96" />
      ) : !nodes || nodes.length === 0 ? (
        <EmptyStatePlaceholder message="No ZoneMTA nodes found" />
      ) : (
        <MtaNodeCardGrid nodes={nodes} />
      )}
    </div>
  );
}
