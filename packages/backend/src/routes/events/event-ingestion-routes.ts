import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { Queue } from "bullmq";
import { emailEventIngestSchema } from "../../schemas/email-event-validation-schemas.js";
import { agentAuthHook } from "../../hooks/agent-auth-hook.js";

export default async function eventIngestionRoutes(app: FastifyInstance) {
  // BullMQ queue for email events
  const emailEventsQueue = new Queue("email-events", {
    connection: app.redisWorker,
  });

  // Rate limiting for webhook ingestion - 10K requests per minute
  await app.register(import("@fastify/rate-limit"), {
    max: 10000,
    timeWindow: "1 minute",
  });

  // POST /api/v1/events/ingest
  app.post(
    "/ingest",
    { onRequest: [agentAuthHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const validated = emailEventIngestSchema.parse(request.body);
      const events = Array.isArray(validated) ? validated : [validated];

      // Auto-extract fromDomain/fromUser from fromAddress if not provided
      for (const event of events) {
        if (event.fromAddress && event.fromAddress.includes("@")) {
          const [user, domain] = event.fromAddress.split("@");
          if (!event.fromDomain) event.fromDomain = domain;
          if (!event.fromUser) event.fromUser = user;
        }
        // Also extract toDomain from toAddress if not provided
        if (event.toAddress && event.toAddress.includes("@") && !event.toDomain) {
          event.toDomain = event.toAddress.split("@")[1];
        }
      }

      // Enqueue all events to BullMQ with priority based on event type
      const jobs = events.map((event) => {
        const priority = getPriority(event.eventType);
        return emailEventsQueue.add("process-email-event", event, {
          priority,
          removeOnComplete: 1000,
          removeOnFail: 5000,
        });
      });

      await Promise.all(jobs);

      const response: ApiResponse<{ queued: number }> = {
        success: true,
        data: { queued: events.length },
      };

      reply.status(202).send(response);
    }
  );
}

/** Priority mapping: higher = more urgent */
function getPriority(eventType: string): number {
  const priorities: Record<string, number> = {
    bounced: 1,
    rejected: 2,
    deferred: 3,
    delivered: 5,
    sent: 5,
    received: 4,
  };
  return priorities[eventType] || 3;
}
