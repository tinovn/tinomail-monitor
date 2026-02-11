import { pgView } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Email stats aggregated per day
 * TimescaleDB continuous aggregate from email_events
 * Most detailed dimensions for reporting: from_domain, from_user, to_domain, mta_node, sending_ip
 */
export const emailStatsDaily = pgView("email_stats_daily").as((qb) =>
  qb
    .select({
      bucket: sql<Date>`time_bucket('1 day', time)`.as("bucket"),
      fromDomain: sql<string>`from_domain`.as("from_domain"),
      fromUser: sql<string>`from_user`.as("from_user"),
      toDomain: sql<string>`to_domain`.as("to_domain"),
      mtaNode: sql<string>`mta_node`.as("mta_node"),
      sendingIp: sql<string>`sending_ip`.as("sending_ip"),
      eventType: sql<string>`event_type`.as("event_type"),
      eventCount: sql<number>`COUNT(*)`.as("event_count"),
      avgDeliveryMs: sql<number>`AVG(delivery_time_ms)`.as("avg_delivery_ms"),
    })
    .from(sql`email_events`)
    .groupBy(
      sql`time_bucket('1 day', time)`,
      sql`from_domain`,
      sql`from_user`,
      sql`to_domain`,
      sql`mta_node`,
      sql`sending_ip`,
      sql`event_type`
    )
);
