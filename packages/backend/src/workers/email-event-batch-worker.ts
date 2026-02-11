import type { Job } from "bullmq";
import { Worker } from "bullmq";
import type { FastifyInstance } from "fastify";
import type { EmailEvent } from "../schemas/email-event-validation-schemas.js";
import { emailEvents } from "../db/schema/email-events-hypertable.js";

export function createEmailEventBatchWorker(app: FastifyInstance) {
  const worker = new Worker<EmailEvent>(
    "email-events",
    async (job: Job<EmailEvent>) => {
      const events: EmailEvent[] = [job.data];

      // Batch accumulation: collect more jobs if available (up to 100 or 1s timeout)
      const batchStartTime = Date.now();
      const maxBatchSize = 100;
      const maxWaitMs = 1000;

      while (
        events.length < maxBatchSize &&
        Date.now() - batchStartTime < maxWaitMs
      ) {
        const nextJob = await worker.getNextJob(job.token!);
        if (!nextJob) break;
        events.push(nextJob.data);
        await nextJob.moveToCompleted("batched", job.token!, false);
      }

      // Bulk insert into email_events hypertable
      try {
        const values = events.map((event) => ({
          time: new Date(event.time),
          eventType: event.eventType,
          messageId: event.messageId || null,
          queueId: event.queueId || null,
          fromAddress: event.fromAddress || null,
          fromUser: event.fromUser || null,
          fromDomain: event.fromDomain || null,
          toAddress: event.toAddress || null,
          toDomain: event.toDomain || null,
          mtaNode: event.mtaNode || null,
          sendingIp: event.sendingIp || null,
          sendingIpV6: event.sendingIpV6 || null,
          mxHost: event.mxHost || null,
          statusCode: event.statusCode || null,
          statusMessage: event.statusMessage || null,
          deliveryTimeMs: event.deliveryTimeMs || null,
          queueTimeMs: event.queueTimeMs || null,
          totalTimeMs: event.totalTimeMs || null,
          bounceType: event.bounceType || null,
          bounceCategory: event.bounceCategory || null,
          bounceMessage: event.bounceMessage || null,
          messageSize: event.messageSize || null,
          dkimResult: event.dkimResult || null,
          spfResult: event.spfResult || null,
          dmarcResult: event.dmarcResult || null,
          spamScore: event.spamScore || null,
          spamAction: event.spamAction || null,
        }));

        await app.db.insert(emailEvents).values(values);

        // Broadcast updated counters via Socket.IO
        const counters = aggregateCounters(events);
        app.io.to("email-flow").emit("email:throughput", counters);

        app.log.info(
          { batchSize: events.length },
          "Email events batch inserted"
        );

        return { inserted: events.length };
      } catch (error) {
        app.log.error({ error, batchSize: events.length }, "Batch insert failed");
        throw error;
      }
    },
    {
      connection: app.redisWorker,
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  );

  worker.on("completed", (job) => {
    app.log.debug({ jobId: job.id }, "Email event job completed");
  });

  worker.on("failed", (job, err) => {
    app.log.error({ jobId: job?.id, error: err }, "Email event job failed");
  });

  return worker;
}

/** Aggregate event counters for real-time broadcast */
function aggregateCounters(events: EmailEvent[]) {
  const counters: Record<string, number> = {
    delivered: 0,
    bounced: 0,
    deferred: 0,
    rejected: 0,
    received: 0,
    sent: 0,
  };

  for (const event of events) {
    counters[event.eventType] = (counters[event.eventType] || 0) + 1;
  }

  return counters;
}
