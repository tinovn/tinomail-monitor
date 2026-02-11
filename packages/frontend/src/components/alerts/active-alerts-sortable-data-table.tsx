import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import type { AlertEvent } from "@tinomail/shared";
import { apiClient } from "@/lib/api-http-client";
import { AlertSeverityIconBadge } from "./alert-severity-icon-badge";
import { AlertAcknowledgeAndSnoozeActionButtons } from "./alert-acknowledge-and-snooze-action-buttons";

interface ActiveAlertsWithRuleName extends AlertEvent {
  ruleName?: string;
  escalationLevel?: number;
}

const columnHelper = createColumnHelper<ActiveAlertsWithRuleName>();

interface ActiveAlertsDataTableProps {
  sorting: SortingState;
  onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
}

export function ActiveAlertsSortableDataTable({
  sorting,
  onSortingChange,
}: ActiveAlertsDataTableProps) {
  const { data: alerts = [], refetch } = useQuery<ActiveAlertsWithRuleName[]>({
    queryKey: ["alerts", "active"],
    queryFn: () => apiClient.get("/alerts"),
    refetchInterval: 15000, // Auto-refresh every 15s
  });

  // Calculate live duration
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render for live duration
      refetch();
    }, 30000); // Update every 30s for performance

    return () => clearInterval(interval);
  }, [refetch]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("severity", {
        header: "Severity",
        cell: (info) => (
          <AlertSeverityIconBadge
            severity={info.getValue() as "critical" | "warning" | "info"}
            size="sm"
          />
        ),
        sortingFn: (a, b) => {
          const order = { critical: 0, warning: 1, info: 2 };
          const aVal = order[a.original.severity as keyof typeof order] ?? 3;
          const bVal = order[b.original.severity as keyof typeof order] ?? 3;
          return aVal - bVal;
        },
      }),
      columnHelper.accessor("ruleName", {
        header: "Rule",
        cell: (info) => (
          <span className="font-medium text-sm">{info.getValue() || "N/A"}</span>
        ),
      }),
      columnHelper.accessor("message", {
        header: "Message",
        cell: (info) => (
          <span className="text-sm text-muted-foreground">
            {info.getValue() || "No message"}
          </span>
        ),
      }),
      columnHelper.accessor("nodeId", {
        header: "Node",
        cell: (info) => {
          const nodeId = info.getValue();
          return (
            <span className="font-mono text-xs">
              {nodeId || "—"}
            </span>
          );
        },
      }),
      columnHelper.accessor("firedAt", {
        header: "Fired At",
        cell: (info) => {
          const firedAt = new Date(info.getValue());
          return (
            <span className="text-sm">
              {firedAt.toLocaleString()}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "duration",
        header: "Duration",
        cell: (info) => {
          const firedAt = new Date(info.row.original.firedAt);
          return (
            <span className="text-sm font-medium text-yellow-500">
              {formatDistanceToNow(firedAt, { addSuffix: false })}
            </span>
          );
        },
      }),
      columnHelper.accessor("escalationLevel", {
        header: "Escalation",
        cell: (info) => {
          const level = info.getValue() || 0;
          return (
            <span className="text-sm">
              Level {level}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => (
          <AlertAcknowledgeAndSnoozeActionButtons
            alertId={info.row.original.id}
          />
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: alerts,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      sorting: [
        { id: "severity", desc: false }, // Critical first
        { id: "firedAt", desc: true },
      ],
    },
  });

  if (alerts.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border border-border bg-surface p-12">
        <p className="text-muted-foreground">No active alerts</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full table-dense">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-4 py-3 text-left text-sm font-semibold text-foreground cursor-pointer hover:bg-surface/80"
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() && (
                        <span className="text-xs">
                          {header.column.getIsSorted() === "asc" ? "↑" : "↓"}
                        </span>
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
                className="transition-colors hover:bg-surface/80"
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
    </div>
  );
}
