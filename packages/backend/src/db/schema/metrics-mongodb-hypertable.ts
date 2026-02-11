import { pgTable, text, timestamp, doublePrecision, bigint, integer, index } from "drizzle-orm/pg-core";

/** MongoDB metrics — 30s interval */
export const metricsMongodb = pgTable(
  "metrics_mongodb",
  {
    time: timestamp("time", { withTimezone: true, mode: "date" }).notNull(),
    nodeId: text("node_id").notNull(),
    role: text("role"),
    connectionsCurrent: integer("connections_current"),
    connectionsAvailable: integer("connections_available"),
    opsInsert: bigint("ops_insert", { mode: "number" }),
    opsQuery: bigint("ops_query", { mode: "number" }),
    opsUpdate: bigint("ops_update", { mode: "number" }),
    opsDelete: bigint("ops_delete", { mode: "number" }),
    opsCommand: bigint("ops_command", { mode: "number" }),
    replLagSeconds: doublePrecision("repl_lag_seconds"),
    dataSizeBytes: bigint("data_size_bytes", { mode: "number" }),
    indexSizeBytes: bigint("index_size_bytes", { mode: "number" }),
    storageSizeBytes: bigint("storage_size_bytes", { mode: "number" }),
    oplogWindowHours: doublePrecision("oplog_window_hours"),
    wtCacheUsedBytes: bigint("wt_cache_used_bytes", { mode: "number" }),
    wtCacheMaxBytes: bigint("wt_cache_max_bytes", { mode: "number" }),
  },
  (table) => [index("idx_metrics_mongodb_node").on(table.nodeId, table.time)],
);
