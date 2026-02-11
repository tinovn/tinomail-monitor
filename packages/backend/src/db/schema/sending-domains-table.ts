import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

/** Sending domain configuration */
export const sendingDomains = pgTable("sending_domains", {
  domain: text("domain").primaryKey(),
  dkimConfigured: boolean("dkim_configured").default(false),
  spfConfigured: boolean("spf_configured").default(false),
  dmarcConfigured: boolean("dmarc_configured").default(false),
  dmarcPolicy: text("dmarc_policy"),
  status: text("status").default("active"),
  dailyLimit: integer("daily_limit"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});
