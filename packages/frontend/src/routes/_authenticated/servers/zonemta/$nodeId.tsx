import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { MtaNodePerformance, EnrichedSendingIp, DestinationQuality } from "@tinomail/shared";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { NodePerformanceChartsTab } from "@/components/zonemta/node-performance-charts-tab";
import { NodeIpAddressTableTab } from "@/components/zonemta/node-ip-address-table-tab";
import { NodeDestinationQualityTab } from "@/components/zonemta/node-destination-quality-tab";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";
import { cn } from "@/lib/classname-utils";

export const Route = createFileRoute("/_authenticated/servers/zonemta/$nodeId")({
  component: MtaNodeDetailPage,
});

type TabType = "performance" | "ips" | "destinations";

function MtaNodeDetailPage() {
  const { nodeId } = Route.useParams() as { nodeId: string };
  const [activeTab, setActiveTab] = useState<TabType>("performance");
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data: performance, isLoading: perfLoading } = useQuery({
    queryKey: ["zonemta", "node", nodeId, "performance"],
    queryFn: () => apiClient.get<MtaNodePerformance>(`/zonemta/nodes/${nodeId}/performance`),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const { data: ips, isLoading: ipsLoading } = useQuery({
    queryKey: ["zonemta", "node", nodeId, "ips"],
    queryFn: () => apiClient.get<EnrichedSendingIp[]>(`/zonemta/nodes/${nodeId}/ips`),
    enabled: activeTab === "ips",
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const { data: destinations, isLoading: destLoading } = useQuery({
    queryKey: ["zonemta", "node", nodeId, "destinations"],
    queryFn: () => apiClient.get<DestinationQuality[]>(`/zonemta/nodes/${nodeId}/destinations`),
    enabled: activeTab === "destinations",
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const tabs = [
    { id: "performance" as const, label: "Performance", count: undefined },
    { id: "ips" as const, label: "IP Addresses", count: ips?.length },
    { id: "destinations" as const, label: "Destinations", count: destinations?.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">MTA Node: {nodeId}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Detailed performance metrics and IP management
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 text-xs opacity-60">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "performance" && (
          perfLoading || !performance ? (
            <LoadingSkeletonPlaceholder className="h-96" />
          ) : (
            <NodePerformanceChartsTab performance={performance} />
          )
        )}

        {activeTab === "ips" && (
          ipsLoading || !ips ? (
            <LoadingSkeletonPlaceholder className="h-96" />
          ) : (
            <NodeIpAddressTableTab nodeId={nodeId} ips={ips} />
          )
        )}

        {activeTab === "destinations" && (
          destLoading || !destinations ? (
            <LoadingSkeletonPlaceholder className="h-96" />
          ) : (
            <NodeDestinationQualityTab destinations={destinations} />
          )
        )}
      </div>
    </div>
  );
}
