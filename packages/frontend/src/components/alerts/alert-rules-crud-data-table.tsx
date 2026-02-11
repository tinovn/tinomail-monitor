import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { Edit2, Trash2 } from "lucide-react";
import type { AlertRule } from "@tinomail/shared";
import { apiClient } from "@/lib/api-http-client";
import { AlertSeverityIconBadge } from "./alert-severity-icon-badge";
import { cn } from "@/lib/classname-utils";

const columnHelper = createColumnHelper<AlertRule>();

interface AlertRulesDataTableProps {
  onEditRule: (rule: AlertRule) => void;
}

export function AlertRulesCrudDataTable({ onEditRule }: AlertRulesDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const queryClient = useQueryClient();

  const { data: rules = [] } = useQuery<AlertRule[]>({
    queryKey: ["alerts", "rules"],
    queryFn: () => apiClient.get("/alerts/rules"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      await apiClient.put(`/alerts/rules/${id}/toggle`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "rules"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.del(`/alerts/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "rules"] });
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        cell: (info) => (
          <span className="font-medium text-sm">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("severity", {
        header: "Severity",
        cell: (info) => (
          <AlertSeverityIconBadge
            severity={info.getValue() as "critical" | "warning" | "info"}
            size="sm"
          />
        ),
      }),
      columnHelper.accessor("condition", {
        header: "Condition",
        cell: (info) => (
          <span className="font-mono text-xs">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("threshold", {
        header: "Threshold",
        cell: (info) => (
          <span className="text-sm">{info.getValue() ?? "—"}</span>
        ),
      }),
      columnHelper.accessor("duration", {
        header: "Duration",
        cell: (info) => (
          <span className="text-sm">{info.getValue() || "—"}</span>
        ),
      }),
      columnHelper.accessor("cooldown", {
        header: "Cooldown",
        cell: (info) => (
          <span className="text-sm">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("enabled", {
        header: "Enabled",
        cell: (info) => {
          const rule = info.row.original;
          return (
            <button
              onClick={() =>
                toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })
              }
              disabled={toggleMutation.isPending}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                rule.enabled ? "bg-green-500" : "bg-gray-500/30",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  rule.enabled ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const rule = info.row.original;
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEditRule(rule)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-sm hover:bg-surface/80"
                title="Edit rule"
              >
                <Edit2 className="h-3 w-3" />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete rule "${rule.name}"?`)) {
                    deleteMutation.mutate(rule.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-sm text-red-500 hover:bg-red-500/20 disabled:opacity-50"
                title="Delete rule"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        },
      }),
    ],
    [toggleMutation, deleteMutation, onEditRule],
  );

  const table = useReactTable({
    data: rules,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (rules.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border border-border bg-surface p-12">
        <p className="text-muted-foreground">No alert rules configured</p>
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
