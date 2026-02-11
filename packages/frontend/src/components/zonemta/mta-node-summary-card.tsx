import { useNavigate } from "@tanstack/react-router";
import type { MtaNodeStats } from "@tinomail/shared";
import { StatusIndicatorDot } from "@/components/shared/status-indicator-dot";
import { cn } from "@/lib/classname-utils";
import { Server, Mail, TrendingUp, Clock, AlertTriangle, Cpu } from "lucide-react";

interface MtaNodeSummaryCardProps {
  node: MtaNodeStats;
}

export function MtaNodeSummaryCard({ node }: MtaNodeSummaryCardProps) {
  const navigate = useNavigate();

  const getStatusColor = () => {
    if (node.status === "active") {
      if (node.bounceRate > 5 || node.blacklistedIps > 0) return "warning";
      if (node.cpuUsage && node.cpuUsage > 80) return "warning";
      return "ok";
    }
    if (node.status === "inactive") return "critical";
    return "muted";
  };

  const handleClick = () => {
    navigate({ to: `/servers/zonemta/${node.nodeId}` });
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "rounded-lg border border-border bg-surface p-4 transition-all cursor-pointer",
        "hover:border-primary hover:shadow-md"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-foreground">
              {node.hostname || node.nodeId}
            </h3>
            {node.subnet && (
              <p className="text-xs text-muted-foreground">{node.subnet}</p>
            )}
          </div>
        </div>
        <StatusIndicatorDot status={getStatusColor()} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* IP Count */}
        <div className="flex items-center gap-2">
          <Server className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">IPs</div>
            <div className="text-sm font-semibold text-foreground">
              {node.activeIps}/{node.totalIps}
            </div>
          </div>
        </div>

        {/* Sent/Hour */}
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Sent/h</div>
            <div className="text-sm font-semibold text-foreground">
              {(node.sentLastHour ?? 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Bounce Rate */}
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Bounce</div>
            <div
              className={cn(
                "text-sm font-semibold",
                node.bounceRate > 5 ? "text-status-warning" : "text-foreground"
              )}
            >
              {(node.bounceRate ?? 0).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Queue Size */}
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Queue</div>
            <div className="text-sm font-semibold text-foreground">
              {(node.queueSize ?? 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Blacklisted IPs */}
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Blacklisted</div>
            <div
              className={cn(
                "text-sm font-semibold",
                node.blacklistedIps > 0 ? "text-status-critical" : "text-foreground"
              )}
            >
              {node.blacklistedIps}
            </div>
          </div>
        </div>

        {/* CPU Usage */}
        {node.cpuUsage !== null && (
          <div className="flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">CPU</div>
              <div
                className={cn(
                  "text-sm font-semibold",
                  node.cpuUsage > 80 ? "text-status-warning" : "text-foreground"
                )}
              >
                {node.cpuUsage.toFixed(0)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Last Seen */}
      {node.lastSeen && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Last seen: {new Date(node.lastSeen).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
