import { Worker, Queue } from "bullmq";
import type { FastifyInstance } from "fastify";
import { DomainDnsCheckService } from "../services/domain-dns-check-service.js";

/**
 * Periodic DNS re-check worker: re-checks DKIM/SPF/DMARC records
 * for all sending domains and updates the database.
 * Runs every 6 hours.
 */
export function createDomainDnsRecheckWorker(app: FastifyInstance) {
  const dnsCheckService = new DomainDnsCheckService(app);

  const worker = new Worker(
    "domain-dns-recheck",
    async () => {
      try {
        const result = await dnsCheckService.checkAndUpdateAllDomains();

        app.log.info(
          { checked: result.checked, updated: result.updated },
          "Domain DNS re-check completed",
        );

        return result;
      } catch (error) {
        app.log.error({ error }, "Domain DNS re-check failed");
        throw error;
      }
    },
    {
      connection: app.redisWorker,
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    app.log.error({ jobId: job?.id, error: err }, "Domain DNS re-check job failed");
  });

  return worker;
}

/** Schedule domain DNS re-check every 6 hours */
export async function scheduleDomainDnsRecheck(app: FastifyInstance) {
  const queue = new Queue("domain-dns-recheck", {
    connection: app.redisWorker,
  });

  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }

  await queue.add(
    "recheck-domain-dns",
    {},
    {
      repeat: { every: 6 * 60 * 60 * 1000 },
      removeOnComplete: 5,
      removeOnFail: 10,
    },
  );

  app.log.info("Domain DNS re-check scheduled (every 6 hours)");
  await queue.close();
}
