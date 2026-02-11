import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-http-client";
import { cn } from "@/lib/classname-utils";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: "create" | "update" | "delete";
  resource: string;
  resourceId: string;
  details: string;
}

export function AuditLogSearchableDataTable() {
  const [filters, setFilters] = useState({
    user: "",
    action: "",
    resource: "",
    fromDate: "",
    toDate: "",
  });
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const limit = 20;

  const { data: logs = [], isLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ["admin", "audit-log", filters, page],
    queryFn: () => {
      const params: Record<string, string | number> = { page, limit };
      if (filters.user) params.user = filters.user;
      if (filters.action) params.action = filters.action;
      if (filters.resource) params.resource = filters.resource;
      if (filters.fromDate) params.from = filters.fromDate;
      if (filters.toDate) params.to = filters.toDate;
      return apiClient.get("/admin/audit-log", params);
    },
  });

  const actionColors: Record<string, string> = {
    create: "bg-green-500/10 text-green-500 border-green-500/20",
    update: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    delete: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPage(1); // Reset to first page on filter change
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-md border border-border bg-surface p-4">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Filters</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* User Filter */}
          <input
            type="text"
            placeholder="Filter by user"
            value={filters.user}
            onChange={(e) => handleFilterChange("user", e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />

          {/* Action Filter */}
          <select
            value={filters.action}
            onChange={(e) => handleFilterChange("action", e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
          </select>

          {/* Resource Filter */}
          <input
            type="text"
            placeholder="Filter by resource"
            value={filters.resource}
            onChange={(e) => handleFilterChange("resource", e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />

          {/* From Date */}
          <input
            type="date"
            value={filters.fromDate}
            onChange={(e) => handleFilterChange("fromDate", e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />

          {/* To Date */}
          <input
            type="date"
            value={filters.toDate}
            onChange={(e) => handleFilterChange("toDate", e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      {isLoading ? (
        <div className="flex items-center justify-center rounded-md border border-border bg-surface p-12">
          <p className="text-muted-foreground">Loading audit logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex items-center justify-center rounded-md border border-border bg-surface p-12">
          <p className="text-muted-foreground">No audit logs found</p>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead>
                <tr className="">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Timestamp</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">User</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Action</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Resource</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Resource ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      className="transition-colors hover:bg-surface/80 cursor-pointer"
                      onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                    >
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{log.user}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium capitalize",
                            actionColors[log.action] || "bg-gray-500/10 text-gray-500 border-gray-500/20",
                          )}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{log.resource}</td>
                      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{log.resourceId}</td>
                      <td className="px-4 py-3 text-sm text-blue-500 hover:text-blue-600">
                        {expandedRow === log.id ? "Hide" : "Show"}
                      </td>
                    </tr>
                    {expandedRow === log.id && (
                      <tr className="bg-surface/50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="rounded-md bg-black/20 p-3">
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{log.details}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface/80 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={logs.length < limit}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface/80 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
