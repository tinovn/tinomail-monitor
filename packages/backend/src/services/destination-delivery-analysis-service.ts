import type { FastifyInstance } from "fastify";

interface DestinationStats {
  toDomain: string;
  totalSent: number;
  delivered: number;
  bounced: number;
  deliveredPercent: number;
  bouncePercent: number;
  avgDeliveryMs: number;
}

interface DestinationDetail extends DestinationStats {
  ipBreakdown: {
    sendingIp: string;
    sent: number;
    delivered: number;
    bounced: number;
  }[];
  bounceReasons: {
    category: string;
    count: number;
  }[];
  smtpResponseCodes: {
    code: number;
    count: number;
  }[];
}

interface DeliveryHeatmapData {
  hour: number;
  weekday: number;
  deliveredPercent: number;
  totalSent: number;
}

export class DestinationDeliveryAnalysisService {
  constructor(private app: FastifyInstance) {}

  /**
   * Get top destination domains with delivery stats
   */
  async getTopDestinations(from: Date, to: Date, limit: number = 50): Promise<DestinationStats[]> {
    const result = await this.app.sql`
      SELECT
        to_domain,
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE event_type = 'accepted' OR event_type = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced,
        AVG(delivery_time_ms) as avg_delivery_ms
      FROM email_events
      WHERE time >= ${from.toISOString()}::timestamptz
        AND time < ${to.toISOString()}::timestamptz
        AND to_domain IS NOT NULL
      GROUP BY to_domain
      ORDER BY total_sent DESC
      LIMIT ${limit}
    `;

    return result.map((row: any) => {
      const totalSent = parseInt(row.total_sent || "0", 10);
      const delivered = parseInt(row.delivered || "0", 10);
      const bounced = parseInt(row.bounced || "0", 10);

      return {
        toDomain: row.to_domain,
        totalSent,
        delivered,
        bounced,
        deliveredPercent: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
        bouncePercent: totalSent > 0 ? (bounced / totalSent) * 100 : 0,
        avgDeliveryMs: parseFloat(row.avg_delivery_ms || "0"),
      };
    });
  }

  /**
   * Get detailed stats for specific destination domain
   */
  async getDestinationDetail(domain: string, from: Date, to: Date): Promise<DestinationDetail | null> {
    // Base stats
    const [statsRow] = await this.app.sql`
      SELECT
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE event_type = 'accepted' OR event_type = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced,
        AVG(delivery_time_ms) as avg_delivery_ms
      FROM email_events
      WHERE to_domain = ${domain}
        AND time >= ${from.toISOString()}::timestamptz
        AND time < ${to.toISOString()}::timestamptz
    `;
    const totalSent = parseInt(statsRow.total_sent || "0", 10);

    if (totalSent === 0) return null;

    const delivered = parseInt(statsRow.delivered || "0", 10);
    const bounced = parseInt(statsRow.bounced || "0", 10);

    // Per-IP breakdown
    const ipResult = await this.app.sql`
      SELECT
        sending_ip,
        COUNT(*) as sent,
        COUNT(*) FILTER (WHERE event_type = 'accepted' OR event_type = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced
      FROM email_events
      WHERE to_domain = ${domain}
        AND time >= ${from.toISOString()}::timestamptz
        AND time < ${to.toISOString()}::timestamptz
        AND sending_ip IS NOT NULL
      GROUP BY sending_ip
      ORDER BY sent DESC
      LIMIT 20
    `;

    const ipBreakdown = ipResult.map((row: any) => ({
      sendingIp: row.sending_ip,
      sent: parseInt(row.sent || "0", 10),
      delivered: parseInt(row.delivered || "0", 10),
      bounced: parseInt(row.bounced || "0", 10),
    }));

    // Bounce reasons
    const bounceResult = await this.app.sql`
      SELECT
        COALESCE(bounce_category, 'unknown') as category,
        COUNT(*) as count
      FROM email_events
      WHERE to_domain = ${domain}
        AND time >= ${from.toISOString()}::timestamptz
        AND time < ${to.toISOString()}::timestamptz
        AND event_type = 'bounced'
      GROUP BY bounce_category
      ORDER BY count DESC
      LIMIT 10
    `;

    const bounceReasons = bounceResult.map((row: any) => ({
      category: row.category,
      count: parseInt(row.count || "0", 10),
    }));

    // SMTP response codes
    const smtpResult = await this.app.sql`
      SELECT
        status_code as code,
        COUNT(*) as count
      FROM email_events
      WHERE to_domain = ${domain}
        AND time >= ${from.toISOString()}::timestamptz
        AND time < ${to.toISOString()}::timestamptz
        AND status_code IS NOT NULL
      GROUP BY status_code
      ORDER BY count DESC
      LIMIT 10
    `;

    const smtpResponseCodes = smtpResult.map((row: any) => ({
      code: parseInt(row.code || "0", 10),
      count: parseInt(row.count || "0", 10),
    }));

    return {
      toDomain: domain,
      totalSent,
      delivered,
      bounced,
      deliveredPercent: (delivered / totalSent) * 100,
      bouncePercent: (bounced / totalSent) * 100,
      avgDeliveryMs: parseFloat(statsRow.avg_delivery_ms || "0"),
      ipBreakdown,
      bounceReasons,
      smtpResponseCodes,
    };
  }

  /**
   * Get delivery heatmap - best sending window (hour × weekday)
   */
  async getDeliveryHeatmap(from: Date, to: Date): Promise<DeliveryHeatmapData[]> {
    const result = await this.app.sql`
      SELECT
        EXTRACT(HOUR FROM time) as hour,
        EXTRACT(DOW FROM time) as weekday,
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE event_type = 'accepted' OR event_type = 'delivered') as delivered
      FROM email_events
      WHERE time >= ${from.toISOString()}::timestamptz
        AND time < ${to.toISOString()}::timestamptz
      GROUP BY hour, weekday
      ORDER BY weekday, hour
    `;

    return result.map((row: any) => {
      const totalSent = parseInt(row.total_sent || "0", 10);
      const delivered = parseInt(row.delivered || "0", 10);

      return {
        hour: parseInt(row.hour || "0", 10),
        weekday: parseInt(row.weekday || "0", 10),
        totalSent,
        deliveredPercent: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
      };
    });
  }
}
