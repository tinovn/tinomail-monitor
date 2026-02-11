import { pgTable, text, timestamp, integer, smallint, date, index } from "drizzle-orm/pg-core";

/** Sending IP registry — one row per outbound IP */
export const sendingIps = pgTable(
  "sending_ips",
  {
    ip: text("ip").primaryKey(),
    ipVersion: smallint("ip_version").notNull(),
    nodeId: text("node_id"),
    subnet: text("subnet"),
    ptrRecord: text("ptr_record"),
    status: text("status").default("active"),
    warmupStart: date("warmup_start"),
    warmupDay: integer("warmup_day").default(0),
    dailyLimit: integer("daily_limit"),
    currentDailySent: integer("current_daily_sent").default(0),
    blacklistCount: integer("blacklist_count").default(0),
    reputationScore: integer("reputation_score").default(50),
    lastBlacklistCheck: timestamp("last_blacklist_check", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
  },
  (table) => [
    index("idx_sending_ips_node").on(table.nodeId),
    index("idx_sending_ips_status").on(table.status),
    index("idx_sending_ips_subnet").on(table.subnet),
  ],
);
