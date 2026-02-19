import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import type { SendingDomain } from "@tinomail/shared";
import { StatusIndicatorDot } from "@/components/shared/status-indicator-dot";
import { cn } from "@/lib/classname-utils";

interface DomainWithHealthScore extends SendingDomain {
  healthScore: number;
  sent24h: number;
  deliveredPercent: number;
  bouncePercent: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const columnHelper = createColumnHelper<DomainWithHealthScore>();

interface DomainHealthScoreTableProps {
  domains: DomainWithHealthScore[];
  sorting: SortingState;
  onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
  search: string;
  onSearchChange: (value: string) => void;
  pagination?: Pagination;
  onPageChange: (page: number) => void;
}

export function DomainHealthScoreTable({
  domains,
  sorting,
  onSortingChange,
  search,
  onSearchChange,
  pagination,
  onPageChange,
}: DomainHealthScoreTableProps) {
  const navigate = useNavigate();

  const columns = useMemo(
    () => [
      columnHelper.accessor("domain", {
        header: "Domain",
        cell: (info) => (
          <span className="font-mono text-sm font-medium">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("healthScore", {
        header: "Health Score",
        cell: (info) => {
          const score = info.getValue();
          const colorClass =
            score >= 90 ? "bg-status-ok" :
            score >= 70 ? "bg-status-warning" : "bg-status-critical";

          return (
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-surface">
                <div
                  className={cn("h-full transition-all", colorClass)}
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className="text-sm font-medium">{score}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("sent24h", {
        header: "Sent (24h)",
        cell: (info) => (
          <span className="text-sm">{(info.getValue() ?? 0).toLocaleString()}</span>
        ),
      }),
      columnHelper.accessor("deliveredPercent", {
        header: "Delivered %",
        cell: (info) => {
          const percent = info.getValue() ?? 0;
          return (
            <span className={cn(
              "text-sm font-medium",
              percent >= 95 ? "text-status-ok" :
              percent >= 90 ? "text-status-warning" : "text-status-critical"
            )}>
              {percent.toFixed(1)}%
            </span>
          );
        },
      }),
      columnHelper.accessor("bouncePercent", {
        header: "Bounce %",
        cell: (info) => {
          const percent = info.getValue() ?? 0;
          return (
            <span className={cn(
              "text-sm font-medium",
              percent < 2 ? "text-status-ok" :
              percent < 5 ? "text-status-warning" : "text-status-critical"
            )}>
              {percent.toFixed(1)}%
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "auth-status",
        header: "DKIM/SPF/DMARC",
        cell: (info) => {
          const domain = info.row.original;
          return (
            <div className="flex items-center gap-2">
              <StatusIndicatorDot
                status={domain.dkimConfigured ? "ok" : "critical"}
                label="DKIM"
              />
              <StatusIndicatorDot
                status={domain.spfConfigured ? "ok" : "critical"}
                label="SPF"
              />
              <StatusIndicatorDot
                status={domain.dmarcConfigured ? "ok" : "critical"}
                label="DMARC"
              />
            </div>
          );
        },
      }),
      columnHelper.accessor("dailyLimit", {
        header: "Daily Limit",
        cell: (info) => {
          const limit = info.getValue();
          return (
            <span className="text-sm">
              {limit ? limit.toLocaleString() : "Unlimited"}
            </span>
          );
        },
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: domains,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true,
  });

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search domains..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-64 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        {pagination && (
          <span className="text-xs text-muted-foreground">
            {pagination.total} domain{pagination.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border border-border bg-surface">
        <table className="w-full table-dense">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      "text-left text-sm font-semibold text-foreground",
                      header.column.getCanSort() && "cursor-pointer select-none hover:text-primary",
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && <span className="text-xs">▲</span>}
                      {header.column.getIsSorted() === "desc" && <span className="text-xs">▼</span>}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() =>
                  navigate({ to: "/domains/$domain", params: { domain: row.original.domain } })
                }
                className="cursor-pointer transition-colors hover:bg-surface/80"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-2">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          <div className="flex items-center gap-1">
            {generatePageNumbers(pagination.page, pagination.pages).map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange(p as number)}
                  className={cn(
                    "min-w-8 rounded-md px-2 py-1.5 text-sm",
                    p === pagination.page
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-surface/80 text-muted-foreground",
                  )}
                >
                  {p}
                </button>
              ),
            )}
          </div>

          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

/** Generate page numbers with ellipsis for large page counts */
function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");
  pages.push(total);

  return pages;
}
