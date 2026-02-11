import { useState } from "react";
import type { Node } from "@tinomail/shared";
import { StatusIndicatorDot } from "@/components/shared/status-indicator-dot";
import { ProgressBarInlineWithLabel } from "@/components/shared/progress-bar-inline-with-label";
import { formatDistanceToNow } from "date-fns";
import { apiClient } from "@/lib/api-http-client";
import { useAuthStore } from "@/stores/auth-session-store";
import { NodeActionConfirmDialog } from "@/components/servers/node-action-confirm-dialog";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

interface NodeMetrics {
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
  ramUsedBytes: number | null;
  diskFreeBytes: number | null;
}

interface ServerDetailHeaderInfoProps {
  node: Node;
  metrics?: NodeMetrics | null;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "—";
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

export function ServerDetailHeaderInfo({ node, metrics }: ServerDetailHeaderInfoProps) {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [updateStatus, setUpdateStatus] = useState<"idle" | "requesting" | "sent">("idle");
  const [confirmAction, setConfirmAction] = useState<"delete" | "block" | "unblock" | null>(null);
  const isBlocked = node.status === "blocked";

  const getStatusType = (status: string): "ok" | "warning" | "critical" | "muted" => {
    if (status === "active") return "ok";
    if (status === "warning") return "warning";
    if (status === "critical") return "critical";
    return "muted";
  };

  const uptime = node.lastSeen
    ? formatDistanceToNow(new Date(node.registeredAt), { addSuffix: false })
    : "Unknown";

  const handleRequestUpdate = async () => {
    setUpdateStatus("requesting");
    try {
      await apiClient.post(`/admin/nodes/${node.id}/request-update`);
      setUpdateStatus("sent");
    } catch {
      setUpdateStatus("idle");
    }
  };

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
            {node.agentVersion && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Agent Version:</span>
                <span className="font-mono text-sm text-foreground">v{node.agentVersion}</span>
              </div>
            )}
          </div>
        </div>

        {/* Live metrics summary */}
        {metrics && (
          <div className="flex items-center gap-6">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">CPU</div>
              <ProgressBarInlineWithLabel
                percent={metrics.cpuPercent ?? 0}
                width="w-28"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">RAM</div>
              <ProgressBarInlineWithLabel
                percent={metrics.ramPercent ?? 0}
                absoluteText={formatBytes(metrics.ramUsedBytes)}
                width="w-28"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Disk</div>
              <ProgressBarInlineWithLabel
                percent={metrics.diskPercent ?? 0}
                absoluteText={metrics.diskFreeBytes != null ? `${formatBytes(metrics.diskFreeBytes)} free` : undefined}
                width="w-28"
              />
            </div>
          </div>
        )}

        <div className="text-right">
          <div className="text-sm text-muted-foreground">Uptime</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{uptime}</div>
          {node.lastSeen && (
            <div className="mt-1 text-xs text-muted-foreground">
              Last seen {formatDistanceToNow(new Date(node.lastSeen), { addSuffix: true })}
            </div>
          )}
          {isAdmin && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleRequestUpdate}
                disabled={updateStatus !== "idle"}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {updateStatus === "requesting" ? "Requesting..." :
                 updateStatus === "sent" ? "Update Requested" :
                 "Update Agent"}
              </button>
              <button
                onClick={() => setConfirmAction(isBlocked ? "unblock" : "block")}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
              >
                {isBlocked ? "Unblock" : "Block"}
              </button>
              <button
                onClick={() => setConfirmAction("delete")}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {confirmAction === "delete" && (
        <NodeActionConfirmDialog
          open
          title="Delete Node"
          description={`Delete node "${node.id}"? The agent can re-register on next heartbeat.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={async () => {
            await apiClient.del(`/admin/nodes/${node.id}`);
            setConfirmAction(null);
            navigate({ to: "/servers" });
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {(confirmAction === "block" || confirmAction === "unblock") && (
        <NodeActionConfirmDialog
          open
          title={confirmAction === "block" ? "Block Node" : "Unblock Node"}
          description={
            confirmAction === "block"
              ? `Block node "${node.id}"? The agent will be rejected on next registration.`
              : `Unblock node "${node.id}"? The agent will be able to register again.`
          }
          confirmLabel={confirmAction === "block" ? "Block" : "Unblock"}
          variant="warning"
          onConfirm={async () => {
            await apiClient.put(`/admin/nodes/${node.id}/block`, {
              blocked: confirmAction === "block",
            });
            setConfirmAction(null);
            queryClient.invalidateQueries({ queryKey: ["node", node.id] });
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
