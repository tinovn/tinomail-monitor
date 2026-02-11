import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { StatusIndicatorDot } from "@/components/shared/status-indicator-dot";

interface CheckResult {
  time: string;
  blacklist: string;
  tier: string;
  listed: boolean;
  response: string | null;
}

const columnHelper = createColumnHelper<CheckResult>();

interface IpCheckResultsTableProps {
  data: CheckResult[];
}

export function IpCheckResultsTable({ data }: IpCheckResultsTableProps) {
  const [sorting, setSorting] = useMemo(() => [[] as SortingState, () => {}] as const, []);

  const columns = useMemo(
    () => [
      columnHelper.accessor("blacklist", {
        header: "Blacklist",
        cell: (info) => (
          <span className="font-mono text-sm">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("tier", {
        header: "Tier",
        cell: (info) => {
          const tier = info.getValue();
          return (
            <span
              className={`rounded px-2 py-1 text-xs font-medium ${
                tier === "critical"
                  ? "bg-status-critical/20 text-status-critical"
                  : tier === "high"
                    ? "bg-status-warning/20 text-status-warning"
                    : "bg-surface text-muted-foreground"
              }`}
            >
              {tier.toUpperCase()}
            </span>
          );
        },
      }),
      columnHelper.accessor("listed", {
        header: "Status",
        cell: (info) => {
          const listed = info.getValue();
          return (
            <StatusIndicatorDot
              status={listed ? "critical" : "ok"}
              label={listed ? "LISTED" : "CLEAN"}
            />
          );
        },
      }),
      columnHelper.accessor("response", {
        header: "Response",
        cell: (info) => {
          const response = info.getValue();
          return (
            <span className="font-mono text-xs text-muted-foreground">
              {response || "—"}
            </span>
          );
        },
      }),
      columnHelper.accessor("time", {
        header: "Last Checked",
        cell: (info) => {
          const time = info.getValue();
          return (
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(time), { addSuffix: true })}
            </span>
          );
        },
      }),
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-border">
        <p className="text-sm text-muted-foreground">No check results available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <table className="w-full table-dense">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="bg-surface/50">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left text-sm font-semibold text-foreground"
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
              className="transition-colors hover:bg-surface/30"
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
