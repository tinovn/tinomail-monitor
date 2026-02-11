import { pgView } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Email stats aggregated per 5 minutes
 * TimescaleDB continuous aggregate from email_events
 */
export const emailStats5m = pgView("email_stats_5m").as((qb) =>
  qb
    .select({
      bucket: sql<Date>`time_bucket('5 minutes', time)`.as("bucket"),
      fromDomain: sql<string>`from_domain`.as("from_domain"),
      mtaNode: sql<string>`mta_node`.as("mta_node"),
      sendingIp: sql<string>`sending_ip`.as("sending_ip"),
      eventType: sql<string>`event_type`.as("event_type"),
      eventCount: sql<number>`COUNT(*)`.as("event_count"),
      avgDeliveryMs: sql<number>`AVG(delivery_time_ms)`.as("avg_delivery_ms"),
      p95DeliveryMs: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY delivery_time_ms)`.as("p95_delivery_ms"),
      avgMessageSize: sql<number>`AVG(message_size)`.as("avg_message_size"),
      dkimPass: sql<number>`SUM(CASE WHEN dkim_result = 'pass' THEN 1 ELSE 0 END)`.as("dkim_pass"),
      spfPass: sql<number>`SUM(CASE WHEN spf_result = 'pass' THEN 1 ELSE 0 END)`.as("spf_pass"),
      dmarcPass: sql<number>`SUM(CASE WHEN dmarc_result = 'pass' THEN 1 ELSE 0 END)`.as("dmarc_pass"),
    })
    .from(sql`email_events`)
    .groupBy(
      sql`time_bucket('5 minutes', time)`,
      sql`from_domain`,
      sql`mta_node`,
      sql`sending_ip`,
      sql`event_type`
    )
);
