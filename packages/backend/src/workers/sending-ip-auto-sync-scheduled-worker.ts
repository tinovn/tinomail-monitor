import { Worker, Queue } from "bullmq";
import type { FastifyInstance } from "fastify";
import { sendingIps } from "../db/schema/sending-ips-table.js";

/**
 * Auto-sync worker: discovers new sending IPs from email_events
 * and registers them in the sending_ips table.
 * Runs every 5 minutes.
 */
export function createSendingIpAutoSyncWorker(app: FastifyInstance) {
  const worker = new Worker(
    "sending-ip-auto-sync",
    async () => {
      try {
        // Find distinct sending IPs from recent email events not yet in sending_ips
        const rows = await app.sql`
          SELECT DISTINCT e.sending_ip, e.mta_node
          FROM email_events e
          WHERE e.sending_ip IS NOT NULL
            AND e.time > NOW() - INTERVAL '24 hours'
            AND NOT EXISTS (
              SELECT 1 FROM sending_ips s WHERE s.ip = e.sending_ip
            )
        `;

        if (rows.length === 0) {
          return { synced: 0 };
        }

        // Insert new IPs
        const newIps = rows.map((row) => ({
          ip: String(row.sending_ip),
          ipVersion: String(row.sending_ip).includes(":") ? 6 : 4,
          nodeId: row.mta_node ? String(row.mta_node) : null,
          status: "active" as const,
        }));

        await app.db
          .insert(sendingIps)
          .values(newIps as typeof sendingIps.$inferInsert[])
          .onConflictDoNothing();

        app.log.info(
          { count: newIps.length, ips: newIps.map((ip) => ip.ip) },
          "Auto-synced new sending IPs from email_events",
        );

        return { synced: newIps.length };
      } catch (error) {
        app.log.error({ error }, "Sending IP auto-sync failed");
        throw error;
      }
    },
    {
      connection: app.redisWorker,
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    app.log.error({ jobId: job?.id, error: err }, "Sending IP auto-sync job failed");
  });

  return worker;
}

/** Schedule sending IP auto-sync every 5 minutes */
export async function scheduleSendingIpAutoSync(app: FastifyInstance) {
  const queue = new Queue("sending-ip-auto-sync", {
    connection: app.redisWorker,
  });

  // Remove any existing repeatable jobs to avoid duplicates
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }

  await queue.add(
    "sync-sending-ips",
    {},
    {
      repeat: { every: 5 * 60 * 1000 },
      removeOnComplete: 10,
      removeOnFail: 50,
    },
  );

  app.log.info("Sending IP auto-sync scheduled (every 5 min)");
  await queue.close();
}
