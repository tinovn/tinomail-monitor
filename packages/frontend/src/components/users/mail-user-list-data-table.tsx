import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { MailUserRiskLevelBadge } from "./mail-user-risk-level-badge";

export interface MailUserListItem {
  address: string;
  sent24h: number;
  received24h: number;
  bounceRate: number;
  spamReports: number;
  riskLevel: "Low" | "Medium" | "High";
}

const columnHelper = createColumnHelper<MailUserListItem>();

interface MailUserListDataTableProps {
  users: MailUserListItem[];
  sorting: SortingState;
  onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
}

export function MailUserListDataTable({
  users,
  sorting,
  onSortingChange,
}: MailUserListDataTableProps) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  const columns = useMemo(
    () => [
      columnHelper.accessor("address", {
        header: "User Address",
        cell: (info) => (
          <span className="font-mono text-sm">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("sent24h", {
        header: "Sent (24h)",
        cell: (info) => (
          <span className="text-sm">{info.getValue().toLocaleString()}</span>
        ),
      }),
      columnHelper.accessor("received24h", {
        header: "Received (24h)",
        cell: (info) => (
          <span className="text-sm">{info.getValue().toLocaleString()}</span>
        ),
      }),
      columnHelper.accessor("bounceRate", {
        header: "Bounce %",
        cell: (info) => {
          const percent = info.getValue() ?? 0;
          return (
            <span
              className={`text-sm ${
                percent > 10
                  ? "text-status-critical"
                  : percent > 5
                    ? "text-status-warning"
                    : "text-foreground"
              }`}
            >
              {percent.toFixed(1)}%
            </span>
          );
        },
      }),
      columnHelper.accessor("spamReports", {
        header: "Spam Reports",
        cell: (info) => {
          const count = info.getValue();
          return (
            <span
              className={`text-sm ${count > 0 ? "text-status-critical" : "text-foreground"}`}
            >
              {count}
            </span>
          );
        },
      }),
      columnHelper.accessor("riskLevel", {
        header: "Risk Level",
        cell: (info) => <MailUserRiskLevelBadge level={info.getValue()} />,
      }),
    ],
    []
  );

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting, columnFilters, pagination },
    onSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search by address..."
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          value={(table.getColumn("address")?.getFilterValue() as string) ?? ""}
          onChange={(e) =>
            table.getColumn("address")?.setFilterValue(e.target.value)
          }
        />
      </div>

      <div className="rounded-md border border-border bg-surface">
        <table className="w-full table-dense">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left text-xs font-semibold text-muted-foreground"
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

        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm text-muted-foreground">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{" "}
            of {table.getFilteredRowModel().rows.length} users
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-md border border-border bg-surface px-3 py-1 text-sm text-foreground hover:bg-surface/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-md border border-border bg-surface px-3 py-1 text-sm text-foreground hover:bg-surface/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
