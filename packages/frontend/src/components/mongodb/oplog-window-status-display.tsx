import { cn } from "@/lib/classname-utils";

interface MongodbNodeStatus {
  nodeId: string;
  role: string | null;
  oplogWindowHours: number | null;
}

interface OplogWindowStatusDisplayProps {
  nodes: MongodbNodeStatus[];
}

export function OplogWindowStatusDisplay({
  nodes,
}: OplogWindowStatusDisplayProps) {
  const primaryNode = nodes.find((n) => n.role === "PRIMARY");

  if (!primaryNode) {
    return (
      <div className="flex h-[150px] items-center justify-center text-xs text-muted-foreground">
        No PRIMARY node found
      </div>
    );
  }

  const oplogHours = primaryNode.oplogWindowHours;
  const statusColor = getOplogStatusColor(oplogHours);
  const statusLabel = getOplogStatusLabel(oplogHours);

  return (
    <div className="flex h-[150px] flex-col items-center justify-center space-y-3">
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

      <div
        className={cn(
          "rounded px-3 py-1 text-xs font-medium",
          statusColor,
        )}
      >
        {statusLabel}
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
