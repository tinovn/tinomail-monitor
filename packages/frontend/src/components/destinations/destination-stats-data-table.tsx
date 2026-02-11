import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { cn } from "@/lib/classname-utils";

interface DestinationStats {
  toDomain: string;
  totalSent: number;
  delivered: number;
  bounced: number;
  deliveredPercent: number;
  bouncePercent: number;
  avgDeliveryMs: number;
}

const columnHelper = createColumnHelper<DestinationStats>();

interface DestinationStatsDataTableProps {
  destinations: DestinationStats[];
  sorting: SortingState;
  onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
}

export function DestinationStatsDataTable({
  destinations,
  sorting,
  onSortingChange,
}: DestinationStatsDataTableProps) {
  const columns = useMemo(
    () => [
      columnHelper.accessor("toDomain", {
        header: "Destination Domain",
        cell: (info) => (
          <span className="font-mono text-sm font-medium">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("totalSent", {
        header: "Sent",
        cell: (info) => (
          <span className="text-sm">{info.getValue().toLocaleString()}</span>
        ),
      }),
      columnHelper.accessor("delivered", {
        header: "Delivered",
        cell: (info) => (
          <span className="text-sm text-status-ok">
            {info.getValue().toLocaleString()}
          </span>
        ),
      }),
      columnHelper.accessor("deliveredPercent", {
        header: "Delivered %",
        cell: (info) => {
          const percent = info.getValue();
          return (
            <span
              className={cn(
                "text-sm font-medium",
                percent >= 95
                  ? "text-status-ok"
                  : percent >= 90
                    ? "text-status-warning"
                    : "text-status-critical"
              )}
            >
              {percent.toFixed(1)}%
            </span>
          );
        },
      }),
      columnHelper.accessor("bouncePercent", {
        header: "Bounce %",
        cell: (info) => {
          const percent = info.getValue();
          return (
            <span
              className={cn(
                "text-sm font-medium",
                percent < 2
                  ? "text-status-ok"
                  : percent < 5
                    ? "text-status-warning"
                    : "text-status-critical"
              )}
            >
              {percent.toFixed(1)}%
            </span>
          );
        },
      }),
      columnHelper.accessor("avgDeliveryMs", {
        header: "Avg Time",
        cell: (info) => {
          const ms = info.getValue();
          const formatted = ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
          return (
            <span
              className={cn(
                "text-sm",
                ms < 2000 ? "text-status-ok" : ms < 5000 ? "text-status-warning" : "text-status-critical"
              )}
            >
              {formatted}
            </span>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: destinations,
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
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="transition-colors hover:bg-surface/80"
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
