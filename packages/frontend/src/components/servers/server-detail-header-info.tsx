import type { Node } from "@tinomail/shared";
import { StatusIndicatorDot } from "@/components/shared/status-indicator-dot";
import { formatDistanceToNow } from "date-fns";

interface ServerDetailHeaderInfoProps {
  node: Node;
}

export function ServerDetailHeaderInfo({ node }: ServerDetailHeaderInfoProps) {
  const getStatusType = (status: string): "ok" | "warning" | "critical" | "muted" => {
    if (status === "active") return "ok";
    if (status === "warning") return "warning";
    if (status === "critical") return "critical";
    return "muted";
  };

  const uptime = node.lastSeen
    ? formatDistanceToNow(new Date(node.registeredAt), { addSuffix: false })
    : "Unknown";

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{node.id}</h2>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <StatusIndicatorDot status={getStatusType(node.status)} label={node.status} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Role:</span>
              <span className="text-sm text-foreground">{node.role}</span>
            </div>
            {node.ipAddress && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">IP Address:</span>
                <span className="font-mono text-sm text-foreground">{node.ipAddress}</span>
              </div>
            )}
            {node.hostname && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Hostname:</span>
                <span className="text-sm text-foreground">{node.hostname}</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Uptime</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{uptime}</div>
          {node.lastSeen && (
            <div className="mt-1 text-xs text-muted-foreground">
              Last seen {formatDistanceToNow(new Date(node.lastSeen), { addSuffix: true })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
