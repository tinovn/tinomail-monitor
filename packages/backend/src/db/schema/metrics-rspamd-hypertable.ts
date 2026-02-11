import { pgTable, text, timestamp, bigint, index } from "drizzle-orm/pg-core";

/** Rspamd metrics — 30s interval */
export const metricsRspamd = pgTable(
  "metrics_rspamd",
  {
    time: timestamp("time", { withTimezone: true, mode: "date" }).notNull(),
    nodeId: text("node_id").notNull(),
    scanned: bigint("scanned", { mode: "number" }),
    ham: bigint("ham", { mode: "number" }),
    spam: bigint("spam", { mode: "number" }),
    greylist: bigint("greylist", { mode: "number" }),
    rejected: bigint("rejected", { mode: "number" }),
    learnedHam: bigint("learned_ham", { mode: "number" }),
    learnedSpam: bigint("learned_spam", { mode: "number" }),
  },
  (table) => [index("idx_metrics_rspamd_node").on(table.nodeId, table.time)],
);
