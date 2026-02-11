import { Worker, Queue } from "bullmq";
import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { authEvents } from "../db/schema/auth-events-hypertable.js";

interface BruteForceAlert {
  sourceIp: string;
  failCount: number;
  lastAttempt: Date;
}

export function createBruteForceDetectionScheduledWorker(app: FastifyInstance) {
  const worker = new Worker(
    "brute-force-detection-scheduled",
    async () => {
      const checkTime = new Date();
      const fiveMinutesAgo = new Date(checkTime.getTime() - 5 * 60 * 1000);

      try {
        // Query for IPs with >10 failed auth attempts in last 5 minutes
        const query = sql`
          SELECT
            ${authEvents.sourceIp} as source_ip,
            COUNT(*) as fail_count,
            MAX(${authEvents.time}) as last_attempt
          FROM ${authEvents}
          WHERE ${authEvents.time} >= ${fiveMinutesAgo}
            AND ${authEvents.success} = false
          GROUP BY ${authEvents.sourceIp}
          HAVING COUNT(*) > 10
          ORDER BY fail_count DESC
        `;

        const result = await app.db.execute(query);
        const alerts = result as unknown as BruteForceAlert[];

        if (alerts.length > 0) {
          // Store active brute force IPs in Redis set
          const pipeline = app.redis.pipeline();
          pipeline.del("brute-force:active");

          for (const alert of alerts) {
            pipeline.sadd("brute-force:active", alert.sourceIp);
            pipeline.setex(
              `brute-force:ip:${alert.sourceIp}`,
              300,
              JSON.stringify(alert)
            );
          }

          await pipeline.exec();

          // Broadcast via Socket.IO
          app.io.emit("brute-force:alert", {
            timestamp: checkTime.toISOString(),
            count: alerts.length,
            alerts: alerts.slice(0, 10), // Send top 10
          });

          app.log.warn(
            { alertCount: alerts.length },
            "Brute force attacks detected"
          );
        } else {
          // Clear Redis set if no alerts
          await app.redis.del("brute-force:active");
        }

        return { checked: true, alertCount: alerts.length };
      } catch (error) {
        app.log.error({ error }, "Brute force detection failed");
        throw error;
      }
    },
    {
      connection: app.redisWorker,
      autorun: false,
    }
  );

  worker.on("completed", (job) => {
    app.log.debug({ jobId: job.id }, "Brute force detection completed");
  });

  worker.on("failed", (job, err) => {
    app.log.error({ jobId: job?.id, error: err }, "Brute force detection failed");
  });

  return worker;
}

/**
 * Schedule brute force detection checks every 30 seconds
 */
export async function scheduleBruteForceDetectionChecks(app: FastifyInstance) {
  const queue = new Queue("brute-force-detection-scheduled", {
    connection: app.redisWorker,
  });

  // Remove existing repeatable jobs
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Schedule every 30 seconds
  await queue.add(
    "brute-force-check",
    {},
    {
      repeat: {
        pattern: "*/30 * * * * *", // Every 30 seconds
      },
    }
  );

  app.log.info("Brute force detection scheduled (every 30s)");
}
