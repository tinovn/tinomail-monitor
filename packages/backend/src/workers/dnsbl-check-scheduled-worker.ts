import { Worker, Queue } from "bullmq";
import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { sendingIps } from "../db/schema/sending-ips-table.js";
import { blacklistChecks } from "../db/schema/blacklist-checks-hypertable.js";
import { dnsblLists } from "../db/schema/dnsbl-lists-table.js";
import { DnsblCheckerService } from "../services/dnsbl-checker-service.js";

interface DnsblCheckJob {
  tier: "critical" | "high" | "medium";
}

export function createDnsblCheckScheduledWorker(app: FastifyInstance) {
  const dnsblChecker = new DnsblCheckerService(app);

  const worker = new Worker<DnsblCheckJob>(
    "dnsbl-check-scheduled",
    async (job) => {
      const { tier } = job.data;
      const checkTime = new Date();

      try {
        // Get active IPs
        const activeIps = await app.db
          .select()
          .from(sendingIps)
          .where(eq(sendingIps.status, "active"));

        if (activeIps.length === 0) {
          app.log.debug("No active IPs to check");
          return { checked: 0 };
        }

        // Get enabled DNSBLs for this tier
        const dnsbls = await app.db
          .select()
          .from(dnsblLists)
          .where(and(eq(dnsblLists.tier, tier), eq(dnsblLists.enabled, true)));

        if (dnsbls.length === 0) {
          app.log.debug({ tier }, "No enabled DNSBLs for tier");
          return { checked: 0 };
        }

        // Perform checks for all IPs
        const checkResults = [];
        for (const ipRecord of activeIps) {
          const results = await dnsblChecker.checkIpAgainstDnsbls(
            ipRecord.ip,
            dnsbls.map((d) => ({
              blacklist: d.blacklist,
              tier: d.tier as "critical" | "high" | "medium",
              description: d.description,
            })),
          );

          // Insert results into blacklist_checks hypertable
          for (const result of results) {
            checkResults.push({
              time: checkTime,
              ip: ipRecord.ip,
              ipVersion: ipRecord.ipVersion,
              nodeId: ipRecord.nodeId,
              blacklist: result.blacklist,
              tier: result.tier,
              listed: result.listed,
              response: result.response,
              checkDurationMs: result.checkDurationMs,
            });
          }
        }

        // Batch insert check results
        if (checkResults.length > 0) {
          await app.db.insert(blacklistChecks).values(checkResults);
        }

        // Update blacklist counts and last check time for each IP
        for (const ipRecord of activeIps) {
          const listedCount = checkResults.filter(
            (r) => r.ip === ipRecord.ip && r.listed,
          ).length;

          await app.db
            .update(sendingIps)
            .set({
              blacklistCount: listedCount,
              lastBlacklistCheck: checkTime,
              updatedAt: checkTime,
            })
            .where(eq(sendingIps.ip, ipRecord.ip));

          // If new listings detected, emit Socket.IO alert
          if (listedCount > (ipRecord.blacklistCount || 0)) {
            const newListings = checkResults.filter(
              (r) => r.ip === ipRecord.ip && r.listed,
            );
            app.io.to("ip-reputation").emit("ip:blacklisted", {
              ip: ipRecord.ip,
              nodeId: ipRecord.nodeId,
              blacklists: newListings.map((l) => ({
                blacklist: l.blacklist,
                tier: l.tier,
                response: l.response,
              })),
              timestamp: checkTime.toISOString(),
            });
          }
        }

        app.log.info(
          {
            tier,
            ipsChecked: activeIps.length,
            dnsbls: dnsbls.length,
            totalChecks: checkResults.length,
          },
          "DNSBL checks completed",
        );

        return { checked: checkResults.length };
      } catch (error) {
        app.log.error({ error, tier }, "DNSBL check failed");
        throw error;
      }
    },
    {
      connection: app.redisWorker,
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    app.log.debug({ jobId: job.id, tier: job.data.tier }, "DNSBL check job completed");
  });

  worker.on("failed", (job, err) => {
    app.log.error(
      { jobId: job?.id, tier: job?.data.tier, error: err },
      "DNSBL check job failed",
    );
  });

  return worker;
}

/** Create repeatable DNSBL check jobs with tiered schedules */
export async function scheduleDnsblChecks(app: FastifyInstance) {
  const queue = new Queue("dnsbl-check-scheduled", {
    connection: app.redisWorker,
  });

  // Critical tier: every 5 minutes
  await queue.add(
    "critical-check",
    { tier: "critical" },
    {
      repeat: {
        pattern: "*/5 * * * *",
      },
    },
  );

  // High tier: every 15 minutes
  await queue.add(
    "high-check",
    { tier: "high" },
    {
      repeat: {
        pattern: "*/15 * * * *",
      },
    },
  );

  // Medium tier: every 30 minutes
  await queue.add(
    "medium-check",
    { tier: "medium" },
    {
      repeat: {
        pattern: "*/30 * * * *",
      },
    },
  );

  app.log.info("DNSBL scheduled checks configured");
}
