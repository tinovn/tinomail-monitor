import { Worker, Queue } from "bullmq";
import type { FastifyInstance } from "fastify";
import { sendingDomains } from "../db/schema/sending-domains-table.js";
import { DomainDnsCheckService } from "../services/domain-dns-check-service.js";

/**
 * Auto-sync worker: discovers new sending domains from email_events,
 * registers them in the sending_domains table, and runs DNS checks
 * for DKIM/SPF/DMARC on newly discovered domains.
 * Runs every 5 minutes.
 */
export function createSendingDomainAutoSyncWorker(app: FastifyInstance) {
  const dnsCheckService = new DomainDnsCheckService(app);

  const worker = new Worker(
    "sending-domain-auto-sync",
    async () => {
      try {
        // Find distinct from_domain values from recent email events not yet in sending_domains
        const rows = await app.sql`
          SELECT DISTINCT e.from_domain
          FROM email_events e
          WHERE e.from_domain IS NOT NULL
            AND e.from_domain != ''
            AND e.time > NOW() - INTERVAL '24 hours'
            AND NOT EXISTS (
              SELECT 1 FROM sending_domains s WHERE s.domain = e.from_domain
            )
        `;

        if (rows.length === 0) {
          return { synced: 0 };
        }

        // Insert new domains
        const newDomains = rows.map((row) => ({
          domain: String(row.from_domain),
          status: "active" as const,
        }));

        await app.db
          .insert(sendingDomains)
          .values(newDomains as typeof sendingDomains.$inferInsert[])
          .onConflictDoNothing();

        app.log.info(
          { count: newDomains.length, domains: newDomains.map((d) => d.domain) },
          "Auto-synced new sending domains from email_events",
        );

        // Run DNS checks on newly discovered domains
        for (const d of newDomains) {
          try {
            await dnsCheckService.checkAndUpdateDomain(d.domain);
          } catch (error) {
            app.log.warn({ domain: d.domain, error }, "DNS check failed for new domain");
          }
        }

        // Invalidate health scores cache since new domains added
        await app.redis.del("domains:health:all");

        return { synced: newDomains.length };
      } catch (error) {
        app.log.error({ error }, "Sending domain auto-sync failed");
        throw error;
      }
    },
    {
      connection: app.redisWorker,
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    app.log.error({ jobId: job?.id, error: err }, "Sending domain auto-sync job failed");
  });

  return worker;
}

/** Schedule sending domain auto-sync every 5 minutes */
export async function scheduleSendingDomainAutoSync(app: FastifyInstance) {
  const queue = new Queue("sending-domain-auto-sync", {
    connection: app.redisWorker,
  });

  // Remove any existing repeatable jobs to avoid duplicates
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }

  await queue.add(
    "sync-sending-domains",
    {},
    {
      repeat: { every: 5 * 60 * 1000 },
      removeOnComplete: 10,
      removeOnFail: 50,
    },
  );

  app.log.info("Sending domain auto-sync scheduled (every 5 min)");
  await queue.close();
}
