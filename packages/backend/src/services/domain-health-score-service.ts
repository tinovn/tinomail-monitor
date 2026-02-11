import type { FastifyInstance } from "fastify";
import { sendingDomains } from "../db/schema/sending-domains-table.js";
import type { SendingDomain } from "@tinomail/shared";

interface DomainHealthMetrics {
  domain: string;
  totalSent: number;
  delivered: number;
  bounced: number;
  hardBounced: number;
  dkimPass: number;
  spfPass: number;
  dmarcPass: number;
  avgDeliveryMs: number;
}

interface DomainWithHealthScore extends SendingDomain {
  healthScore: number;
  sent24h: number;
  deliveredPercent: number;
  bouncePercent: number;
}

export class DomainHealthScoreService {
  constructor(private app: FastifyInstance) {}

  /**
   * Calculate domain health score (0-100)
   * Deductions:
   * - Bounce rate >5%: -20
   * - Hard bounce >2%: -15
   * - DKIM pass <99%: -10
   * - SPF pass <99%: -10
   * - DMARC pass <99%: -10
   * - Slow delivery (>3s avg): -5
   */
  private calculateHealthScore(metrics: DomainHealthMetrics): number {
    let score = 100;

    if (metrics.totalSent === 0) return 100; // No data, assume healthy

    const bounceRate = (metrics.bounced / metrics.totalSent) * 100;
    const hardBounceRate = (metrics.hardBounced / metrics.totalSent) * 100;
    const dkimPassRate = (metrics.dkimPass / metrics.totalSent) * 100;
    const spfPassRate = (metrics.spfPass / metrics.totalSent) * 100;
    const dmarcPassRate = (metrics.dmarcPass / metrics.totalSent) * 100;

    // Bounce rate deduction
    if (bounceRate > 5) score -= 20;

    // Hard bounce deduction
    if (hardBounceRate > 2) score -= 15;

    // Auth deductions
    if (dkimPassRate < 99) score -= 10;
    if (spfPassRate < 99) score -= 10;
    if (dmarcPassRate < 99) score -= 10;

    // Slow delivery deduction
    if (metrics.avgDeliveryMs > 3000) score -= 5;

    return Math.max(0, score);
  }

  /**
   * Get all domains with health scores
   */
  async getDomainsWithHealthScores(): Promise<DomainWithHealthScore[]> {
    // Check cache first
    const cacheKey = "domains:health:all";
    const cached = await this.app.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get all domains
    const domains = await this.app.db.select().from(sendingDomains);

    // Get metrics for last 24h for each domain
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const domainsWithScores = await Promise.all(
      domains.map(async (domain) => {
        const metrics = await this.getDomainMetrics(domain.domain, yesterday, now);
        const healthScore = this.calculateHealthScore(metrics);
        const deliveredPercent = metrics.totalSent > 0 ? (metrics.delivered / metrics.totalSent) * 100 : 0;
        const bouncePercent = metrics.totalSent > 0 ? (metrics.bounced / metrics.totalSent) * 100 : 0;

        return {
          ...domain,
          healthScore,
          sent24h: metrics.totalSent,
          deliveredPercent,
          bouncePercent,
        } as DomainWithHealthScore;
      })
    );

    // Cache for 5 minutes
    await this.app.redis.setex(cacheKey, 300, JSON.stringify(domainsWithScores));

    return domainsWithScores;
  }

  /**
   * Get domain metrics from email_stats_daily
   */
  private async getDomainMetrics(
    domain: string,
    from: Date,
    to: Date
  ): Promise<DomainHealthMetrics> {
    const [row] = await this.app.sql`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'accepted' OR event_type = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE event_type = 'bounced' AND bounce_type = 'hard') as hard_bounced,
        COUNT(*) as total_sent,
        SUM(CASE WHEN dkim_result = 'pass' THEN 1 ELSE 0 END) as dkim_pass,
        SUM(CASE WHEN spf_result = 'pass' THEN 1 ELSE 0 END) as spf_pass,
        SUM(CASE WHEN dmarc_result = 'pass' THEN 1 ELSE 0 END) as dmarc_pass,
        AVG(delivery_time_ms) as avg_delivery_ms
      FROM email_events
      WHERE from_domain = ${domain}
        AND time >= ${from.toISOString()}
        AND time < ${to.toISOString()}
    `;

    return {
      domain,
      totalSent: parseInt(row.total_sent || "0", 10),
      delivered: parseInt(row.delivered || "0", 10),
      bounced: parseInt(row.bounced || "0", 10),
      hardBounced: parseInt(row.hard_bounced || "0", 10),
      dkimPass: parseInt(row.dkim_pass || "0", 10),
      spfPass: parseInt(row.spf_pass || "0", 10),
      dmarcPass: parseInt(row.dmarc_pass || "0", 10),
      avgDeliveryMs: parseFloat(row.avg_delivery_ms || "0"),
    };
  }

