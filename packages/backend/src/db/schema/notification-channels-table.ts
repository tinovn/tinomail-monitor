import {
  pgTable, text, timestamp, boolean, serial, jsonb,
} from "drizzle-orm/pg-core";

/** Notification channel configurations (Telegram, Slack, Email, Webhook, InApp) */
export const notificationChannels = pgTable("notification_channels", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // telegram, slack, email, webhook, inapp
  name: text("name").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull(), // channel-specific config
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});
