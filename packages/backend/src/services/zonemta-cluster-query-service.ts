import type { FastifyInstance } from "fastify";
import { eq, and, sql, gte, inArray, desc } from "drizzle-orm";
import { nodes } from "../db/schema/nodes-table.js";
import { sendingIps } from "../db/schema/sending-ips-table.js";
import { emailEvents } from "../db/schema/email-events-hypertable.js";
import { blacklistChecks } from "../db/schema/blacklist-checks-hypertable.js";
import type {
  MtaNodeStats,
  MtaNodePerformance,
  EnrichedSendingIp,
  DestinationQuality,
} from "@tinomail/shared";

export class ZonemtaClusterQueryService {
  private readonly CACHE_TTL = 30; // 30 seconds

  constructor(private app: FastifyInstance) {}

  async getMtaNodes(): Promise<MtaNodeStats[]> {
    const cacheKey = "zonemta:nodes:stats";
    const cached = await this.app.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get nodes running ZoneMTA service (check role OR metadata.detectedServices)
    const mtaNodes = await this.app.db
      .select()
      .from(nodes)
      .where(
        sql`role = 'zonemta' OR metadata->'detectedServices' @> '"zonemta"'`
      );

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Enrich each node with stats
    const enrichedNodes = await Promise.all(
      mtaNodes.map(async (node) => {
        // Count IPs for this node
        const ipStats = await this.app.db
          .select({
            total: sql<number>`count(*)::int`,
            active: sql<number>`count(*) filter (where status = 'active')::int`,
            blacklisted: sql<number>`count(*) filter (where blacklist_count > 0)::int`,
          })
          .from(sendingIps)
          .where(eq(sendingIps.nodeId, node.id));

        // Get email stats for last hour
        const emailStats = await this.app.db
          .select({
            sent: sql<number>`count(*)::int`,
            bounced: sql<number>`count(*) filter (where event_type = 'bounced')::int`,
          })
          .from(emailEvents)
          .where(
            and(
              eq(emailEvents.mtaNode, node.id),
              gte(emailEvents.time, oneHourAgo)
            )
          );

        const stats = ipStats[0] || { total: 0, active: 0, blacklisted: 0 };
        const emails = emailStats[0] || { sent: 0, bounced: 0 };
        const bounceRate = emails.sent > 0 ? (emails.bounced / emails.sent) * 100 : 0;

        // Get queue size from metadata (assuming it's stored in node metadata)
        const queueSize = (node.metadata as { queueSize?: number })?.queueSize || 0;
        const cpuUsage = (node.metadata as { cpuUsage?: number })?.cpuUsage || null;

        return {
          nodeId: node.id,
          hostname: node.hostname,
          status: node.status || "unknown",
          subnet: null, // Will be derived from IPs if needed
          totalIps: stats.total,
          activeIps: stats.active,
          sentLastHour: emails.sent,
          bounceRate: Math.round(bounceRate * 100) / 100,
          queueSize,
          blacklistedIps: stats.blacklisted,
          cpuUsage,
          lastSeen: node.lastSeen,
        } as MtaNodeStats;
      })
    );

    await this.app.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(enrichedNodes));
    return enrichedNodes;
  }

  async getNodePerformance(nodeId: string, hours = 24): Promise<MtaNodePerformance | null> {
    const node = await this.app.db
      .select()
      .from(nodes)
      .where(eq(nodes.id, nodeId))
      .limit(1);

    if (!node.length) return null;

    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Throughput time-series (hourly buckets)
    const throughput = await this.app.db
      .select({
        time: sql<Date>`time_bucket('1 hour', time)`,
        sent: sql<number>`count(*)::int`,
        delivered: sql<number>`count(*) filter (where event_type = 'delivered')::int`,
        bounced: sql<number>`count(*) filter (where event_type = 'bounced')::int`,
      })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.mtaNode, nodeId),
          gte(emailEvents.time, startTime)
        )
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    // Delivery status breakdown
    const deliveryStatus = await this.app.db
      .select({
        eventType: emailEvents.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.mtaNode, nodeId),
          gte(emailEvents.time, startTime)
        )
      )
      .groupBy(emailEvents.eventType);

    const statusMap = {
      delivered: 0,
      bounced: 0,
      deferred: 0,
      rejected: 0,
    };
    deliveryStatus.forEach((s) => {
      if (s.eventType in statusMap) {
        statusMap[s.eventType as keyof typeof statusMap] = s.count;
      }
    });

    // Queue trend from metrics_zonemta hypertable
    const startTimeIso = startTime.toISOString();
    const queueTrend = await this.app.db.execute<{ time: Date; size: number }>(
      sql`SELECT time_bucket('1 hour', time) AS time, avg(queue_size)::int AS size
          FROM metrics_zonemta
          WHERE node_id = ${nodeId} AND time >= ${startTimeIso}::timestamptz
          GROUP BY 1 ORDER BY 1`
    );

    // Resource usage from latest metrics_system record
    const latestMetrics = await this.app.db.execute<{
      cpu_percent: number;
      ram_percent: number;
      net_tx_bytes_sec: number;
      net_rx_bytes_sec: number;
    }>(
      sql`SELECT cpu_percent, ram_percent, net_tx_bytes_sec, net_rx_bytes_sec
          FROM metrics_system
          WHERE node_id = ${nodeId}
          ORDER BY time DESC LIMIT 1`
    );
    const latest = latestMetrics[0];

    return {
      throughput: throughput.map((t) => ({
        time: t.time,
        sent: t.sent,
        delivered: t.delivered,
        bounced: t.bounced,
      })),
      deliveryStatus: statusMap,
      queueTrend: queueTrend.map((r) => ({
        time: r.time,
        size: r.size,
      })),
      resources: {
        cpuUsage: latest?.cpu_percent || 0,
        memUsage: latest?.ram_percent || 0,
        networkSent: latest?.net_tx_bytes_sec ? latest.net_tx_bytes_sec / 1024 / 1024 : 0,
        networkRecv: latest?.net_rx_bytes_sec ? latest.net_rx_bytes_sec / 1024 / 1024 : 0,
      },
    };
  }

  async getNodeIps(
    nodeId: string,
    options: {
      status?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<EnrichedSendingIp[]> {
    const { status, search, limit = 254, offset = 0 } = options;

    // Build query conditions
    const conditions = [eq(sendingIps.nodeId, nodeId)];
    if (status) {
      conditions.push(eq(sendingIps.status, status));
    }
    if (search) {
      conditions.push(sql`${sendingIps.ip} LIKE ${`%${search}%`}`);
    }

    const ips = await this.app.db
      .select()
      .from(sendingIps)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Enrich with stats
    const enriched = await Promise.all(
      ips.map(async (ip) => {
        // Email stats for this IP
        const stats1h = await this.app.db
          .select({
            sent: sql<number>`count(*)::int`,
            bounced: sql<number>`count(*) filter (where event_type = 'bounced')::int`,
          })
          .from(emailEvents)
          .where(
            and(
              eq(emailEvents.sendingIp, ip.ip),
              gte(emailEvents.time, oneHourAgo)
            )
          );

        const stats24h = await this.app.db
          .select({
            sent: sql<number>`count(*)::int`,
          })
          .from(emailEvents)
          .where(
            and(
              eq(emailEvents.sendingIp, ip.ip),
              gte(emailEvents.time, oneDayAgo)
            )
          );

        // Get blacklists
        const blacklists = await this.app.db
          .select({ blacklist: blacklistChecks.blacklist })
          .from(blacklistChecks)
          .where(
            and(
              eq(blacklistChecks.ip, ip.ip),
              eq(blacklistChecks.listed, true)
            )
          )
          .orderBy(desc(blacklistChecks.time))
          .limit(5);

        // Last used timestamp
        const lastUsed = await this.app.db
          .select({ time: emailEvents.time })
          .from(emailEvents)
          .where(eq(emailEvents.sendingIp, ip.ip))
          .orderBy(desc(emailEvents.time))
          .limit(1);

        const sent1h = stats1h[0]?.sent || 0;
        const bounced1h = stats1h[0]?.bounced || 0;
        const sent24h = stats24h[0]?.sent || 0;
        const bounceRate = sent1h > 0 ? (bounced1h / sent1h) * 100 : 0;

        return {
          ip: ip.ip,
          ipVersion: ip.ipVersion as 4 | 6,
          nodeId: ip.nodeId,
          status: ip.status || "unknown",
          sentLast1h: sent1h,
          sentLast24h: sent24h,
          bounceRate: Math.round(bounceRate * 100) / 100,
          blacklists: blacklists.map((b) => b.blacklist),
          warmupDay: ip.warmupDay,
          dailyLimit: ip.dailyLimit,
          currentDailySent: ip.currentDailySent,
          reputationScore: ip.reputationScore,
          ptrRecord: ip.ptrRecord,
          lastUsed: lastUsed[0]?.time || null,
        } as EnrichedSendingIp;
      })
    );

    return enriched;
  }

  async getNodeDestinations(nodeId: string, hours = 24): Promise<DestinationQuality[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Get IPs for this node
    const nodeIps = await this.app.db
      .select({ ip: sendingIps.ip })
      .from(sendingIps)
      .where(eq(sendingIps.nodeId, nodeId));

    if (nodeIps.length === 0) return [];

    const ipList = nodeIps.map((n) => n.ip);

    // Group by destination domain
    const destinations = await this.app.db
      .select({
        destination: emailEvents.toDomain,
        sent: sql<number>`count(*)::int`,
        delivered: sql<number>`count(*) filter (where event_type = 'delivered')::int`,
        bounced: sql<number>`count(*) filter (where event_type = 'bounced')::int`,
        deferred: sql<number>`count(*) filter (where event_type = 'deferred')::int`,
        avgTime: sql<number>`avg(delivery_time_ms)`,
      })
      .from(emailEvents)
      .where(
        and(
          inArray(emailEvents.sendingIp, ipList),
          gte(emailEvents.time, startTime)
        )
      )
      .groupBy(emailEvents.toDomain)
      .orderBy(desc(sql`count(*)`))
      .limit(100);

    return destinations.map((d) => ({
      destination: d.destination || "unknown",
      sent: d.sent,
      delivered: d.delivered,
      bounced: d.bounced,
      deferred: d.deferred,
      deliveryRate: d.sent > 0 ? (d.delivered / d.sent) * 100 : 0,
      avgDeliveryTime: d.avgTime,
    }));
  }
}
