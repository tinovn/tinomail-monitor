import { useState, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { ServerListDataTable } from "@/components/servers/server-list-data-table";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { NodeActionConfirmDialog } from "@/components/servers/node-action-confirm-dialog";

interface NodeWithMetrics {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  role: string;
  status: string;
  registeredAt: string;
  lastSeen: string | null;
  metadata: Record<string, unknown> | null;
  agentVersion: string | null;
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

type PendingAction =
  | { type: "delete"; nodeId: string }
  | { type: "block"; nodeId: string; blocked: boolean };

function ServerListPage() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchValue, setSearchValue] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [activeStatusFilter, setActiveStatusFilter] = useState("all");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);
  const queryClient = useQueryClient();

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
      const matchesSearch =
        !searchValue ||
        node.hostname?.toLowerCase().includes(searchValue.toLowerCase()) ||
        node.ipAddress?.toLowerCase().includes(searchValue.toLowerCase()) ||
        node.id.toLowerCase().includes(searchValue.toLowerCase());
      const matchesRole = activeTab === "all" || node.role === activeTab;
      const matchesStatus =
        activeStatusFilter === "all" || node.status === activeStatusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [nodes, searchValue, activeTab, activeStatusFilter]);

  const refetchNodes = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["nodes"] });
  }, [queryClient]);

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.type === "delete") {
      await apiClient.del(`/admin/nodes/${pendingAction.nodeId}`);
    } else {
      await apiClient.put(`/admin/nodes/${pendingAction.nodeId}/block`, {
        blocked: pendingAction.blocked,
      });
    }
    setPendingAction(null);
    refetchNodes();
  };

  const dialogProps = pendingAction
    ? pendingAction.type === "delete"
      ? {
          title: "Delete Node",
          description: `Delete node "${pendingAction.nodeId}"? The agent can re-register on next heartbeat.`,
          confirmLabel: "Delete",
          variant: "danger" as const,
        }
      : {
          title: pendingAction.blocked ? "Block Node" : "Unblock Node",
          description: pendingAction.blocked
            ? `Block node "${pendingAction.nodeId}"? The agent will be rejected on next registration.`
            : `Unblock node "${pendingAction.nodeId}"? The agent will be able to register again.`,
          confirmLabel: pendingAction.blocked ? "Block" : "Unblock",
          variant: pendingAction.blocked ? ("warning" as const) : ("warning" as const),
        }
    : null;

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
          onDelete={(nodeId) => setPendingAction({ type: "delete", nodeId })}
          onToggleBlock={(nodeId, blocked) =>
            setPendingAction({ type: "block", nodeId, blocked })
          }
        />
      )}

      {dialogProps && (
        <NodeActionConfirmDialog
          open={!!pendingAction}
          {...dialogProps}
          onConfirm={handleConfirmAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
