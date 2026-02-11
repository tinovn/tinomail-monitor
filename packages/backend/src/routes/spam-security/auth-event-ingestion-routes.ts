import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { authEventIngestSchema } from "../../schemas/spam-security-validation-schemas.js";
import { authEvents } from "../../db/schema/auth-events-hypertable.js";
import { agentAuthHook } from "../../hooks/agent-auth-hook.js";

export default async function authEventIngestionRoutes(app: FastifyInstance) {
  // POST /api/v1/security/auth/events
  app.post(
    "/events",
    { onRequest: [agentAuthHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = authEventIngestSchema.parse(request.body);
      const events = Array.isArray(body) ? body : [body];

      // Batch insert auth events
      const rows = events.map((event) => ({
        time: new Date(event.time),
        nodeId: event.nodeId,
        username: event.username,
        sourceIp: event.sourceIp,
        success: event.success,
        failureReason: event.failureReason || null,
      }));

      await app.db.insert(authEvents).values(rows);

      const response: ApiResponse<{ received: number }> = {
        success: true,
        data: { received: events.length },
      };
      reply.status(201).send(response);
    }
  );
}
