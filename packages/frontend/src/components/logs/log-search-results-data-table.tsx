import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { LoadingSkeletonPlaceholder } from "@/components/shared/loading-skeleton-placeholder";
import { Download, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import type { LogSearchFilters } from "@/routes/_authenticated/logs/index";

interface EmailEvent {
  id: string;
  time: string;
  eventType: string;
  fromAddress: string;
  toAddress: string;
  mtaNode: string;
  sendingIp: string;
  statusCode: number | null;
  statusMessage: string | null;
  messageId: string;
  queueId: string;
  deliveryTime: number | null;
  messageSize: number | null;
}

interface LogSearchResultsDataTableProps {
  filters: LogSearchFilters;
  searchKey: number;
}

export function LogSearchResultsDataTable({ filters, searchKey }: LogSearchResultsDataTableProps) {
  const navigate = useNavigate();
  const { from, to } = useTimeRangeStore();
  const [cursor, setCursor] = useState<string | null>(null);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["logs", "search", from, to, filters, cursor, searchKey],
    queryFn: () =>
      apiClient.get<{ rows: EmailEvent[]; hasMore: boolean; cursor: string | null }>(
        "/logs/search",
        {
          from: from.toISOString(),
          to: to.toISOString(),
          ...filters,
          eventType: filters.eventType?.join(","),
          cursor: cursor || undefined,
          limit,
        }
      ),
  });

  const handleLoadMore = () => {
    if (data?.cursor) {
      setCursor(data.cursor);
    }
  };

  const handleExport = () => {
    // Placeholder for CSV export
    alert("CSV export functionality - to be implemented");
  };

  const getEventBadgeColor = (eventType: string) => {
    const colors: Record<string, string> = {
      delivered: "bg-green-500/20 text-green-400",
      bounced: "bg-red-500/20 text-red-400",
      deferred: "bg-yellow-500/20 text-yellow-400",
      queued: "bg-blue-500/20 text-blue-400",
      rejected: "bg-red-500/20 text-red-400",
      transferred: "bg-purple-500/20 text-purple-400",
    };
    return colors[eventType.toLowerCase()] || "bg-gray-500/20 text-gray-400";
  };

  if (isLoading && !data) {
    return <LoadingSkeletonPlaceholder className="h-96" />;
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-muted/20 p-12">
        <p className="text-sm text-muted-foreground">
          No logs found. Try adjusting your search filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full table-dense">
          <thead>
            <tr className="">
              <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                Time
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                Event
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                From
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                To
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                Node
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                IP
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                Size
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  {format(new Date(row.time), "MMM dd, HH:mm:ss")}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${getEventBadgeColor(row.eventType)}`}
                  >
                    {row.eventType}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-foreground">{row.fromAddress}</td>
                <td className="px-3 py-3 text-xs text-foreground">{row.toAddress}</td>
                <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                  {row.mtaNode}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                  {row.sendingIp}
                </td>
                <td className="px-3 py-3 text-xs">
                  {row.statusCode ? (
                    <span
                      className={
                        row.statusCode >= 200 && row.statusCode < 300
                          ? "text-green-400"
                          : "text-red-400"
                      }
                    >
                      {row.statusCode}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  {row.messageSize ? `${(row.messageSize / 1024).toFixed(1)} KB` : "-"}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    onClick={() => navigate({ to: `/logs/trace/${row.messageId}` })}
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Trace
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {data.hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className="rounded-md border border-border bg-background px-6 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
