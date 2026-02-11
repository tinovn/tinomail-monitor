import { Worker, Queue } from "bullmq";
import type { FastifyInstance } from "fastify";
import { alertEvents } from "../db/schema/alert-events-table.js";

interface AbuseCheckJob {
  checkType: "volume" | "bounce" | "spam";
}

interface AbuseFlag {
  address: string;
  flaggedAt: string;
  reason: string;
  sent24h: number;
  bounceRate: number;
  spamReports: number;
}

/**
 * Abuse Detection Worker
 * Runs every 5 minutes to detect user abuse patterns:
 * - Volume spike (>10x 7-day avg in 1h)
 * - High bounce (>10% in 30min)
 * - Spam complaints (>3 in 24h)
 */
export function createAbuseDetectionScheduledWorker(app: FastifyInstance) {
  const worker = new Worker<AbuseCheckJob>(
    "abuse-detection-scheduled",
    async () => {
      const checkTime = new Date();

      try {
        // Run all abuse checks in parallel
        const [volumeSpikes, highBounces, spamAbusers] = await Promise.all([
          detectVolumeSpikeUsers(app, checkTime),
          detectHighBounceUsers(app, checkTime),
          detectSpamComplaintUsers(app, checkTime),
        ]);

        const flaggedUsers = [...volumeSpikes, ...highBounces, ...spamAbusers];

        // Store flagged users in Redis and create alert events
        for (const flag of flaggedUsers) {
          const key = `abuse:flagged:${flag.address}`;
          await app.redis.setex(key, 3600, JSON.stringify(flag)); // 1 hour TTL

          // Create alert event
          await app.db.insert(alertEvents).values({
            severity: "high",
            status: "fired",
            message: `User abuse detected: ${flag.reason}`,
            details: {
              address: flag.address,
              sent24h: flag.sent24h,
              bounceRate: flag.bounceRate,
              spamReports: flag.spamReports,
              reason: flag.reason,
            },
            firedAt: checkTime,
            notified: false,
          });

          // Broadcast alert via Socket.IO
          app.io.to("alerts").emit("abuse:detected", {
            address: flag.address,
            reason: flag.reason,
            sent24h: flag.sent24h,
            bounceRate: flag.bounceRate,
            spamReports: flag.spamReports,
            timestamp: checkTime.toISOString(),
          });
        }

        app.log.info(
          { flaggedUsers: flaggedUsers.length },
          "Abuse detection check completed"
        );

        return { flagged: flaggedUsers.length };
      } catch (error) {
        app.log.error({ error }, "Abuse detection check failed");
        throw error;
      }
    },
    {
      connection: app.redisWorker,
      concurrency: 1,
    }
  );

  worker.on("completed", (job) => {
    app.log.debug({ jobId: job.id }, "Abuse detection job completed");
  });

  worker.on("failed", (job, err) => {
    app.log.error(
      { jobId: job?.id, error: err },
      "Abuse detection job failed"
    );
  });

  return worker;
}

/**
 * Detect users with volume spike (>10x 7-day avg in last 1h)
 */
async function detectVolumeSpikeUsers(
  app: FastifyInstance,
  checkTime: Date
): Promise<AbuseFlag[]> {
  const oneHourAgo = new Date(checkTime.getTime() - 60 * 60 * 1000);
  const sevenDaysAgo = new Date(checkTime.getTime() - 7 * 24 * 60 * 60 * 1000);

  const result = await app.sql`
    WITH user_7d_avg AS (
      SELECT
        from_user,
        COUNT(*) / 7.0 / 24.0 as avg_hourly
      FROM email_events
      WHERE time >= ${sevenDaysAgo.toISOString()}::timestamptz
        AND time < ${oneHourAgo.toISOString()}::timestamptz
      GROUP BY from_user
    ),
    user_1h AS (
      SELECT
        from_user,
        COUNT(*) as sent_1h,
        COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE event_type = 'complained') as complained
      FROM email_events
      WHERE time >= ${oneHourAgo.toISOString()}::timestamptz
        AND time < ${checkTime.toISOString()}::timestamptz
      GROUP BY from_user
    )
    SELECT
      u1.from_user as address,
      u1.sent_1h,
      COALESCE(u7.avg_hourly, 0) as avg_hourly,
      u1.bounced,
      u1.complained
    FROM user_1h u1
    LEFT JOIN user_7d_avg u7 ON u1.from_user = u7.from_user
    WHERE u1.sent_1h > (COALESCE(u7.avg_hourly, 0) * 10)
      AND u1.sent_1h > 100
  `;

  return result.map((row: any) => ({
    address: row.address,
    flaggedAt: checkTime.toISOString(),
    reason: `Volume spike: ${row.sent_1h} emails in 1h (10x avg: ${Math.round(row.avg_hourly)})`,
    sent24h: parseInt(row.sent_1h || "0", 10),
    bounceRate: row.sent_1h > 0 ? (parseInt(row.bounced || "0", 10) / parseInt(row.sent_1h || "1", 10)) * 100 : 0,
    spamReports: parseInt(row.complained || "0", 10),
  }));
}

