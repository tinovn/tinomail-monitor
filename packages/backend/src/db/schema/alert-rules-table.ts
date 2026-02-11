import {
  pgTable, text, timestamp, doublePrecision, boolean, serial,
} from "drizzle-orm/pg-core";

/** Alert rule definitions */
export const alertRules = pgTable("alert_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  severity: text("severity").notNull(),
  condition: text("condition").notNull(),
  threshold: doublePrecision("threshold"),
  duration: text("duration"),
  channels: text("channels").array(),
  enabled: boolean("enabled").default(true),
  cooldown: text("cooldown").default("30 minutes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});
