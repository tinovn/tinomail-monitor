import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

/** System-wide configuration settings */
export const systemSettings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().$type<Record<string, unknown>>(),
  category: text("category").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
  updatedBy: text("updated_by"),
});
