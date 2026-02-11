import type { FastifyInstance } from "fastify";
import { sql, and, gte, lte, desc } from "drizzle-orm";
import { metricsRspamd } from "../db/schema/metrics-rspamd-hypertable.js";
import { emailEvents } from "../db/schema/email-events-hypertable.js";

export class RspamdDashboardQueryService {
  constructor(private app: FastifyInstance) {}

  /**
   * Get Rspamd summary stats (total scanned, ham, spam, etc.)
   * Cached 60s
   */
  async getRspamdSummary(from: Date, to: Date) {
    const cacheKey = `rspamd:summary:${from.getTime()}:${to.getTime()}`;
    const cached = await this.app.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.app.db
      .select({
        totalScanned: sql<number>`COALESCE(SUM(${metricsRspamd.scanned}), 0)`,
        totalHam: sql<number>`COALESCE(SUM(${metricsRspamd.ham}), 0)`,
        totalSpam: sql<number>`COALESCE(SUM(${metricsRspamd.spam}), 0)`,
        totalGreylist: sql<number>`COALESCE(SUM(${metricsRspamd.greylist}), 0)`,
        totalRejected: sql<number>`COALESCE(SUM(${metricsRspamd.rejected}), 0)`,
        totalLearnedHam: sql<number>`COALESCE(SUM(${metricsRspamd.learnedHam}), 0)`,
        totalLearnedSpam: sql<number>`COALESCE(SUM(${metricsRspamd.learnedSpam}), 0)`,
      })
      .from(metricsRspamd)
      .where(and(gte(metricsRspamd.time, from), lte(metricsRspamd.time, to)));

    const summary = result[0] || {
      totalScanned: 0,
      totalHam: 0,
      totalSpam: 0,
      totalGreylist: 0,
      totalRejected: 0,
      totalLearnedHam: 0,
      totalLearnedSpam: 0,
    };

    await this.app.redis.setex(cacheKey, 60, JSON.stringify(summary));
    return summary;
  }

  /**
   * Get Rspamd trend over time (hourly buckets)
   * Cached 60s
   */
  async getRspamdTrend(from: Date, to: Date) {
    const cacheKey = `rspamd:trend:${from.getTime()}:${to.getTime()}`;
    const cached = await this.app.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    const result = await this.app.sql`
      SELECT
        time_bucket('1 hour', time) as bucket,
        COALESCE(SUM(scanned), 0)::int as scanned,
        COALESCE(SUM(ham), 0)::int as ham,
        COALESCE(SUM(spam), 0)::int as spam,
        COALESCE(SUM(greylist), 0)::int as greylist,
        COALESCE(SUM(rejected), 0)::int as rejected
      FROM metrics_rspamd
      WHERE time >= ${fromIso}::timestamptz AND time <= ${toIso}::timestamptz
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    await this.app.redis.setex(cacheKey, 60, JSON.stringify(result));
    return result;
  }

  /**
   * Get spam action breakdown from email_events
   * Cached 60s
   */
  async getSpamActionBreakdown(from: Date, to: Date) {
    const cacheKey = `rspamd:actions:${from.getTime()}:${to.getTime()}`;
    const cached = await this.app.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.app.db
      .select({
        spamAction: emailEvents.spamAction,
        count: sql<number>`COUNT(*)`,
        percentage: sql<number>`(COUNT(*)::float / SUM(COUNT(*)) OVER () * 100)`,
      })
      .from(emailEvents)
      .where(and(gte(emailEvents.time, from), lte(emailEvents.time, to)))
      .groupBy(emailEvents.spamAction)
      .orderBy(desc(sql`COUNT(*)`));

    await this.app.redis.setex(cacheKey, 60, JSON.stringify(result));
    return result;
  }

  /**
   * Get high spam score outbound messages
   * Cached 60s
   */
  async getHighScoreOutbound(from: Date, to: Date, threshold = 5, limit = 50) {
    const cacheKey = `rspamd:highscore:${from.getTime()}:${to.getTime()}:${threshold}:${limit}`;
    const cached = await this.app.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.app.db
      .select({
        time: emailEvents.time,
        messageId: emailEvents.messageId,
        fromAddress: emailEvents.fromAddress,
        toAddress: emailEvents.toAddress,
        spamScore: emailEvents.spamScore,
        spamAction: emailEvents.spamAction,
        mtaNode: emailEvents.mtaNode,
      })
      .from(emailEvents)
      .where(
        and(
          gte(emailEvents.time, from),
          lte(emailEvents.time, to),
          sql`${emailEvents.spamScore} > ${threshold}`
        )
      )
      .orderBy(desc(emailEvents.spamScore))
      .limit(limit);

    await this.app.redis.setex(cacheKey, 60, JSON.stringify(result));
    return result;
  }
}
