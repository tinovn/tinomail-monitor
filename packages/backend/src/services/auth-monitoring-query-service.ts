import type { FastifyInstance } from "fastify";
import { sql, and, gte, lte, eq, desc } from "drizzle-orm";
import { authEvents } from "../db/schema/auth-events-hypertable.js";

export class AuthMonitoringQueryService {
  constructor(private app: FastifyInstance) {}

  /**
   * Get authentication summary stats
   * Cached 60s
   */
  async getAuthSummary(from: Date, to: Date) {
    const cacheKey = `auth:summary:${from.getTime()}:${to.getTime()}`;
    const cached = await this.app.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.app.db
      .select({
        totalAttempts: sql<number>`COUNT(*)`,
        successCount: sql<number>`COUNT(*) FILTER (WHERE ${authEvents.success} = true)`,
        failCount: sql<number>`COUNT(*) FILTER (WHERE ${authEvents.success} = false)`,
        uniqueIps: sql<number>`COUNT(DISTINCT ${authEvents.sourceIp})`,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${authEvents.username})`,
      })
      .from(authEvents)
      .where(and(gte(authEvents.time, from), lte(authEvents.time, to)));

    const summary = result[0] || {
      totalAttempts: 0,
      successCount: 0,
      failCount: 0,
      uniqueIps: 0,
      uniqueUsers: 0,
    };

    await this.app.redis.setex(cacheKey, 60, JSON.stringify(summary));
    return summary;
  }

  /**
   * Get auth trend over time (hourly buckets)
   * Cached 60s
   */
  async getAuthTrend(from: Date, to: Date) {
    const cacheKey = `auth:trend:${from.getTime()}:${to.getTime()}`;
    const cached = await this.app.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const query = sql`
      SELECT
        time_bucket('1 hour', ${authEvents.time}) as bucket,
        COUNT(*) FILTER (WHERE ${authEvents.success} = true) as success_count,
        COUNT(*) FILTER (WHERE ${authEvents.success} = false) as fail_count
      FROM ${authEvents}
      WHERE ${authEvents.time} >= ${from} AND ${authEvents.time} <= ${to}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const result = await this.app.db.execute(query);
    await this.app.redis.setex(cacheKey, 60, JSON.stringify(result));
    return result;
  }

  /**
   * Get top failed IPs
   * Cached 60s
   */
  async getTopFailedIps(from: Date, to: Date, limit = 20) {
    const cacheKey = `auth:failed-ips:${from.getTime()}:${to.getTime()}:${limit}`;
    const cached = await this.app.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.app.db
      .select({
        sourceIp: authEvents.sourceIp,
        failCount: sql<number>`COUNT(*)`,
        lastAttempt: sql<Date>`MAX(${authEvents.time})`,
      })
      .from(authEvents)
      .where(
        and(
          gte(authEvents.time, from),
          lte(authEvents.time, to),
          eq(authEvents.success, false)
        )
      )
      .groupBy(authEvents.sourceIp)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit);

    await this.app.redis.setex(cacheKey, 60, JSON.stringify(result));
    return result;
  }

  /**
   * Get top failed usernames
   * Cached 60s
   */
  async getTopFailedUsers(from: Date, to: Date, limit = 20) {
    const cacheKey = `auth:failed-users:${from.getTime()}:${to.getTime()}:${limit}`;
    const cached = await this.app.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.app.db
      .select({
        username: authEvents.username,
        failCount: sql<number>`COUNT(*)`,
        lastAttempt: sql<Date>`MAX(${authEvents.time})`,
      })
      .from(authEvents)
      .where(
        and(
          gte(authEvents.time, from),
          lte(authEvents.time, to),
          eq(authEvents.success, false)
        )
      )
      .groupBy(authEvents.username)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit);

    await this.app.redis.setex(cacheKey, 60, JSON.stringify(result));
    return result;
  }

  /**
   * Get brute force alerts (IPs with >10 fails in 5min window)
   * Cached 30s
   */
  async getBruteForceAlerts(from: Date, to: Date) {
    const cacheKey = `auth:brute-force:${from.getTime()}:${to.getTime()}`;
    const cached = await this.app.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const query = sql`
      SELECT
        ${authEvents.sourceIp} as source_ip,
        COUNT(*) as fail_count,
        MAX(${authEvents.time}) as last_attempt
      FROM ${authEvents}
      WHERE ${authEvents.time} >= ${from}
        AND ${authEvents.time} <= ${to}
        AND ${authEvents.success} = false
      GROUP BY ${authEvents.sourceIp}
      HAVING COUNT(*) > 10
      ORDER BY fail_count DESC
    `;

    const result = await this.app.db.execute(query);
    await this.app.redis.setex(cacheKey, 30, JSON.stringify(result));
    return result;
  }
}
