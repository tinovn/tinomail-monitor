import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

/** Auth events — tracks authentication attempts across all nodes */
export const authEvents = pgTable(
  "auth_events",
  {
    time: timestamp("time", { withTimezone: true, mode: "date" }).notNull(),
    nodeId: text("node_id").notNull(),
    username: text("username").notNull(),
    sourceIp: text("source_ip").notNull(),
    success: boolean("success").notNull(),
    failureReason: text("failure_reason"),
  },
  (table) => [
    index("idx_auth_events_source_ip").on(table.sourceIp, table.time),
    index("idx_auth_events_username").on(table.username, table.time),
    index("idx_auth_events_node").on(table.nodeId, table.time),
  ],
);
