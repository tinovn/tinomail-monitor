import { pgView } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Email stats aggregated per 1 hour
 * TimescaleDB continuous aggregate from email_events
 * Includes to_domain for destination analysis
 */
export const emailStats1h = pgView("email_stats_1h").as((qb) =>
  qb
    .select({
      bucket: sql<Date>`time_bucket('1 hour', time)`.as("bucket"),
      fromDomain: sql<string>`from_domain`.as("from_domain"),
      toDomain: sql<string>`to_domain`.as("to_domain"),
      mtaNode: sql<string>`mta_node`.as("mta_node"),
      eventType: sql<string>`event_type`.as("event_type"),
      eventCount: sql<number>`COUNT(*)`.as("event_count"),
      avgDeliveryMs: sql<number>`AVG(delivery_time_ms)`.as("avg_delivery_ms"),
      p95DeliveryMs: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY delivery_time_ms)`.as("p95_delivery_ms"),
    })
    .from(sql`email_events`)
    .groupBy(
      sql`time_bucket('1 hour', time)`,
      sql`from_domain`,
      sql`to_domain`,
      sql`mta_node`,
      sql`event_type`
    )
);
