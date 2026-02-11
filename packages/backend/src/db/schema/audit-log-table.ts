import { pgTable, text, timestamp, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { dashboardUsers } from "./dashboard-users-table";

/** Audit log for tracking user actions */
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  userId: integer("user_id").references(() => dashboardUsers.id),
  username: text("username").notNull(),
  action: text("action").notNull(), // create, update, delete
  resource: text("resource").notNull(), // node, ip, rule, user, setting
  resourceId: text("resource_id"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  ipAddress: text("ip_address"),
});
