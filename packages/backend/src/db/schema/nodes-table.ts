import { pgTable, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

/** Node registry — agents self-register on startup */
export const nodes = pgTable("nodes", {
  id: text("id").primaryKey(),
  hostname: text("hostname"),
  ipAddress: text("ip_address"),
  role: text("role").notNull(),
  status: text("status").default("active"),
  registeredAt: timestamp("registered_at", { withTimezone: true, mode: "date" }).defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true, mode: "date" }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  agentVersion: text("agent_version"),
  updateRequested: boolean("update_requested").default(false),
});
