import type { FastifyInstance } from "fastify";

interface MailUser {
  address: string;
  sent24h: number;
  received24h: number;
  bounceRate: number;
  spamReports: number;
  riskLevel: "Low" | "Medium" | "High";
}

interface MailUserDetail extends MailUser {
  topDestinations: Array<{
    domain: string;
    count: number;
  }>;
}

interface MailUserActivity {
  timestamp: string;
  sent: number;
  received: number;
}

interface AbuseFlaggedUser {
  address: string;
  flaggedAt: string;
  reason: string;
  sent24h: number;
  bounceRate: number;
  spamReports: number;
}

type RiskLevel = "Low" | "Medium" | "High";

/**
 * Mail User Analytics Service
 * Tracks email account activity, not dashboard users
 */
export class MailUserAnalyticsService {
  constructor(private app: FastifyInstance) {}

  /**
   * Get paginated list of mail users with risk badges
   */
  async getMailUsers(
    page = 1,
    limit = 50,
    search?: string,
    sortBy = "sent24h",
    sortDir: "asc" | "desc" = "desc"
  ): Promise<{ users: MailUser[]; total: number; page: number; pageCount: number }> {
    // Check cache first
    const cacheKey = `mail-users:list:${page}:${limit}:${search || "all"}:${sortBy}:${sortDir}`;
    const cached = await this.app.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const offset = (page - 1) * limit;

    // Build search condition
    const searchCondition = search
      ? this.app.sql`AND from_user ILIKE ${"%" + search + "%"}`
      : this.app.sql``;

    // Get total count
    const [countRow] = await this.app.sql`
      SELECT COUNT(DISTINCT from_user) as total
      FROM email_events
      WHERE time >= ${yesterday.toISOString()}::timestamptz
      ${searchCondition}
    `;
    const total = parseInt(countRow.total || "0", 10);

    // Get users with stats (email_events only tracks senders via from_user)
    const result = await this.app.sql`
      SELECT
        from_user as address,
        COUNT(*) FILTER (WHERE event_type IN ('accepted', 'delivered')) as sent_24h,
        0 as received_24h,
        COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE event_type = 'complained') as spam_reports,
        COUNT(*) as total
      FROM email_events
      WHERE time >= ${yesterday.toISOString()}::timestamptz
        AND from_user IS NOT NULL
      ${searchCondition}
      GROUP BY from_user
      ORDER BY sent_24h ${this.app.sql.unsafe(sortDir.toUpperCase())}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const users = result.map((row: any) => {
      const sent = parseInt(row.sent_24h || "0", 10);
      const bounced = parseInt(row.bounced || "0", 10);
      const spamReports = parseInt(row.spam_reports || "0", 10);
      const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0;

      return {
        address: row.address,
        sent24h: sent,
        received24h: parseInt(row.received_24h || "0", 10),
        bounceRate,
        spamReports,
        riskLevel: this.computeRiskLevel(bounceRate, spamReports),
      };
    });

    const pageCount = Math.ceil(total / limit);
    const response = { users, total, page, pageCount };

    // Cache for 5 minutes
    await this.app.redis.setex(cacheKey, 300, JSON.stringify(response));

    return response;
  }

  /**
   * Get detailed stats for one mail user
   */
  async getMailUserDetail(address: string): Promise<MailUserDetail | null> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get user stats (only from_user exists in email_events)
    const [row] = await this.app.sql`
      SELECT
        COUNT(*) FILTER (WHERE event_type IN ('accepted', 'delivered')) as sent_24h,
        0 as received_24h,
        COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE event_type = 'complained') as spam_reports,
        COUNT(*) as total
      FROM email_events
      WHERE from_user = ${address}
        AND time >= ${yesterday.toISOString()}::timestamptz
    `;

    if (!row || parseInt(row.total || "0", 10) === 0) {
      return null;
    }

    const sent = parseInt(row.sent_24h || "0", 10);
    const bounced = parseInt(row.bounced || "0", 10);
    const spamReports = parseInt(row.spam_reports || "0", 10);
    const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0;

    // Get top destinations
    const topDestinations = await this.app.sql`
      SELECT
        to_domain as domain,
        COUNT(*) as count
      FROM email_events
      WHERE from_user = ${address}
        AND time >= ${yesterday.toISOString()}::timestamptz
      GROUP BY to_domain
      ORDER BY count DESC
      LIMIT 10
    `;

    return {
      address,
      sent24h: sent,
      received24h: parseInt(row.received_24h || "0", 10),
      bounceRate,
      spamReports,
      riskLevel: this.computeRiskLevel(bounceRate, spamReports),
      topDestinations: topDestinations.map((d: any) => ({
        domain: d.domain,
        count: parseInt(d.count || "0", 10),
      })),
    };
  }

  /**
   * Get mail user activity time-series (send/receive trend)
   */
  async getMailUserActivity(address: string, from: Date, to: Date): Promise<MailUserActivity[]> {
    const result = await this.app.sql`
      SELECT
        time_bucket('1 hour', time) as bucket,
        COUNT(*) as sent,
        0 as received
      FROM email_events
      WHERE from_user = ${address}
        AND time >= ${from.toISOString()}::timestamptz
        AND time < ${to.toISOString()}::timestamptz
      GROUP BY bucket
      ORDER BY bucket
    `;

    return result.map((row: any) => ({
      timestamp: row.bucket,
      sent: parseInt(row.sent || "0", 10),
      received: parseInt(row.received || "0", 10),
    }));
  }

  /**
   * Compute risk level based on bounce rate and spam reports
   */
  computeRiskLevel(bounceRate: number, spamReports: number): RiskLevel {
    if (bounceRate > 10 || spamReports > 5) {
      return "High";
    }
    if (bounceRate > 5 || spamReports > 2) {
      return "Medium";
    }
    return "Low";
  }

  /**
   * Get users flagged for abuse by abuse detection worker
   */
  async getAbuseFlaggedUsers(): Promise<AbuseFlaggedUser[]> {
    const keys = await this.app.redis.keys("abuse:flagged:*");
    if (keys.length === 0) {
      return [];
    }

    const flaggedUsers: AbuseFlaggedUser[] = [];

    for (const key of keys) {
      const data = await this.app.redis.get(key);
      if (data) {
        flaggedUsers.push(JSON.parse(data));
      }
    }

    return flaggedUsers.sort((a, b) => b.sent24h - a.sent24h);
  }
}
