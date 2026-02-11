import {
  pgTable, text, timestamp, boolean, smallint, integer, index,
} from "drizzle-orm/pg-core";

/** DNSBL check results — 5min interval per IP per blacklist */
export const blacklistChecks = pgTable(
  "blacklist_checks",
  {
    time: timestamp("time", { withTimezone: true, mode: "date" }).notNull(),
    ip: text("ip").notNull(),
    ipVersion: smallint("ip_version"),
    nodeId: text("node_id"),
    blacklist: text("blacklist").notNull(),
    tier: text("tier"),
    listed: boolean("listed").notNull(),
    response: text("response"),
    checkDurationMs: integer("check_duration_ms"),
  },
  (table) => [index("idx_bl_ip").on(table.ip, table.time)],
);
