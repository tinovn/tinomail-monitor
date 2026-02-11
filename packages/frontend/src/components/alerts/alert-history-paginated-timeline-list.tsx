import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import type { AlertEvent, SeverityLevel } from "@tinomail/shared";
import { apiClient } from "@/lib/api-http-client";
import { AlertSeverityIconBadge } from "./alert-severity-icon-badge";
import { cn } from "@/lib/classname-utils";

interface AlertHistoryWithRuleName extends AlertEvent {
  ruleName?: string;
}

interface AlertHistoryParams extends Record<string, unknown> {
  severity?: SeverityLevel;
  ruleId?: number;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

interface AlertHistoryResponse {
  data: AlertHistoryWithRuleName[];
  total: number;
  page: number;
  limit: number;
}

export function AlertHistoryPaginatedTimelineList() {
  const [filters, setFilters] = useState<AlertHistoryParams>({
    page: 1,
    limit: 20,
  });

  const { data, isLoading } = useQuery<AlertHistoryResponse>({
    queryKey: ["alerts", "history", filters],
    queryFn: () => apiClient.get("/alerts/history", filters),
  });

  const alerts = data?.data || [];
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 rounded-md border border-border bg-surface p-4">
        <select
          value={filters.severity || ""}
          onChange={(e) =>
            setFilters({ ...filters, severity: e.target.value as SeverityLevel, page: 1 })
          }
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>

        <button
          onClick={() => setFilters({ ...filters, page: 1 })}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-surface/80"
        >
          Refresh
        </button>
      </div>

      {/* Timeline List */}
      {isLoading ? (
        <div className="flex items-center justify-center rounded-md border border-border bg-surface p-12">
          <p className="text-muted-foreground">Loading history...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex items-center justify-center rounded-md border border-border bg-surface p-12">
          <p className="text-muted-foreground">No alert history found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const firedAt = new Date(alert.firedAt);
            const resolvedAt = alert.resolvedAt ? new Date(alert.resolvedAt) : null;

            return (
              <div
                key={alert.id}
                className="rounded-md border border-border bg-surface p-4 transition-colors hover:bg-surface/80"
              >
                <div className="flex items-start gap-4">
                  <AlertSeverityIconBadge
                    severity={alert.severity as SeverityLevel}
                    size="sm"
                  />

                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-sm">
                          {alert.ruleName || `Alert #${alert.id}`}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {alert.message || "No message"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-1 rounded",
                          alert.status === "resolved"
                            ? "bg-green-500/10 text-green-500"
                            : "bg-red-500/10 text-red-500"
                        )}
                      >
                        {alert.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Fired: {firedAt.toLocaleString()}
                        {" "}({formatDistanceToNow(firedAt, { addSuffix: true })})
                      </span>
                      {resolvedAt ? (
                        <span>
                          Resolved: {resolvedAt.toLocaleString()}
                          {" "}(Duration: {formatDistanceToNow(firedAt, { addSuffix: false })})
                        </span>
                      ) : (
                        <span className="text-yellow-500">Still firing</span>
                      )}
                    </div>

                    {alert.nodeId && (
                      <div className="text-xs text-muted-foreground">
                        Node: <span className="font-mono">{alert.nodeId}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-md border border-border bg-surface p-4">
          <button
            onClick={() => setFilters({ ...filters, page: filters.page! - 1 })}
            disabled={filters.page === 1}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-surface/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <span className="text-sm text-muted-foreground">
            Page {filters.page} of {totalPages}
          </span>

          <button
            onClick={() => setFilters({ ...filters, page: filters.page! + 1 })}
            disabled={filters.page === totalPages}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-surface/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
