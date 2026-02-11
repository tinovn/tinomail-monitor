import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** IP Pool registry — group IPs by purpose (transactional, marketing, etc.) */
export const ipPools = pgTable("ip_pools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // transactional, marketing, notification, etc.
  ips: text("ips").array().notNull().default([]),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
});
