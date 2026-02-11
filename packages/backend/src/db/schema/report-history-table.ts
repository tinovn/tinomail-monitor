import { pgTable, text, timestamp, serial, jsonb } from "drizzle-orm/pg-core";

/** History of generated reports */
export const reportHistory = pgTable("report_history", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // daily, weekly, monthly, ip-reputation
  generatedAt: timestamp("generated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  periodStart: timestamp("period_start", { withTimezone: true, mode: "date" }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true, mode: "date" }).notNull(),
  data: jsonb("data").notNull().$type<Record<string, unknown>>(),
  emailedTo: text("emailed_to").array(),
  createdBy: text("created_by"),
});
