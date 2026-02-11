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
import { formatDistanceToNow } from "date-fns";
import { StatusIndicatorDot } from "@/components/shared/status-indicator-dot";

interface BlacklistedIp {
  ip: string;
  ipVersion: number;
  nodeId: string | null;
  blacklists: Array<{
    blacklist: string;
    tier: string;
    listed: boolean;
    lastChecked: string;
  }>;
  highestTier: string;
  consecutiveChecks: number;
  status: string;
}

const columnHelper = createColumnHelper<BlacklistedIp>();

interface BlacklistedIpsDataTableProps {
  data: BlacklistedIp[];
  sorting: SortingState;
  onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
}

export function BlacklistedIpsDataTable({
  data,
  sorting,
  onSortingChange,
}: BlacklistedIpsDataTableProps) {
  const navigate = useNavigate();

  const columns = useMemo(
    () => [
      columnHelper.accessor("ip", {
        header: "IP Address",
        cell: (info) => (
          <span className="font-mono text-sm font-semibold">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("nodeId", {
        header: "Node",
        cell: (info) => (
          <span className="font-mono text-xs">{info.getValue() || "—"}</span>
        ),
      }),
      columnHelper.accessor("blacklists", {
        header: "Blacklists",
        cell: (info) => {
          const blacklists = info.getValue();
          const listedCount = blacklists.filter((b) => b.listed).length;
          return (
            <div className="flex flex-wrap gap-1">
              {blacklists.slice(0, 3).map((bl) => (
                <span
                  key={bl.blacklist}
                  className={`rounded px-2 py-0.5 text-xs ${
                    bl.tier === "critical"
                      ? "bg-status-critical/20 text-status-critical"
                      : bl.tier === "high"
                        ? "bg-status-warning/20 text-status-warning"
                        : "bg-surface text-muted-foreground"
                  }`}
                >
                  {bl.blacklist.split(".")[0]}
                </span>
              ))}
              {listedCount > 3 && (
                <span className="rounded bg-surface px-2 py-0.5 text-xs text-muted-foreground">
                  +{listedCount - 3} more
                </span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor("highestTier", {
        header: "Severity",
        cell: (info) => {
          const tier = info.getValue();
          return (
            <StatusIndicatorDot
              status={
                tier === "critical" ? "critical" :
                tier === "high" ? "warning" : "ok"
              }
              label={tier.toUpperCase()}
            />
          );
        },
      }),
      columnHelper.accessor("blacklists", {
        id: "firstListed",
        header: "First Listed",
        cell: (info) => {
          const blacklists = info.getValue();
          const firstListed = blacklists
            .filter((b) => b.listed)
            .sort((a, b) => new Date(a.lastChecked).getTime() - new Date(b.lastChecked).getTime())[0];
          return firstListed ? (
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(firstListed.lastChecked), { addSuffix: true })}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          );
        },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const status = info.getValue();
          return (
            <span
              className={`rounded px-2 py-1 text-xs font-medium ${
                status === "paused"
                  ? "bg-status-warning/20 text-status-warning"
                  : status === "active"
                    ? "bg-status-ok/20 text-status-ok"
                    : "bg-surface text-muted-foreground"
              }`}
            >
              {status}
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
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-border bg-surface">
        <p className="text-sm text-muted-foreground">No blacklisted IPs found</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface">
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
              onClick={() =>
                navigate({ to: "/ip-reputation/$ip", params: { ip: row.original.ip } })
              }
              className="cursor-pointer border-b border-border transition-colors hover:bg-surface/80"
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
