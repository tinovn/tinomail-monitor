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

interface TopSenderData {
  sender: string;
  totalSent: number;
  delivered: number;
  bounced: number;
  complained: number;
  bounceRate: number;
}

const columnHelper = createColumnHelper<TopSenderData>();

interface DomainTopSendersDataTableProps {
  senders: TopSenderData[];
  sorting: SortingState;
  onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
}

export function DomainTopSendersDataTable({
  senders,
  sorting,
  onSortingChange,
}: DomainTopSendersDataTableProps) {
  const columns = useMemo(
    () => [
      columnHelper.accessor("sender", {
        header: "Sender",
        cell: (info) => (
          <span className="font-mono text-sm">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("totalSent", {
        header: "Sent",
        cell: (info) => (
          <span className="text-sm">{(info.getValue() ?? 0).toLocaleString()}</span>
        ),
      }),
      columnHelper.accessor("delivered", {
        header: "Delivered",
        cell: (info) => (
          <span className="text-sm text-status-ok">
            {(info.getValue() ?? 0).toLocaleString()}
          </span>
        ),
      }),
      columnHelper.accessor("bounced", {
        header: "Bounced",
        cell: (info) => (
          <span className="text-sm text-status-critical">
            {(info.getValue() ?? 0).toLocaleString()}
          </span>
        ),
      }),
      columnHelper.display({
        id: "deliveryRate",
        header: "Delivery Rate",
        cell: (info) => {
          const row = info.row.original;
          const percent = row.totalSent > 0 ? (row.delivered / row.totalSent) * 100 : 0;
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
    ],
    []
  );

  const table = useReactTable({
    data: senders,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        Top Senders
      </h3>
      <table className="w-full table-dense">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground"
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
                <td key={cell.id} className="px-4 py-2">
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
