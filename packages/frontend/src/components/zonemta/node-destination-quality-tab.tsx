import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import type { DestinationQuality } from "@tinomail/shared";
import { cn } from "@/lib/classname-utils";

const columnHelper = createColumnHelper<DestinationQuality>();

interface NodeDestinationQualityTabProps {
  destinations: DestinationQuality[];
}

export function NodeDestinationQualityTab({ destinations }: NodeDestinationQualityTabProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "sent", desc: true }]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("destination", {
        header: "Destination Domain",
        cell: (info) => (
          <span className="font-medium text-sm">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("sent", {
        header: "Sent",
        cell: (info) => (
          <span className="text-sm">{(info.getValue() ?? 0).toLocaleString()}</span>
        ),
      }),
      columnHelper.accessor("delivered", {
        header: "Delivered",
        cell: (info) => (
          <span className="text-sm text-status-ok">{(info.getValue() ?? 0).toLocaleString()}</span>
        ),
      }),
      columnHelper.accessor("bounced", {
        header: "Bounced",
        cell: (info) => (
          <span className="text-sm text-status-critical">{(info.getValue() ?? 0).toLocaleString()}</span>
        ),
      }),
      columnHelper.accessor("deferred", {
        header: "Deferred",
        cell: (info) => (
          <span className="text-sm text-status-warning">{(info.getValue() ?? 0).toLocaleString()}</span>
        ),
      }),
      columnHelper.accessor("deliveryRate", {
        header: "Delivery Rate",
        cell: (info) => {
          const rate = info.getValue() ?? 0;
          return (
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    rate >= 95 ? "bg-status-ok" :
                    rate >= 85 ? "bg-status-warning" : "bg-status-critical"
                  )}
                  style={{ width: `${rate}%` }}
                />
              </div>
              <span className="text-sm font-medium">{rate.toFixed(1)}%</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("avgDeliveryTime", {
        header: "Avg Time",
        cell: (info) => {
          const time = info.getValue();
          if (!time) return <span className="text-sm text-muted-foreground">—</span>;
          const seconds = (time / 1000).toFixed(1);
          return <span className="text-sm">{seconds}s</span>;
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: destinations,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <table className="w-full table-dense">
        <thead className="bg-muted/30 border-b border-border">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() && (
                      <span>{header.column.getIsSorted() === "asc" ? "↑" : "↓"}</span>
                    )}
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
              className="border-b border-border hover:bg-muted/30 transition-colors"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3">
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
