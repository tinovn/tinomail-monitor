import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { RspamdDashboardQueryService } from "../../services/rspamd-dashboard-query-service.js";
import { timeRangeQuerySchema } from "../../schemas/spam-security-validation-schemas.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function rspamdDashboardRoutes(app: FastifyInstance) {
  const rspamdService = new RspamdDashboardQueryService(app);

  // GET /api/v1/spam/rspamd/summary
  app.get(
    "/summary",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = timeRangeQuerySchema.parse(request.query);
      const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = query.to ? new Date(query.to) : new Date();

      const data = await rspamdService.getRspamdSummary(from, to);

      const response: ApiResponse<typeof data> = {
        success: true,
        data,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/spam/rspamd/trend
  app.get(
    "/trend",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = timeRangeQuerySchema.parse(request.query);
      const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = query.to ? new Date(query.to) : new Date();

      const data = await rspamdService.getRspamdTrend(from, to);

      const response: ApiResponse<typeof data> = {
        success: true,
        data,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/spam/rspamd/actions
  app.get(
    "/actions",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = timeRangeQuerySchema.parse(request.query);
      const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = query.to ? new Date(query.to) : new Date();

      const data = await rspamdService.getSpamActionBreakdown(from, to);

      const response: ApiResponse<typeof data> = {
        success: true,
        data,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/spam/rspamd/high-score-outbound
  app.get(
    "/high-score-outbound",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = timeRangeQuerySchema.parse(request.query);
      const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = query.to ? new Date(query.to) : new Date();

      const data = await rspamdService.getHighScoreOutbound(from, to);

      const response: ApiResponse<typeof data> = {
        success: true,
        data,
      };
      reply.send(response);
    }
  );
}
