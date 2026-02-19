import type { FastifyInstance } from "fastify";
import { sql, and, gte, lte, eq, desc } from "drizzle-orm";
import { emailEvents } from "../db/schema/email-events-hypertable.js";

/** Maps frontend groupBy values to actual DB column names */
const GROUP_BY_COLUMN_MAP: Record<string, string> = {
  node: "mta_node",
  domain: "from_domain",
  event_type: "event_type",
};

export class EmailThroughputQueryService {
  constructor(private app: FastifyInstance) {}

  /**
   * Query email throughput with automatic resolution based on time range
   * <=12h -> 5min, 12h-7d -> 1h, >7d -> daily
   * Falls back to finer aggregates if coarser one is empty
   */
  async getThroughput(params: {
    from: Date;
    to: Date;
    groupBy?: "node" | "domain" | "event_type";
  }) {
    const fromIso = params.from.toISOString();
    const toIso = params.to.toISOString();
    const rangeHours = (params.to.getTime() - params.from.getTime()) / (1000 * 60 * 60);

    let result;
    if (rangeHours <= 12) {
      // <=12h: use 5m aggregate for near-realtime data (1h aggregate lags by up to 1 hour)
      result = await this.queryAggregate5m(fromIso, toIso, params.groupBy);
    } else if (rangeHours <= 168) {
      result = await this.queryAggregate1h(fromIso, toIso, params.groupBy);
      // Fall back to 5m aggregate if 1h is empty (data too recent to materialize)
      if (result.length === 0) {
        result = await this.queryAggregate5m(fromIso, toIso, params.groupBy);
      }
    } else {
      result = await this.queryAggregateDaily(fromIso, toIso, params.groupBy);
      // Fall back through aggregates if empty
      if (result.length === 0) {
        result = await this.queryAggregate1h(fromIso, toIso, params.groupBy);
      }
      if (result.length === 0) {
        result = await this.queryAggregate5m(fromIso, toIso, params.groupBy);
      }
    }
    return result;
  }

  /** Get email stats grouped by dimension */
  async getStats(params: {
    from: Date;
    to: Date;
    groupBy: "from_domain" | "to_domain" | "mta_node" | "event_type";
  }) {
    const groupColumn = this.mapGroupByColumn(params.groupBy);

    return this.app.db
      .select({
        group: sql`${groupColumn}`,
        count: sql<number>`COUNT(*)`,
        avgDeliveryTime: sql<number>`AVG(${emailEvents.deliveryTimeMs})`,
        bounceRate: sql<number>`
          (COUNT(*) FILTER (WHERE ${emailEvents.eventType} = 'bounced')::float /
           NULLIF(COUNT(*), 0) * 100)
        `,
      })
      .from(emailEvents)
      .where(and(gte(emailEvents.time, params.from), lte(emailEvents.time, params.to)))
      .groupBy(sql`${groupColumn}`)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(100);
  }

  /** Bounce analysis: breakdown by bounce type and category */
  async getBounceAnalysis(params: { from: Date; to: Date }) {
    return this.app.db
      .select({
        bounceType: emailEvents.bounceType,
        bounceCategory: emailEvents.bounceCategory,
        count: sql<number>`COUNT(*)`,
        percentage: sql<number>`
          (COUNT(*)::float / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100)
        `,
      })
      .from(emailEvents)
      .where(
        and(
          gte(emailEvents.time, params.from),
          lte(emailEvents.time, params.to),
          eq(emailEvents.eventType, "bounced"),
        ),
      )
      .groupBy(emailEvents.bounceType, emailEvents.bounceCategory)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(50);
  }

  // --- Aggregate queries using app.sql (postgres.js tagged templates) ---
  // Each groupBy variant is a separate query to avoid dynamic SQL identifier issues

