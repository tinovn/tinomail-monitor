import type { FastifyInstance } from "fastify";

interface DailySummary {
  date: string;
  emailStats: {
    totalSent: number;
    totalReceived: number;
    totalBounced: number;
    bounceRate: number;
  };
  topBounceDomains: Array<{ domain: string; count: number }>;
  clusterHealth: {
    avgCpu: number;
    avgRam: number;
    avgDiskUsage: number;
  };
  activeAlertsCount: number;
  newBlacklistEntries: number;
}

interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  dailyTotals: Array<{
    date: string;
    sent: number;
    bounced: number;
  }>;
  domainReputationChanges: Array<{
    domain: string;
    oldScore: number;
    newScore: number;
  }>;
  blacklistIncidents: number;
  alertSummary: {
    critical: number;
    warning: number;
    info: number;
  };
}

interface MonthlySummary {
  monthStart: string;
  monthEnd: string;
  weeklyTotals: Array<{
    weekStart: string;
    sent: number;
    bounced: number;
  }>;
  growthTrends: {
    emailVolumeChange: number;
    bounceRateChange: number;
  };
  incidentRecap: Array<{
    date: string;
    description: string;
    severity: string;
  }>;
  topPerformingDomains: Array<{ domain: string; score: number }>;
  worstPerformingDomains: Array<{ domain: string; score: number }>;
}

interface IpReputationReport {
  ips: Array<{
    ipAddress: string;
    hostname: string;
    status: string;
    blacklistCount: number;
    warmupProgress: number;
    reputationScore: number;
    lastChecked: string;
  }>;
}

export class ReportDataAggregationService {
  constructor(private app: FastifyInstance) {}

  async getDailySummary(date: Date): Promise<DailySummary> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Email stats
    const [emailStats] = await this.app.sql`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'sent')::int as total_sent,
        COUNT(*) FILTER (WHERE event_type = 'received')::int as total_received,
        COUNT(*) FILTER (WHERE event_type = 'bounced')::int as total_bounced,
        CASE
          WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE event_type = 'bounced')::float / COUNT(*) * 100)
          ELSE 0
        END as bounce_rate
      FROM email_events
      WHERE time >= ${startOfDay} AND time <= ${endOfDay}
    `;

    // Top bounce domains
    const topBounceDomains = await this.app.sql`
      SELECT to_domain as domain, COUNT(*)::int as count
      FROM email_events
      WHERE event_type = 'bounced'
        AND time >= ${startOfDay} AND time <= ${endOfDay}
      GROUP BY to_domain
      ORDER BY count DESC
      LIMIT 5
    `;

    // Cluster health (avg CPU, RAM from last metric of the day)
    const [clusterHealth] = await this.app.sql`
      SELECT
        AVG(cpu_usage)::numeric(5,2) as avg_cpu,
        AVG(memory_used / (memory_total::float) * 100)::numeric(5,2) as avg_ram,
        AVG(disk_used / (disk_total::float) * 100)::numeric(5,2) as avg_disk_usage
      FROM metrics_system
      WHERE time >= ${startOfDay} AND time <= ${endOfDay}
    `;

    // Active alerts count
    const [alertsCount] = await this.app.sql`
      SELECT COUNT(*)::int as count
      FROM alert_events
      WHERE status = 'active'
        AND created_at >= ${startOfDay} AND created_at <= ${endOfDay}
    `;

    // New blacklist entries
    const [blacklistCount] = await this.app.sql`
      SELECT COUNT(DISTINCT ip_address)::int as count
      FROM blacklist_checks
      WHERE is_listed = true
        AND time >= ${startOfDay} AND time <= ${endOfDay}
    `;

