import { pgTable, text, timestamp, doublePrecision, bigint, integer, index } from "drizzle-orm/pg-core";

/** ZoneMTA metrics — 15s interval */
export const metricsZonemta = pgTable(
  "metrics_zonemta",
  {
    time: timestamp("time", { withTimezone: true, mode: "date" }).notNull(),
    nodeId: text("node_id").notNull(),
    mtaRole: text("mta_role"),
    queueSize: integer("queue_size"),
    activeDeliveries: integer("active_deliveries"),
    sentTotal: bigint("sent_total", { mode: "number" }),
    deliveredTotal: bigint("delivered_total", { mode: "number" }),
    bouncedTotal: bigint("bounced_total", { mode: "number" }),
    deferredTotal: bigint("deferred_total", { mode: "number" }),
    rejectedTotal: bigint("rejected_total", { mode: "number" }),
    connectionsActive: integer("connections_active"),
    throughputPerSec: doublePrecision("throughput_per_sec"),
  },
  (table) => [index("idx_metrics_zonemta_node").on(table.nodeId, table.time)],
);
