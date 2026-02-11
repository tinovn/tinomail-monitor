import { useState, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import type { EnrichedSendingIp } from "@tinomail/shared";
import { StatusIndicatorDot } from "@/components/shared/status-indicator-dot";
import { IpBulkActionToolbar } from "@/components/zonemta/ip-bulk-action-toolbar";
import { cn } from "@/lib/classname-utils";
import { formatDistanceToNow } from "date-fns";

const columnHelper = createColumnHelper<EnrichedSendingIp>();

interface NodeIpAddressTableTabProps {
  nodeId: string;
  ips: EnrichedSendingIp[];
}

export function NodeIpAddressTableTab({ ips }: NodeIpAddressTableTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="cursor-pointer"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="cursor-pointer"
          />
        ),
        size: 40,
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const status = info.getValue();
          const statusType =
            status === "active" ? "ok" :
            status === "paused" ? "warning" :
            status === "quarantine" ? "critical" : "muted";
          return <StatusIndicatorDot status={statusType} />;
        },
        size: 60,
      }),
      columnHelper.accessor("ip", {
        header: "IP Address",
        cell: (info) => (
          <span className="font-mono text-sm">{info.getValue()}</span>
        ),
        size: 140,
      }),
      columnHelper.accessor("ipVersion", {
        header: "v",
        cell: (info) => (
          <span className="text-xs text-muted-foreground">v{info.getValue()}</span>
        ),
        size: 30,
      }),
      columnHelper.accessor("sentLast1h", {
        header: "Sent 1h",
        cell: (info) => (
          <span className="text-sm">{(info.getValue() ?? 0).toLocaleString()}</span>
        ),
        size: 80,
      }),
      columnHelper.accessor("sentLast24h", {
        header: "Sent 24h",
        cell: (info) => (
          <span className="text-sm">{(info.getValue() ?? 0).toLocaleString()}</span>
        ),
        size: 90,
      }),
      columnHelper.accessor("bounceRate", {
        header: "Bounce %",
        cell: (info) => {
          const rate = info.getValue() ?? 0;
          return (
            <span
              className={cn(
                "text-sm font-medium",
                rate > 5 ? "text-status-warning" : "text-foreground"
              )}
            >
              {rate.toFixed(1)}%
            </span>
          );
        },
        size: 80,
      }),
      columnHelper.accessor("blacklists", {
        header: "Blacklists",
        cell: (info) => {
          const blacklists = info.getValue();
          return (
            <span
              className={cn(
                "text-sm",
                blacklists.length > 0 ? "text-status-critical font-medium" : "text-muted-foreground"
              )}
            >
              {blacklists.length > 0 ? blacklists.join(", ") : "—"}
            </span>
          );
        },
        size: 150,
      }),
      columnHelper.accessor("warmupDay", {
        header: "Warmup",
        cell: (info) => (
          <span className="text-sm">Day {info.getValue()}</span>
        ),
        size: 70,
      }),
      columnHelper.accessor("dailyLimit", {
        header: "Daily Limit",
        cell: (info) => {
          const limit = info.getValue();
          const sent = info.row.original.currentDailySent;
          return (
            <div className="text-sm">
              {sent}/{limit || "∞"}
            </div>
          );
        },
        size: 100,
      }),
      columnHelper.accessor("reputationScore", {
        header: "Reputation",
        cell: (info) => {
          const score = info.getValue();
          return (
            <div className="flex items-center gap-2">
              <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    score >= 70 ? "bg-status-ok" :
                    score >= 40 ? "bg-status-warning" : "bg-status-critical"
                  )}
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{score}</span>
            </div>
          );
        },
        size: 120,
      }),
      columnHelper.accessor("ptrRecord", {
        header: "PTR",
        cell: (info) => (
          <span className="text-xs text-muted-foreground">
            {info.getValue() || "—"}
          </span>
        ),
        size: 150,
      }),
      columnHelper.accessor("lastUsed", {
        header: "Last Used",
        cell: (info) => {
          const lastUsed = info.getValue();
          return lastUsed ? (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(lastUsed), { addSuffix: true })}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Never</span>
          );
        },
        size: 100,
      }),
    ],
    []
  );

  const filteredData = useMemo(() => {
    let filtered = ips;
    if (statusFilter !== "all") {
      filtered = filtered.filter((ip) => ip.status === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter((ip) =>
        ip.ip.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [ips, statusFilter, searchQuery]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const selectedIps = table.getSelectedRowModel().rows.map((row) => row.original.ip);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search IP..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2 rounded-md border border-border bg-surface text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-border bg-surface text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="quarantine">Quarantine</option>
          <option value="retired">Retired</option>
        </select>
        <div className="ml-auto text-sm text-muted-foreground">
          {filteredData.length} IPs
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIps.length > 0 && (
        <IpBulkActionToolbar
          selectedIps={selectedIps}
          onActionComplete={() => setRowSelection({})}
        />
      )}

      {/* Virtual Table */}
      <div
        ref={tableContainerRef}
        className="rounded-lg border border-border bg-surface overflow-auto"
        style={{ height: "600px" }}
      >
        <table className="w-full table-dense">
          <thead className="sticky top-0 bg-surface border-b border-border z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px` }} className="relative">
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="hover:bg-muted/30 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="text-sm"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