/**
 * Detect users with high bounce rate (>10% in last 30min)
 */
async function detectHighBounceUsers(
  app: FastifyInstance,
  checkTime: Date
): Promise<AbuseFlag[]> {
  const thirtyMinAgo = new Date(checkTime.getTime() - 30 * 60 * 1000);

  const result = await app.sql`
    SELECT
      from_user as address,
      COUNT(*) as total_sent,
      COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced,
      COUNT(*) FILTER (WHERE event_type = 'complained') as complained
    FROM email_events
    WHERE time >= ${thirtyMinAgo.toISOString()}::timestamptz
      AND time < ${checkTime.toISOString()}::timestamptz
    GROUP BY from_user
    HAVING COUNT(*) >= 50
      AND (COUNT(*) FILTER (WHERE event_type = 'bounced')::float / COUNT(*)) > 0.1
  `;

  return result.map((row: any) => {
    const totalSent = parseInt(row.total_sent || "0", 10);
    const bounced = parseInt(row.bounced || "0", 10);
    const bounceRate = totalSent > 0 ? (bounced / totalSent) * 100 : 0;

    return {
      address: row.address,
      flaggedAt: checkTime.toISOString(),
      reason: `High bounce rate: ${bounceRate.toFixed(1)}% in 30min`,
      sent24h: totalSent,
      bounceRate,
      spamReports: parseInt(row.complained || "0", 10),
    };
  });
}

/**
 * Detect users with spam complaints (>3 in last 24h)
 */
async function detectSpamComplaintUsers(
  app: FastifyInstance,
  checkTime: Date
): Promise<AbuseFlag[]> {
  const oneDayAgo = new Date(checkTime.getTime() - 24 * 60 * 60 * 1000);

  const result = await app.sql`
    SELECT
      from_user as address,
      COUNT(*) as total_sent,
      COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced,
      COUNT(*) FILTER (WHERE event_type = 'complained') as complained
    FROM email_events
    WHERE time >= ${oneDayAgo.toISOString()}::timestamptz
      AND time < ${checkTime.toISOString()}::timestamptz
    GROUP BY from_user
    HAVING COUNT(*) FILTER (WHERE event_type = 'complained') > 3
  `;

  return result.map((row: any) => {
    const totalSent = parseInt(row.total_sent || "0", 10);
    const bounced = parseInt(row.bounced || "0", 10);
    const complained = parseInt(row.complained || "0", 10);

    return {
      address: row.address,
      flaggedAt: checkTime.toISOString(),
      reason: `Spam complaints: ${complained} in 24h`,
      sent24h: totalSent,
      bounceRate: totalSent > 0 ? (bounced / totalSent) * 100 : 0,
      spamReports: complained,
    };
  });
}

/** Schedule abuse detection checks (every 5 minutes) */
export async function scheduleAbuseDetectionChecks(app: FastifyInstance) {
  const queue = new Queue("abuse-detection-scheduled", {
    connection: app.redisWorker,
  });

  await queue.add(
    "abuse-check",
    { checkType: "all" },
    {
      repeat: {
        pattern: "*/5 * * * *", // Every 5 minutes
      },
    }
  );

  app.log.info("Abuse detection scheduled checks configured");
}
