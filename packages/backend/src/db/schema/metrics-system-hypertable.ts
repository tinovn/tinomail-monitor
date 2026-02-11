import { pgTable, text, timestamp, doublePrecision, bigint, integer, index } from "drizzle-orm/pg-core";

/** System metrics — 15s interval from each node */
export const metricsSystem = pgTable(
  "metrics_system",
  {
    time: timestamp("time", { withTimezone: true, mode: "date" }).notNull(),
    nodeId: text("node_id").notNull(),
    nodeRole: text("node_role").notNull(),
    cpuPercent: doublePrecision("cpu_percent"),
    ramPercent: doublePrecision("ram_percent"),
    ramUsedBytes: bigint("ram_used_bytes", { mode: "number" }),
    diskPercent: doublePrecision("disk_percent"),
    diskFreeBytes: bigint("disk_free_bytes", { mode: "number" }),
    diskReadBytesSec: bigint("disk_read_bytes_sec", { mode: "number" }),
    diskWriteBytesSec: bigint("disk_write_bytes_sec", { mode: "number" }),
    netRxBytesSec: bigint("net_rx_bytes_sec", { mode: "number" }),
    netTxBytesSec: bigint("net_tx_bytes_sec", { mode: "number" }),
    netRxErrors: bigint("net_rx_errors", { mode: "number" }),
    netTxErrors: bigint("net_tx_errors", { mode: "number" }),
    load1m: doublePrecision("load_1m"),
    load5m: doublePrecision("load_5m"),
    load15m: doublePrecision("load_15m"),
    tcpEstablished: integer("tcp_established"),
    tcpTimeWait: integer("tcp_time_wait"),
    openFiles: integer("open_files"),
  },
  (table) => [index("idx_metrics_system_node").on(table.nodeId, table.time)],
);
