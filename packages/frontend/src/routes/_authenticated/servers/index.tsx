import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { ServerListDataTable } from "@/components/servers/server-list-data-table";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";
import { FilterToolbar } from "@/components/shared/filter-toolbar";

interface NodeWithMetrics {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  role: string;
  status: string;
  registeredAt: string;
  lastSeen: string | null;
  metadata: Record<string, unknown> | null;
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
  ramUsedBytes: number | null;
  diskFreeBytes: number | null;
  load1m: number | null;
}

export const Route = createFileRoute("/_authenticated/servers/")({
  component: ServerListPage,
});

function ServerListPage() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchValue, setSearchValue] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [activeStatusFilter, setActiveStatusFilter] = useState("all");
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data: nodes, isLoading } = useQuery({
    queryKey: ["nodes", "with-metrics"],
    queryFn: () => apiClient.get<NodeWithMetrics[]>("/nodes/with-latest-metrics"),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const tabs = useMemo(() => {
    if (!nodes) return [];
    const roleCounts: Record<string, number> = {};
    nodes.forEach((node) => {
      roleCounts[node.role] = (roleCounts[node.role] || 0) + 1;
    });
    return [
      { id: "all", label: "All", count: nodes.length },
      { id: "mongodb", label: "MongoDB", count: roleCounts["mongodb"] || 0 },
      { id: "wildduck", label: "WildDuck", count: roleCounts["wildduck"] || 0 },
      { id: "haraka", label: "Haraka", count: roleCounts["haraka"] || 0 },
      { id: "zonemta", label: "ZoneMTA", count: roleCounts["zonemta"] || 0 },
    ];
  }, [nodes]);

  const statusFilters = [
    { id: "all", label: "All", status: "muted" as const },
    { id: "active", label: "Active", status: "ok" as const },
    { id: "warning", label: "Warning", status: "warning" as const },
    { id: "critical", label: "Critical", status: "critical" as const },
  ];

  const filteredNodes = useMemo(() => {
    if (!nodes) return [];
    return nodes.filter((node) => {
      // Search filter
      const matchesSearch =
        !searchValue ||
        node.hostname?.toLowerCase().includes(searchValue.toLowerCase()) ||
        node.ipAddress?.toLowerCase().includes(searchValue.toLowerCase()) ||
        node.id.toLowerCase().includes(searchValue.toLowerCase());

      // Role filter
      const matchesRole = activeTab === "all" || node.role === activeTab;

      // Status filter
      const matchesStatus =
        activeStatusFilter === "all" || node.status === activeStatusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [nodes, searchValue, activeTab, activeStatusFilter]);

  return (
    <div className="space-y-3">
      <FilterToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search nodes..."
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        statusFilters={statusFilters}
        activeStatusFilter={activeStatusFilter}
        onStatusFilterChange={setActiveStatusFilter}
      />

      {isLoading || !nodes ? (
        <LoadingSkeletonPlaceholder className="h-96" />
      ) : (
        <ServerListDataTable
          nodes={filteredNodes}
          sorting={sorting}
          onSortingChange={setSorting}
        />
      )}
    </div>
  );
}
