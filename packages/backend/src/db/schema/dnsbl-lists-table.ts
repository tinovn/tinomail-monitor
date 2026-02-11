import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

/** DNSBL provider registry */
export const dnsblLists = pgTable(
  "dnsbl_lists",
  {
    blacklist: text("blacklist").primaryKey(),
    tier: text("tier").notNull(), // critical, high, medium
    description: text("description").notNull(),
    enabled: boolean("enabled").default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
  },
  (table) => [index("idx_dnsbl_tier").on(table.tier)],
);
