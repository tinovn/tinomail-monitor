import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { apiClient } from "@/lib/api-http-client";
import { useTimeRangeStore } from "@/stores/global-time-range-store";
import { DataDenseTableWrapper } from "@/components/shared/data-dense-table-wrapper";
import { StatusIndicatorDot } from "@/components/shared/status-indicator-dot";
import { ProgressBarInlineWithLabel } from "@/components/shared/progress-bar-inline-with-label";
import { UptimeDisplayLabel } from "@/components/shared/uptime-display-label";
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

function mapNodeStatusToIndicator(
  status: string,
): "ok" | "warning" | "critical" | "muted" {
  switch (status) {
    case "active":
      return "ok";
    case "warning":
      return "warning";
    case "critical":
      return "critical";
    default:
      return "muted";
  }
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(1)} GB`;
}

export function OverviewNodeSummaryPulseTable() {
  const navigate = useNavigate();
  const autoRefresh = useTimeRangeStore((s) => s.autoRefresh);

  const { data: nodes = [], isLoading } = useQuery<NodeWithMetrics[]>({
    queryKey: ["nodes", "with-metrics"],
    queryFn: () => apiClient.get("/nodes/with-latest-metrics"),
    refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
  });

  const columns: ColumnDef<NodeWithMetrics>[] = [
    {
      accessorKey: "status",
      header: "",
      cell: ({ row }) => (
        <StatusIndicatorDot
          size="sm"
          status={mapNodeStatusToIndicator(row.original.status)}
        />
      ),
      size: 40,
    },
    {
      accessorKey: "hostname",
      header: "Node",
      cell: ({ row }) => (
        <span className="font-medium text-sm text-foreground">
          {row.original.hostname || row.original.ipAddress || row.original.id}
        </span>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">
          {row.original.role}
        </span>
      ),
    },
    {
      accessorKey: "registeredAt",
      header: "Uptime",
      cell: ({ row }) => (
        <UptimeDisplayLabel since={row.original.registeredAt} />
      ),
    },
    {
      accessorKey: "cpuPercent",
      header: "CPU",
      cell: ({ row }) => {
        const cpu = row.original.cpuPercent;
        if (cpu === null) return <span className="text-muted-foreground">—</span>;
        return <ProgressBarInlineWithLabel percent={cpu} width="w-24" />;
      },
    },
    {
      accessorKey: "ramPercent",
      header: "Memory",
      cell: ({ row }) => {
        const ram = row.original.ramPercent;
        const ramUsed = row.original.ramUsedBytes;
        if (ram === null)
          return <span className="text-muted-foreground">—</span>;
        return (
          <ProgressBarInlineWithLabel
            percent={ram}
            absoluteText={formatBytes(ramUsed)}
            width="w-24"
          />
        );
      },
    },
    {
      accessorKey: "diskPercent",
      header: "Disk",
      cell: ({ row }) => {
        const disk = row.original.diskPercent;
        if (disk === null)
          return <span className="text-muted-foreground">—</span>;
        return <ProgressBarInlineWithLabel percent={disk} width="w-24" />;
      },
    },
  ];

  const table = useReactTable({
    data: nodes,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <DataDenseTableWrapper>
        <thead>
          <tr>
            <th className="text-left"></th>
            <th className="text-left">Node</th>
            <th className="text-left">Role</th>
            <th className="text-left">Uptime</th>
            <th className="text-left">CPU</th>
            <th className="text-left">Memory</th>
            <th className="text-left">Disk</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td colSpan={7} className="text-center text-muted-foreground">
                Loading...
              </td>
            </tr>
          ))}
        </tbody>
      </DataDenseTableWrapper>
    );
  }

  return (
    <DataDenseTableWrapper>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id} className="text-left">
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
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
            className={cn("cursor-pointer hover:bg-muted/50 transition-colors")}
            onClick={() => navigate({ to: `/servers/${row.original.id}` })}
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
