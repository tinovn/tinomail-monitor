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

const columnHelper = createColumnHelper<DomainWithHealthScore>();

interface DomainHealthScoreTableProps {
  domains: DomainWithHealthScore[];
  sorting: SortingState;
  onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
}

export function DomainHealthScoreTable({
  domains,
  sorting,
  onSortingChange,
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
  });

  return (
    <div className="rounded-md border border-border bg-surface">
      <table className="w-full table-dense">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="text-left text-sm font-semibold text-foreground"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
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
  );
}
