import type { FastifyInstance } from "fastify";

/** IP reputation summary stats */
export interface IpReputationSummary {
  totalIps: number;
  cleanIps: number;
  warningIps: number;
  criticalIps: number;
  inactiveIps: number;
  lastCheckTime: Date | null;
}

/** Blacklisted IP with details */
export interface BlacklistedIpDetail {
  ip: string;
  ipVersion: number;
  nodeId: string | null;
  blacklists: Array<{
    blacklist: string;
    tier: string;
    listed: boolean;
    firstListed: Date;
    lastChecked: Date;
  }>;
  highestTier: string;
  consecutiveChecks: number;
  status: string;
}

/** IP check history entry */
export interface IpCheckHistoryEntry {
  time: Date;
  blacklist: string;
  tier: string;
  listed: boolean;
  response: string | null;
}

export class IpReputationQueryService {
  private readonly CACHE_TTL_SECONDS = 60;

  constructor(private app: FastifyInstance) {}

  /** Get overall IP reputation summary */
  async getSummary(): Promise<IpReputationSummary> {
    const cacheKey = "ip-reputation:summary";

    // Try cache first
    const cached = await this.app.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Query from database
    const result = await this.app.sql`
      SELECT
        COUNT(*) FILTER (WHERE status != 'inactive') as total_ips,
        COUNT(*) FILTER (WHERE status = 'active' AND blacklist_count = 0) as clean_ips,
        COUNT(*) FILTER (WHERE status = 'active' AND blacklist_count > 0 AND blacklist_count < 3) as warning_ips,
        COUNT(*) FILTER (WHERE status = 'active' AND blacklist_count >= 3) as critical_ips,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive_ips,
        MAX(last_blacklist_check) as last_check_time
      FROM sending_ips
    `;

    const summary: IpReputationSummary = {
      totalIps: Number(result[0]?.total_ips || 0),
      cleanIps: Number(result[0]?.clean_ips || 0),
      warningIps: Number(result[0]?.warning_ips || 0),
      criticalIps: Number(result[0]?.critical_ips || 0),
      inactiveIps: Number(result[0]?.inactive_ips || 0),
      lastCheckTime: result[0]?.last_check_time || null,
    };

    // Cache for 60 seconds
    await this.app.redis.setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(summary));

    return summary;
  }

  /** Get currently blacklisted IPs with details */
  async getBlacklistedIps(): Promise<BlacklistedIpDetail[]> {
    const result = await this.app.sql`
      WITH latest_checks AS (
        SELECT DISTINCT ON (ip, blacklist)
          ip, blacklist, tier, listed, time,
          ROW_NUMBER() OVER (PARTITION BY ip, blacklist ORDER BY time DESC) as check_num
        FROM blacklist_checks
        WHERE time >= NOW() - INTERVAL '24 hours'
        ORDER BY ip, blacklist, time DESC
      ),
      blacklisted_ips AS (
        SELECT
          si.ip,
          si.ip_version,
          si.node_id,
          si.status,
          ARRAY_AGG(
            JSON_BUILD_OBJECT(
              'blacklist', lc.blacklist,
              'tier', lc.tier,
              'listed', lc.listed,
              'lastChecked', lc.time
            ) ORDER BY lc.tier, lc.blacklist
          ) as blacklists,
          MAX(CASE WHEN lc.tier = 'critical' THEN 'critical'
                   WHEN lc.tier = 'high' THEN 'high'
                   ELSE 'medium' END) as highest_tier
        FROM sending_ips si
        JOIN latest_checks lc ON lc.ip = si.ip
        WHERE lc.listed = true
        GROUP BY si.ip, si.ip_version, si.node_id, si.status
        HAVING COUNT(*) > 0
      )
      SELECT * FROM blacklisted_ips
      ORDER BY highest_tier DESC, ip
    `;

    return result.map((row) => ({
      ip: row.ip,
      ipVersion: row.ip_version,
      nodeId: row.node_id,
      blacklists: row.blacklists,
      highestTier: row.highest_tier,
      consecutiveChecks: 0, // TODO: calculate from check history
      status: row.status,
    }));
  }

  /** Get check history for a specific IP */
  async getIpCheckHistory(ip: string, hours = 24): Promise<IpCheckHistoryEntry[]> {
    const result = await this.app.sql`
      SELECT time, blacklist, tier, listed, response
      FROM blacklist_checks
      WHERE ip = ${ip}
        AND time >= NOW() - INTERVAL '${hours} hours'
      ORDER BY time DESC
      LIMIT 1000
    `;

    return result.map((row) => ({
      time: row.time,
      blacklist: row.blacklist,
      tier: row.tier,
      listed: row.listed,
      response: row.response,
    }));
  }

  /** Get IP status heatmap data (all IPs color-coded) */
  async getIpStatusHeatmap() {
    const result = await this.app.sql`
      WITH latest_check_status AS (
        SELECT
          si.ip,
          si.node_id,
          si.subnet,
          si.status,
          si.blacklist_count,
          CASE
            WHEN si.status = 'inactive' THEN 'inactive'
            WHEN si.blacklist_count = 0 THEN 'clean'
            WHEN si.blacklist_count < 3 THEN 'warning'
            ELSE 'critical'
          END as health_status
        FROM sending_ips si
      )
      SELECT
        ip,
        node_id,
        subnet,
        status,
        blacklist_count,
        health_status
      FROM latest_check_status
      ORDER BY subnet, ip
    `;

    return result;
  }

  /** Trigger immediate check for specific IP */
  async triggerImmediateCheck(ip: string): Promise<void> {
    // Queue a check job for this specific IP
    const { Queue } = await import("bullmq");
    const queue = new Queue("dnsbl-immediate-check", {
      connection: this.app.redis,
    });

    await queue.add("check-ip", { ip });
  }

  /** Get blacklist timeline (listing/delisting events) */
  async getBlacklistTimeline(ip: string, days = 7) {
    const result = await this.app.sql`
      WITH check_changes AS (
        SELECT
          time,
          blacklist,
          tier,
          listed,
          LAG(listed) OVER (PARTITION BY blacklist ORDER BY time) as prev_listed
        FROM blacklist_checks
        WHERE ip = ${ip}
          AND time >= NOW() - INTERVAL '${days} days'
      )
      SELECT
        time,
        blacklist,
        tier,
        CASE
          WHEN listed = true AND (prev_listed = false OR prev_listed IS NULL) THEN 'listed'
          WHEN listed = false AND prev_listed = true THEN 'delisted'
          ELSE null
        END as event_type
      FROM check_changes
      WHERE listed != prev_listed OR prev_listed IS NULL
      ORDER BY time DESC
    `;

    return result.filter((r) => r.event_type !== null);
  }
}