  /**
   * Get domain stats over time period
   */
  async getDomainStats(domain: string, from: Date, to: Date) {
    const result = await this.app.sql`
      SELECT
        time_bucket('1 hour', time) as bucket,
        COUNT(*) FILTER (WHERE event_type = 'accepted' OR event_type = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced,
        COUNT(*) as total,
        AVG(delivery_time_ms) as avg_delivery_ms,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delivery_time_ms) as p50_delivery_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY delivery_time_ms) as p95_delivery_ms,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY delivery_time_ms) as p99_delivery_ms,
        SUM(CASE WHEN dkim_result = 'pass' THEN 1 ELSE 0 END) as dkim_pass,
        SUM(CASE WHEN spf_result = 'pass' THEN 1 ELSE 0 END) as spf_pass,
        SUM(CASE WHEN dmarc_result = 'pass' THEN 1 ELSE 0 END) as dmarc_pass
      FROM email_events
      WHERE from_domain = ${domain}
        AND time >= ${from.toISOString()}
        AND time < ${to.toISOString()}
      GROUP BY bucket
      ORDER BY bucket
    `;

    return result.map((row: any) => ({
      timestamp: row.bucket,
      delivered: parseInt(row.delivered || "0", 10),
      bounced: parseInt(row.bounced || "0", 10),
      total: parseInt(row.total || "0", 10),
      avgDeliveryMs: parseFloat(row.avg_delivery_ms || "0"),
      p50DeliveryMs: parseFloat(row.p50_delivery_ms || "0"),
      p95DeliveryMs: parseFloat(row.p95_delivery_ms || "0"),
      p99DeliveryMs: parseFloat(row.p99_delivery_ms || "0"),
      dkimPass: parseInt(row.dkim_pass || "0", 10),
      spfPass: parseInt(row.spf_pass || "0", 10),
      dmarcPass: parseInt(row.dmarc_pass || "0", 10),
    }));
  }

  /**
   * Get per-destination stats for a sending domain
   */
  async getDomainDestinations(domain: string, from: Date, to: Date, limit = 20) {
    const result = await this.app.sql`
      SELECT
        to_domain as destination,
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE event_type = 'accepted' OR event_type = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE event_type = 'deferred') as deferred,
        AVG(delivery_time_ms) as avg_delivery_ms
      FROM email_events
      WHERE from_domain = ${domain}
        AND time >= ${from.toISOString()}
        AND time < ${to.toISOString()}
      GROUP BY to_domain
      ORDER BY total_sent DESC
      LIMIT ${limit}
    `;

    return result.map((row: any) => ({
      destination: row.destination,
      totalSent: parseInt(row.total_sent || "0", 10),
      delivered: parseInt(row.delivered || "0", 10),
      bounced: parseInt(row.bounced || "0", 10),
      deferred: parseInt(row.deferred || "0", 10),
      avgDeliveryMs: parseFloat(row.avg_delivery_ms || "0"),
      deliveryRate: row.total_sent > 0 ? (parseInt(row.delivered || "0", 10) / parseInt(row.total_sent || "0", 10)) * 100 : 0,
    }));
  }

  /**
   * Get top senders (from_user) in a domain
   */
  async getDomainTopSenders(domain: string, from: Date, to: Date, limit = 20) {
    const result = await this.app.sql`
      SELECT
        from_user as sender,
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE event_type = 'accepted' OR event_type = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE event_type = 'complained') as complained
      FROM email_events
      WHERE from_domain = ${domain}
        AND time >= ${from.toISOString()}
        AND time < ${to.toISOString()}
      GROUP BY from_user
      ORDER BY total_sent DESC
      LIMIT ${limit}
    `;

    return result.map((row: any) => ({
      sender: row.sender,
      totalSent: parseInt(row.total_sent || "0", 10),
      delivered: parseInt(row.delivered || "0", 10),
      bounced: parseInt(row.bounced || "0", 10),
      complained: parseInt(row.complained || "0", 10),
      bounceRate: row.total_sent > 0 ? (parseInt(row.bounced || "0", 10) / parseInt(row.total_sent || "0", 10)) * 100 : 0,
    }));
  }
}
