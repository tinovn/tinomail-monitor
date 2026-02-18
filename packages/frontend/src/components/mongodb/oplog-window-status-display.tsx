import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { cn } from "@/lib/classname-utils";

interface MongodbNodeStatus {
  nodeId: string;
  role: string | null;
  oplogWindowHours: number | null;
}

interface OplogWindowStatusDisplayProps {
  nodes: MongodbNodeStatus[];
}

interface OplogForecast {
  currentWindowHours: number | null;
  consumptionRatePerHour: number | null;
  forecastDays: number | null;
  dataPoints: { time: string; value: number }[];
}

export function OplogWindowStatusDisplay({ nodes }: OplogWindowStatusDisplayProps) {
  const autoRefresh = useTimeRangeStore((state) => state.autoRefresh);

  const { data: forecast } = useQuery({
    queryKey: ["mongodb", "oplog-forecast"],
    queryFn: () => apiClient.get<OplogForecast>("/mongodb/oplog-forecast"),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const primaryNode = nodes.find((n) => n.role?.toUpperCase() === "PRIMARY");

  if (!primaryNode) {
    return (
      <div className="flex h-50 items-center justify-center text-xs text-muted-foreground">
        No PRIMARY node found
      </div>
    );
  }

  const oplogHours = primaryNode.oplogWindowHours;
  const statusColor = getOplogStatusColor(oplogHours);
  const statusLabel = getOplogStatusLabel(oplogHours);

  const forecastDays = forecast?.forecastDays ?? null;
  const consumptionRatePerHour = forecast?.consumptionRatePerHour ?? null;
  const consumptionPerDay =
    consumptionRatePerHour !== null ? consumptionRatePerHour * 24 : null;

  const forecastColor =
    forecastDays === null
      ? "text-muted-foreground"
      : forecastDays < 2
        ? "text-status-critical"
        : forecastDays < 7
          ? "text-status-warning"
          : "text-status-ok";

  return (
    <div className="flex flex-col items-center justify-center space-y-3 py-2">
      <div className="text-center">
        <div className="text-xs text-muted-foreground">
          PRIMARY: {primaryNode.nodeId}
        </div>
      </div>

      <div className="text-center">
        <div className="text-4xl font-bold text-foreground">
          {oplogHours !== null ? oplogHours.toFixed(1) : "N/A"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">hours</div>
      </div>

      <div className={cn("rounded px-3 py-1 text-xs font-medium", statusColor)}>
        {statusLabel}
      </div>

      <div className="w-full border-t border-border pt-3 text-center space-y-1">
        {forecast && forecast.dataPoints?.length >= 2 ? (
          <>
            <div className={cn("text-xs font-medium", forecastColor)}>
              At current write rate: ~{forecastDays?.toFixed(1)} days remaining
            </div>
            {consumptionPerDay !== null && (
              <div className="text-xs text-muted-foreground">
                ~{consumptionPerDay.toFixed(1)} hours consumed/day
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-muted-foreground">
            Insufficient data for forecast
          </div>
        )}
      </div>
    </div>
  );
}

function getOplogStatusColor(hours: number | null): string {
  if (hours === null) return "bg-muted text-muted-foreground";
  if (hours > 48) return "bg-status-ok/20 text-status-ok";
  if (hours >= 24) return "bg-status-warning/20 text-status-warning";
  return "bg-status-critical/20 text-status-critical";
}

function getOplogStatusLabel(hours: number | null): string {
  if (hours === null) return "Unknown";
  if (hours > 48) return "Healthy";
  if (hours >= 24) return "Warning";
  return "Critical";
}
