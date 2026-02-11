import type { FastifyInstance } from "fastify";

interface OverviewSummary {
  nodes: {
    total: number;
    active: number;
    warning: number;
    critical: number;
  };
  email: {
    sent24h: number;
    bounced24h: number;
    deferred24h: number;
    queueSize: number;
  };
  ips: {
    total: number;
    active: number;
    paused: number;
    quarantine: number;
    blacklisted: number;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };
}

export class OverviewService {
  private readonly CACHE_KEY = "overview:summary";
  private readonly CACHE_TTL = 30; // 30 seconds

  constructor(private app: FastifyInstance) {}

  async getOverviewSummary(): Promise<OverviewSummary> {
    // Try cache first
    const cached = await this.app.redis.get(this.CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as OverviewSummary;
    }

    // Query database
    const summary = await this.buildSummary();

    // Cache result
    await this.app.redis.setex(this.CACHE_KEY, this.CACHE_TTL, JSON.stringify(summary));

    return summary;
  }

  private async buildSummary(): Promise<OverviewSummary> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Node stats
    const [nodeStats] = await this.app.sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'active')::int as active,
        COUNT(*) FILTER (WHERE status = 'warning')::int as warning,
        COUNT(*) FILTER (WHERE status = 'critical')::int as critical
      FROM nodes
    `;

    // Email stats (from ZoneMTA metrics last 24h — use latest snapshot per node)
    const [emailStats] = await this.app.sql`
      SELECT
        COALESCE(SUM(latest.sent_total), 0)::int as sent_24h,
        COALESCE(SUM(latest.bounced_total), 0)::int as bounced_24h,
        COALESCE(SUM(latest.deferred_total), 0)::int as deferred_24h,
        COALESCE(SUM(latest.queue_size), 0)::int as queue_size
      FROM (
        SELECT DISTINCT ON (node_id)
          sent_total, bounced_total, deferred_total, queue_size
        FROM metrics_zonemta
        WHERE time >= ${yesterday.toISOString()}::timestamptz
        ORDER BY node_id, time DESC
      ) latest
    `;

    // IP stats
    const [ipStats] = await this.app.sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'active')::int as active,
        COUNT(*) FILTER (WHERE status = 'paused')::int as paused,
        COUNT(*) FILTER (WHERE status = 'quarantine')::int as quarantine,
        COUNT(*) FILTER (WHERE blacklist_count > 0)::int as blacklisted
      FROM sending_ips
    `;

    // Alert stats (active alerts only)
    const [alertStats] = await this.app.sql`
      SELECT
        COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'active')::int as critical,
        COUNT(*) FILTER (WHERE severity = 'warning' AND status = 'active')::int as warning,
        COUNT(*) FILTER (WHERE severity = 'info' AND status = 'active')::int as info
      FROM alert_events
      WHERE status = 'active'
    `;

    return {
      nodes: {
        total: nodeStats?.total || 0,
        active: nodeStats?.active || 0,
        warning: nodeStats?.warning || 0,
        critical: nodeStats?.critical || 0,
      },
      email: {
        sent24h: emailStats?.sent_24h || 0,
        bounced24h: emailStats?.bounced_24h || 0,
        deferred24h: emailStats?.deferred_24h || 0,
        queueSize: emailStats?.queue_size || 0,
      },
      ips: {
        total: ipStats?.total || 0,
        active: ipStats?.active || 0,
        paused: ipStats?.paused || 0,
        quarantine: ipStats?.quarantine || 0,
        blacklisted: ipStats?.blacklisted || 0,
      },
      alerts: {
        critical: alertStats?.critical || 0,
        warning: alertStats?.warning || 0,
        info: alertStats?.info || 0,
      },
    };
  }
}
