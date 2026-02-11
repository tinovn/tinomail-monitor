import type { FastifyInstance } from "fastify";
import { sql, and, gte, lte } from "drizzle-orm";
import { emailEvents } from "../db/schema/email-events-hypertable.js";

export class TlsMonitoringQueryService {
  constructor(private app: FastifyInstance) {}

  /**
   * Get TLS usage summary
   * Currently simplified: uses delivery success as proxy for TLS usage
   * In production, TLS info should be captured in email_events or separate table
   * Cached 5min
   */
  async getTlsSummary(from: Date, to: Date) {
    const cacheKey = `tls:summary:${from.getTime()}:${to.getTime()}`;
    const cached = await this.app.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.app.db
      .select({
        totalEmails: sql<number>`COUNT(*)`,
        deliveredEmails: sql<number>`COUNT(*) FILTER (WHERE ${emailEvents.eventType} = 'delivered')`,
        // Proxy: delivered emails likely used TLS
        estimatedTlsCount: sql<number>`COUNT(*) FILTER (WHERE ${emailEvents.eventType} = 'delivered')`,
      })
      .from(emailEvents)
      .where(and(gte(emailEvents.time, from), lte(emailEvents.time, to)));

    const summary = result[0] || {
      totalEmails: 0,
      deliveredEmails: 0,
      estimatedTlsCount: 0,
    };

    await this.app.redis.setex(cacheKey, 300, JSON.stringify(summary));
    return summary;
  }

  /**
   * Get TLS version distribution
   * Returns mock structure for now - requires TLS version field in email_events
   * Cached 5min
   */
  async getTlsVersionDistribution(from: Date, to: Date) {
    const cacheKey = `tls:versions:${from.getTime()}:${to.getTime()}`;
    const cached = await this.app.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Mock data structure - in production, would query actual TLS version field
    const mockDistribution = [
      { version: "TLS 1.3", count: 0, percentage: 0 },
      { version: "TLS 1.2", count: 0, percentage: 0 },
      { version: "TLS 1.1", count: 0, percentage: 0 },
      { version: "No TLS", count: 0, percentage: 0 },
    ];

    await this.app.redis.setex(cacheKey, 300, JSON.stringify(mockDistribution));
    return mockDistribution;
  }
}
