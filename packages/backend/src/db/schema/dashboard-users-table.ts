import { pgTable, text, timestamp, serial } from "drizzle-orm/pg-core";

/** Dashboard user accounts with RBAC */
export const dashboardUsers = pgTable("dashboard_users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").default("viewer"),
  telegramId: text("telegram_id"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});
