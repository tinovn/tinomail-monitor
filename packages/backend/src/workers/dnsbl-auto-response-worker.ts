import { Worker } from "bullmq";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { sendingIps } from "../db/schema/sending-ips-table.js";
import { alertEvents } from "../db/schema/alert-events-table.js";

interface AutoResponseJob {
  ip: string;
  blacklist: string;
  tier: string;
}

export function createDnsblAutoResponseWorker(app: FastifyInstance) {
  const worker = new Worker<AutoResponseJob>(
    "dnsbl-auto-response",
    async (job) => {
      const { ip, blacklist, tier } = job.data;

      try {
        // Only auto-respond to critical tier blacklists
        if (tier !== "critical") {
          return { action: "none", reason: "not critical tier" };
        }

        // Get last 2 checks for this IP+blacklist
        const recentChecks = await app.sql`
          SELECT listed, time
          FROM blacklist_checks
          WHERE ip = ${ip} AND blacklist = ${blacklist}
          ORDER BY time DESC
          LIMIT 2
        `;

        if (recentChecks.length < 2) {
          return { action: "none", reason: "insufficient check history" };
        }

        // Check if both recent checks show listing
        const bothListed = recentChecks.every((c) => c.listed);

        if (bothListed) {
          // Get current IP status
          const [ipRecord] = await app.db
            .select()
            .from(sendingIps)
            .where(eq(sendingIps.ip, ip))
            .limit(1);

          if (!ipRecord) {
            return { action: "none", reason: "IP not found" };
          }

          // Auto-pause if currently active
          if (ipRecord.status === "active") {
            await app.db
              .update(sendingIps)
              .set({
                status: "paused",
                notes: `Auto-paused: listed on ${blacklist} (critical tier) for 2 consecutive checks`,
                updatedAt: new Date(),
              })
              .where(eq(sendingIps.ip, ip));

            // Create alert event
            await app.db.insert(alertEvents).values({
              severity: "critical",
              message: `IP ${ip} auto-paused due to critical blacklist listing`,
              details: {
                ip,
                blacklist,
                tier,
                nodeId: ipRecord.nodeId,
                consecutiveChecks: 2,
              },
              status: "active",
              nodeId: ipRecord.nodeId,
            });

            // Emit Socket.IO alert
            app.io.to("ip-reputation").emit("ip:auto-paused", {
              ip,
              blacklist,
              tier,
              nodeId: ipRecord.nodeId,
              timestamp: new Date().toISOString(),
            });

            app.log.warn(
              { ip, blacklist, tier },
              "IP auto-paused due to critical blacklist",
            );

            return { action: "paused", reason: "2 consecutive critical listings" };
          }
        } else {
          // Check if delisted after being paused
          const allNotListed = recentChecks.every((c) => !c.listed);

          if (allNotListed) {
            const [ipRecord] = await app.db
              .select()
              .from(sendingIps)
              .where(eq(sendingIps.ip, ip))
              .limit(1);

            if (ipRecord?.status === "paused" && ipRecord.notes?.includes("Auto-paused")) {
              // Restore to active (or previous status before pause)
              await app.db
                .update(sendingIps)
                .set({
                  status: "active",
                  notes: `Auto-restored: delisted from ${blacklist}`,
                  updatedAt: new Date(),
                })
                .where(eq(sendingIps.ip, ip));

              // Resolve alert
              await app.sql`
                UPDATE alert_events
                SET status = 'resolved', resolved_at = NOW()
                WHERE details->>'ip' = ${ip}
                  AND status = 'active'
                  AND severity = 'critical'
              `;

              // Emit Socket.IO notification
              app.io.to("ip-reputation").emit("ip:auto-restored", {
                ip,
                blacklist,
                tier,
                nodeId: ipRecord.nodeId,
                timestamp: new Date().toISOString(),
              });

              app.log.info(
                { ip, blacklist, tier },
                "IP auto-restored after delisting",
              );

              return { action: "restored", reason: "delisted from critical blacklist" };
            }
          }
        }

        return { action: "none", reason: "no action required" };
      } catch (error) {
        app.log.error({ error, ip, blacklist }, "Auto-response processing failed");
        throw error;
      }
    },
    {
      connection: app.redisWorker,
      concurrency: 2,
    },
  );

  worker.on("completed", (job) => {
    app.log.debug(
      { jobId: job.id, ip: job.data.ip },
      "Auto-response job completed",
    );
  });

  worker.on("failed", (job, err) => {
    app.log.error(
      { jobId: job?.id, ip: job?.data.ip, error: err },
      "Auto-response job failed",
    );
  });

  return worker;
}
