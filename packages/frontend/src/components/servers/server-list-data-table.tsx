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
import { StatusIndicatorDot } from "@/components/shared/status-indicator-dot";
import { ProgressBarInlineWithLabel } from "@/components/shared/progress-bar-inline-with-label";
import { UptimeDisplayLabel } from "@/components/shared/uptime-display-label";
import { DataDenseTableWrapper } from "@/components/shared/data-dense-table-wrapper";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/classname-utils";

interface NodeWithMetrics {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  role: string;
  status: string;
  registeredAt: string;
  lastSeen: string | null;
  metadata: Record<string, unknown> | null;
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
  ramUsedBytes: number | null;
  diskFreeBytes: number | null;
  load1m: number | null;
}

const columnHelper = createColumnHelper<NodeWithMetrics>();

interface ServerListDataTableProps {
  nodes: NodeWithMetrics[];
  sorting: SortingState;
  onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(1)} GB`;
}

export function ServerListDataTable({
  nodes,
  sorting,
  onSortingChange,
}: ServerListDataTableProps) {
  const navigate = useNavigate();

  const columns = useMemo(
    () => [
      columnHelper.accessor("status", {
        header: "",
        cell: (info) => {
          const status = info.getValue();
          const statusType =
            status === "active" ? "ok" :
            status === "warning" ? "warning" :
            status === "critical" ? "critical" : "muted";
          return <StatusIndicatorDot status={statusType} size="sm" />;
        },
        enableSorting: true,
      }),
      columnHelper.accessor("id", {
        header: "Node ID",
        cell: (info) => (
          <span className="font-mono text-sm text-foreground">{info.getValue().slice(0, 8)}</span>
        ),
        enableSorting: true,
      }),
      columnHelper.accessor("role", {
        header: "Role",
        cell: (info) => (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">
            {info.getValue()}
          </span>
        ),
        enableSorting: true,
      }),
      columnHelper.accessor("ipAddress", {
        header: "IP Address",
        cell: (info) => (
          <span className="font-mono text-sm text-foreground">{info.getValue() || "—"}</span>
        ),
        enableSorting: true,
      }),
      columnHelper.accessor("hostname", {
        header: "Hostname",
        cell: (info) => (
          <span className="text-sm text-foreground">{info.getValue() || "—"}</span>
        ),
        enableSorting: true,
      }),
      columnHelper.accessor("registeredAt", {
        header: "Uptime",
        cell: (info) => <UptimeDisplayLabel since={info.getValue()} />,
        enableSorting: true,
      }),
      columnHelper.accessor("cpuPercent", {
        header: "CPU",
        cell: (info) => {
          const cpu = info.getValue();
          if (cpu === null) return <span className="text-muted-foreground">—</span>;
          return <ProgressBarInlineWithLabel percent={cpu} width="w-24" />;
        },
        enableSorting: true,
      }),
      columnHelper.accessor("ramPercent", {
        header: "Memory",
        cell: (info) => {
          const ram = info.getValue();
          const ramUsed = info.row.original.ramUsedBytes;
          if (ram === null) return <span className="text-muted-foreground">—</span>;
          return (
            <ProgressBarInlineWithLabel
              percent={ram}
              absoluteText={formatBytes(ramUsed)}
              width="w-24"
            />
          );
        },
        enableSorting: true,
      }),
      columnHelper.accessor("diskPercent", {
        header: "Disk",
        cell: (info) => {
          const disk = info.getValue();
          if (disk === null) return <span className="text-muted-foreground">—</span>;
          return <ProgressBarInlineWithLabel percent={disk} width="w-24" />;
        },
        enableSorting: true,
      }),
      columnHelper.accessor("lastSeen", {
        header: "Last Seen",
        cell: (info) => {
          const lastSeen = info.getValue();
          return lastSeen ? (
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Never</span>
          );
        },
        enableSorting: true,
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: nodes,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <DataDenseTableWrapper>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                className={cn(
                  "text-left",
                  header.column.getCanSort() && "cursor-pointer hover:text-foreground",
                )}
                onClick={header.column.getToggleSortingHandler()}
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
              navigate({ to: "/servers/$nodeId", params: { nodeId: row.original.id } })
            }
            className="cursor-pointer hover:bg-muted/50 transition-colors"
          >
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </DataDenseTableWrapper>
  );
}
