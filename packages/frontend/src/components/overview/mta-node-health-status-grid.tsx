import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Node } from "@tinomail/shared";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { StatusIndicatorDot } from "@/components/shared/status-indicator-dot";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";
import { cn } from "@/lib/classname-utils";

export function MtaNodeHealthStatusGrid() {
  const navigate = useNavigate();
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data: nodes, isLoading } = useQuery({
    queryKey: ["nodes"],
    queryFn: () => apiClient.get<Node[]>("/nodes"),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  if (isLoading || !nodes) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <LoadingSkeletonPlaceholder key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const getStatusType = (status: string): "ok" | "warning" | "critical" | "muted" => {
    if (status === "active") return "ok";
    if (status === "warning") return "warning";
    if (status === "critical") return "critical";
    return "muted";
  };

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {nodes.map((node) => (
        <button
          key={node.id}
          onClick={() => navigate({ to: "/servers/$nodeId", params: { nodeId: node.id } })}
          className={cn(
            "rounded-lg border bg-surface p-3 text-left transition-colors hover:bg-surface/80",
            node.status === "critical"
              ? "border-status-critical"
              : node.status === "warning"
                ? "border-status-warning"
                : "border-border",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{node.id}</span>
            <StatusIndicatorDot status={getStatusType(node.status)} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{node.role}</div>
          {node.ipAddress && (
            <div className="mt-1 text-xs text-muted-foreground">{node.ipAddress}</div>
          )}
        </button>
      ))}
    </div>
  );
}
