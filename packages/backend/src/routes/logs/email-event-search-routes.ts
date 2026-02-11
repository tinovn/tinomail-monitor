import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { EmailEventSearchQueryService } from "../../services/email-event-search-query-service.js";
import { MessageTraceQueryService } from "../../services/message-trace-query-service.js";
import {
  logSearchQuerySchema,
  messageTraceParamsSchema,
  queueTraceParamsSchema,
} from "../../schemas/log-search-validation-schemas.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function emailEventSearchRoutes(app: FastifyInstance) {
  const searchService = new EmailEventSearchQueryService(app);
  const traceService = new MessageTraceQueryService(app);

  // GET /api/v1/logs/search
  app.get(
    "/search",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = logSearchQuerySchema.parse(request.query);
      const result = await searchService.searchEmailEvents(query);

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/logs/trace/:messageId
  app.get(
    "/trace/:messageId",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = messageTraceParamsSchema.parse(request.params);
      const events = await traceService.traceByMessageId(params.messageId);

      const response: ApiResponse<typeof events> = {
        success: true,
        data: events,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/logs/trace/by-queue/:queueId
  app.get(
    "/trace/by-queue/:queueId",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = queueTraceParamsSchema.parse(request.params);
      const events = await traceService.traceByQueueId(params.queueId);

      const response: ApiResponse<typeof events> = {
        success: true,
        data: events,
      };
      reply.send(response);
    }
  );
}
