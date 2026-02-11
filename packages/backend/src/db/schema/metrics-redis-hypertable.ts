import { pgTable, text, timestamp, doublePrecision, bigint, integer, index } from "drizzle-orm/pg-core";

/** Redis metrics — 30s interval */
export const metricsRedis = pgTable(
  "metrics_redis",
  {
    time: timestamp("time", { withTimezone: true, mode: "date" }).notNull(),
    nodeId: text("node_id").notNull(),
    memoryUsedBytes: bigint("memory_used_bytes", { mode: "number" }),
    memoryMaxBytes: bigint("memory_max_bytes", { mode: "number" }),
    connectedClients: integer("connected_clients"),
    opsPerSec: integer("ops_per_sec"),
    hitRate: doublePrecision("hit_rate"),
    evictedKeys: bigint("evicted_keys", { mode: "number" }),
    totalKeys: integer("total_keys"),
  },
  (table) => [index("idx_metrics_redis_node").on(table.nodeId, table.time)],
);
