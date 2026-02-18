import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

/** MongoDB replica set events — detected role transitions between collection cycles */
export const mongodbReplEvents = pgTable(
  "mongodb_repl_events",
  {
    time: timestamp("time", { withTimezone: true, mode: "date" }).notNull(),
    nodeId: text("node_id").notNull(),
    eventType: text("event_type").notNull(), // election, step_down, step_up, member_unreachable, member_recovered
    oldRole: text("old_role"),
    newRole: text("new_role"),
    details: jsonb("details"),
  },
  (table) => [index("idx_mongodb_repl_events_node").on(table.nodeId, table.time)],
);
