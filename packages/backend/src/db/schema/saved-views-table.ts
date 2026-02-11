import { pgTable, text, timestamp, boolean, integer, serial, jsonb } from "drizzle-orm/pg-core";
import { dashboardUsers } from "./dashboard-users-table";

/** Saved dashboard views / custom layouts */
export const savedViews = pgTable("saved_views", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => dashboardUsers.id),
  name: text("name").notNull(),
  config: jsonb("config").notNull().$type<Record<string, unknown>>(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});