  private async queryAggregate5m(fromIso: string, toIso: string, groupBy?: string) {
    const col = groupBy ? GROUP_BY_COLUMN_MAP[groupBy] : null;
    if (col === "mta_node") {
      return this.app.sql`
        SELECT bucket AS time, event_type, mta_node AS group_value,
          SUM(event_count)::int AS count, AVG(avg_delivery_ms) AS avg_delivery_ms
        FROM email_stats_5m
        WHERE bucket >= ${fromIso}::timestamptz AND bucket <= ${toIso}::timestamptz
        GROUP BY bucket, event_type, mta_node ORDER BY bucket ASC`;
    }
    if (col === "from_domain") {
      return this.app.sql`
        SELECT bucket AS time, event_type, from_domain AS group_value,
          SUM(event_count)::int AS count, AVG(avg_delivery_ms) AS avg_delivery_ms
        FROM email_stats_5m
        WHERE bucket >= ${fromIso}::timestamptz AND bucket <= ${toIso}::timestamptz
        GROUP BY bucket, event_type, from_domain ORDER BY bucket ASC`;
    }
    return this.app.sql`
      SELECT bucket AS time, event_type,
        SUM(event_count)::int AS count, AVG(avg_delivery_ms) AS avg_delivery_ms
      FROM email_stats_5m
      WHERE bucket >= ${fromIso}::timestamptz AND bucket <= ${toIso}::timestamptz
      GROUP BY bucket, event_type ORDER BY bucket ASC`;
  }

  private async queryAggregate1h(fromIso: string, toIso: string, groupBy?: string) {
    const col = groupBy ? GROUP_BY_COLUMN_MAP[groupBy] : null;
    if (col === "mta_node") {
      return this.app.sql`
        SELECT bucket AS time, event_type, mta_node AS group_value,
          SUM(event_count)::int AS count, AVG(avg_delivery_ms) AS avg_delivery_ms
        FROM email_stats_1h
        WHERE bucket >= ${fromIso}::timestamptz AND bucket <= ${toIso}::timestamptz
        GROUP BY bucket, event_type, mta_node ORDER BY bucket ASC`;
    }
    if (col === "from_domain") {
      return this.app.sql`
        SELECT bucket AS time, event_type, from_domain AS group_value,
          SUM(event_count)::int AS count, AVG(avg_delivery_ms) AS avg_delivery_ms
        FROM email_stats_1h
        WHERE bucket >= ${fromIso}::timestamptz AND bucket <= ${toIso}::timestamptz
        GROUP BY bucket, event_type, from_domain ORDER BY bucket ASC`;
    }
    return this.app.sql`
      SELECT bucket AS time, event_type,
        SUM(event_count)::int AS count, AVG(avg_delivery_ms) AS avg_delivery_ms
      FROM email_stats_1h
      WHERE bucket >= ${fromIso}::timestamptz AND bucket <= ${toIso}::timestamptz
      GROUP BY bucket, event_type ORDER BY bucket ASC`;
  }

  private async queryAggregateDaily(fromIso: string, toIso: string, groupBy?: string) {
    const col = groupBy ? GROUP_BY_COLUMN_MAP[groupBy] : null;
    if (col === "mta_node") {
      return this.app.sql`
        SELECT bucket AS time, event_type, mta_node AS group_value,
          SUM(event_count)::int AS count, AVG(avg_delivery_ms) AS avg_delivery_ms
        FROM email_stats_daily
        WHERE bucket >= ${fromIso}::timestamptz AND bucket <= ${toIso}::timestamptz
        GROUP BY bucket, event_type, mta_node ORDER BY bucket ASC`;
    }
    if (col === "from_domain") {
      return this.app.sql`
        SELECT bucket AS time, event_type, from_domain AS group_value,
          SUM(event_count)::int AS count, AVG(avg_delivery_ms) AS avg_delivery_ms
        FROM email_stats_daily
        WHERE bucket >= ${fromIso}::timestamptz AND bucket <= ${toIso}::timestamptz
        GROUP BY bucket, event_type, from_domain ORDER BY bucket ASC`;
    }
    return this.app.sql`
      SELECT bucket AS time, event_type,
        SUM(event_count)::int AS count, AVG(avg_delivery_ms) AS avg_delivery_ms
      FROM email_stats_daily
      WHERE bucket >= ${fromIso}::timestamptz AND bucket <= ${toIso}::timestamptz
      GROUP BY bucket, event_type ORDER BY bucket ASC`;
  }

  private mapGroupByColumn(groupBy: string) {
    const mapping: Record<string, any> = {
      from_domain: emailEvents.fromDomain,
      to_domain: emailEvents.toDomain,
      mta_node: emailEvents.mtaNode,
      event_type: emailEvents.eventType,
    };
    return mapping[groupBy] || emailEvents.eventType;
  }
}
