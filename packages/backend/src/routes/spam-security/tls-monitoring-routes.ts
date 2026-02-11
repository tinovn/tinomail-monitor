import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { TlsMonitoringQueryService } from "../../services/tls-monitoring-query-service.js";
import { timeRangeQuerySchema } from "../../schemas/spam-security-validation-schemas.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function tlsMonitoringRoutes(app: FastifyInstance) {
  const tlsService = new TlsMonitoringQueryService(app);

  // GET /api/v1/security/tls/summary
  app.get(
    "/summary",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = timeRangeQuerySchema.parse(request.query);
      const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = query.to ? new Date(query.to) : new Date();

      const data = await tlsService.getTlsSummary(from, to);

      const response: ApiResponse<typeof data> = { success: true, data };
      reply.send(response);
    }
  );

  // GET /api/v1/security/tls/versions
  app.get(
    "/versions",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = timeRangeQuerySchema.parse(request.query);
      const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = query.to ? new Date(query.to) : new Date();

      const data = await tlsService.getTlsVersionDistribution(from, to);

      const response: ApiResponse<typeof data> = { success: true, data };
      reply.send(response);
    }
  );
}
