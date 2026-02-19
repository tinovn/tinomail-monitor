import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { SparklineMiniChart } from "@/components/charts/sparkline-mini-chart";
import { cn } from "@/lib/classname-utils";

interface MongodbNodeStatus {
  nodeId: string;
  time: string;
  role: string | null;
  connectionsCurrent: number | null;
  connectionsAvailable: number | null;
  replLagSeconds: number | null;
  dataSizeBytes: number | null;
  indexSizeBytes: number | null;
  storageSizeBytes: number | null;
  oplogWindowHours: number | null;
  wtCacheUsedBytes: number | null;
  wtCacheMaxBytes: number | null;
}

interface ReplicaSetStatusPanelProps {
  nodes: MongodbNodeStatus[];
}

export function ReplicaSetStatusPanel({ nodes }: ReplicaSetStatusPanelProps) {
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data: lagSparklines } = useQuery({
    queryKey: ["mongodb", "repl-lag-sparkline"],
    queryFn: () => apiClient.get<Record<string, number[]>>("/mongodb/repl-lag-sparkline"),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {nodes.map((node) => {
        const lagStatus = getLagStatus(node.replLagSeconds);
        const roleColor = getRoleColor(node.role);
        const isSecondary = node.role?.toUpperCase() === "SECONDARY";
        const sparklineData = lagSparklines?.[node.nodeId] ?? [];
        const sparklineColor =
          lagStatus === "critical"
            ? "#dc655f"
            : lagStatus === "warning"
              ? "#ce9200"
              : "#3aa85b";

        return (
          <div
            key={node.nodeId}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {node.nodeId}
              </h3>
              <span className={cn("rounded px-2 py-0.5 text-xs font-medium", roleColor)}>
                {node.role?.toUpperCase() || "UNKNOWN"}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Repl Lag:</span>
                <span
                  className={cn(
                    "font-medium",
                    lagStatus === "ok" && "text-status-ok",
                    lagStatus === "warning" && "text-status-warning",
                    lagStatus === "critical" && "text-status-critical",
                  )}
                >
                  {node.replLagSeconds !== null
                    ? `${node.replLagSeconds.toFixed(1)}s`
                    : "N/A"}
                </span>
              </div>

              {isSecondary && sparklineData.length > 0 && (
                <SparklineMiniChart
                  data={sparklineData}
                  color={sparklineColor}
                  height={32}
                />
              )}

              <div className="flex justify-between">
                <span className="text-muted-foreground">Connections:</span>
                <span className="font-medium text-foreground">
                  {node.connectionsCurrent !== null
                    ? `${node.connectionsCurrent} / ${node.connectionsAvailable || "?"}`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getRoleColor(role: string | null): string {
  const normalized = role?.toUpperCase();
  if (normalized === "PRIMARY") return "bg-status-ok/20 text-status-ok";
  if (normalized === "SECONDARY") return "bg-status-info/20 text-status-info";
  return "bg-muted text-muted-foreground";
}

function getLagStatus(lagSeconds: number | null): "ok" | "warning" | "critical" {
  if (lagSeconds === null) return "ok";
  if (lagSeconds > 30) return "critical";
  if (lagSeconds > 10) return "warning";
  return "ok";
}
