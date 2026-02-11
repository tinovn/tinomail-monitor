import {
  pgTable, text, timestamp, boolean, integer, serial, jsonb,
} from "drizzle-orm/pg-core";
import { alertRules } from "./alert-rules-table";

/** Alert event history — fired/resolved events */
export const alertEvents = pgTable("alert_events", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").references(() => alertRules.id),
  severity: text("severity"),
  status: text("status"),
  message: text("message"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  nodeId: text("node_id"),
  firedAt: timestamp("fired_at", { withTimezone: true, mode: "date" }).defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
  notified: boolean("notified").default(false),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true, mode: "date" }),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true, mode: "date" }),
  escalationLevel: integer("escalation_level").default(0),
});