    return {
      date: date.toISOString().split("T")[0],
      emailStats: {
        totalSent: emailStats?.total_sent || 0,
        totalReceived: emailStats?.total_received || 0,
        totalBounced: emailStats?.total_bounced || 0,
        bounceRate: parseFloat(emailStats?.bounce_rate || 0),
      },
      topBounceDomains: topBounceDomains.map((row: any) => ({
        domain: row.domain,
        count: row.count,
      })),
      clusterHealth: {
        avgCpu: parseFloat(clusterHealth?.avg_cpu || 0),
        avgRam: parseFloat(clusterHealth?.avg_ram || 0),
        avgDiskUsage: parseFloat(clusterHealth?.avg_disk_usage || 0),
      },
      activeAlertsCount: alertsCount?.count || 0,
      newBlacklistEntries: blacklistCount?.count || 0,
    };
  }

  async getWeeklySummary(weekStart: Date): Promise<WeeklySummary> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Daily totals for the week
    const dailyTotals = await this.app.sql`
      SELECT
        DATE(time) as date,
        COUNT(*) FILTER (WHERE event_type = 'sent')::int as sent,
        COUNT(*) FILTER (WHERE event_type = 'bounced')::int as bounced
      FROM email_events
      WHERE time >= ${weekStart} AND time <= ${weekEnd}
      GROUP BY DATE(time)
      ORDER BY date ASC
    `;

    // Blacklist incidents
    const [blacklistIncidents] = await this.app.sql`
      SELECT COUNT(DISTINCT ip_address)::int as count
      FROM blacklist_checks
      WHERE is_listed = true
        AND time >= ${weekStart} AND time <= ${weekEnd}
    `;

    // Alert summary
    const [alertSummary] = await this.app.sql`
      SELECT
        COUNT(*) FILTER (WHERE severity = 'critical')::int as critical,
        COUNT(*) FILTER (WHERE severity = 'warning')::int as warning,
        COUNT(*) FILTER (WHERE severity = 'info')::int as info
      FROM alert_events
      WHERE created_at >= ${weekStart} AND created_at <= ${weekEnd}
    `;

    return {
      weekStart: weekStart.toISOString().split("T")[0],
      weekEnd: weekEnd.toISOString().split("T")[0],
      dailyTotals: dailyTotals.map((row: any) => ({
        date: row.date.toISOString().split("T")[0],
        sent: row.sent,
        bounced: row.bounced,
      })),
      domainReputationChanges: [], // Placeholder - would need domain reputation history table
      blacklistIncidents: blacklistIncidents?.count || 0,
      alertSummary: {
        critical: alertSummary?.critical || 0,
        warning: alertSummary?.warning || 0,
        info: alertSummary?.info || 0,
      },
    };
  }

  async getMonthlySummary(monthStart: Date): Promise<MonthlySummary> {
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0); // Last day of month

    // Weekly totals
    const weeklyTotals = await this.app.sql`
      SELECT
        DATE_TRUNC('week', time) as week_start,
        COUNT(*) FILTER (WHERE event_type = 'sent')::int as sent,
        COUNT(*) FILTER (WHERE event_type = 'bounced')::int as bounced
      FROM email_events
      WHERE time >= ${monthStart} AND time <= ${monthEnd}
      GROUP BY DATE_TRUNC('week', time)
      ORDER BY week_start ASC
    `;

    // Top performing domains (lowest bounce rate, min 100 emails)
    const topPerformingDomains = await this.app.sql`
      SELECT
        from_domain as domain,
        (100.0 - (COUNT(*) FILTER (WHERE event_type = 'bounced')::float / COUNT(*) * 100))::numeric(5,2) as score
      FROM email_events
      WHERE time >= ${monthStart} AND time <= ${monthEnd}
      GROUP BY from_domain
      HAVING COUNT(*) >= 100
      ORDER BY score DESC
      LIMIT 5
    `;

    // Worst performing domains
    const worstPerformingDomains = await this.app.sql`
      SELECT
        from_domain as domain,
        (COUNT(*) FILTER (WHERE event_type = 'bounced')::float / COUNT(*) * 100)::numeric(5,2) as score
      FROM email_events
      WHERE time >= ${monthStart} AND time <= ${monthEnd}
      GROUP BY from_domain
      HAVING COUNT(*) >= 100
      ORDER BY score DESC
      LIMIT 5
    `;

    // Critical incidents (alerts)
    const incidents = await this.app.sql`
      SELECT
        DATE(created_at) as date,
        rule_name as description,
        severity
      FROM alert_events
      WHERE severity = 'critical'
        AND created_at >= ${monthStart} AND created_at <= ${monthEnd}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    return {
      monthStart: monthStart.toISOString().split("T")[0],
      monthEnd: monthEnd.toISOString().split("T")[0],
      weeklyTotals: weeklyTotals.map((row: any) => ({
        weekStart: row.week_start.toISOString().split("T")[0],
        sent: row.sent,
        bounced: row.bounced,
      })),
      growthTrends: {
        emailVolumeChange: 0, // Placeholder - compare to previous month
        bounceRateChange: 0, // Placeholder
      },
      incidentRecap: incidents.map((row: any) => ({
        date: row.date.toISOString().split("T")[0],
        description: row.description,
        severity: row.severity,
      })),
      topPerformingDomains: topPerformingDomains.map((row: any) => ({
        domain: row.domain,
        score: parseFloat(row.score),
      })),
      worstPerformingDomains: worstPerformingDomains.map((row: any) => ({
        domain: row.domain,
        score: parseFloat(row.score),
      })),
    };
  }

  async getIpReputationReport(): Promise<IpReputationReport> {
    const ips = await this.app.sql`
      SELECT
        si.ip_address,
        si.hostname,
        si.status,
        si.blacklist_count,
        si.warmup_progress,
        si.reputation_score,
        si.updated_at as last_checked
      FROM sending_ips si
      ORDER BY si.reputation_score DESC
    `;

    return {
      ips: ips.map((row: any) => ({
        ipAddress: row.ip_address,
        hostname: row.hostname,
        status: row.status,
        blacklistCount: row.blacklist_count,
        warmupProgress: row.warmup_progress,
        reputationScore: row.reputation_score,
        lastChecked: row.last_checked.toISOString(),
      })),
    };
  }
}
