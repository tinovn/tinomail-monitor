import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { AuthMonitoringQueryService } from "../../services/auth-monitoring-query-service.js";
import { timeRangeQuerySchema } from "../../schemas/spam-security-validation-schemas.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function authMonitoringRoutes(app: FastifyInstance) {
  const authService = new AuthMonitoringQueryService(app);

  // GET /api/v1/security/auth/summary
  app.get(
    "/summary",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = timeRangeQuerySchema.parse(request.query);
      const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = query.to ? new Date(query.to) : new Date();

      const data = await authService.getAuthSummary(from, to);

      const response: ApiResponse<typeof data> = { success: true, data };
      reply.send(response);
    }
  );

  // GET /api/v1/security/auth/trend
  app.get(
    "/trend",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = timeRangeQuerySchema.parse(request.query);
      const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = query.to ? new Date(query.to) : new Date();

      const data = await authService.getAuthTrend(from, to);

      const response: ApiResponse<typeof data> = { success: true, data };
      reply.send(response);
    }
  );

  // GET /api/v1/security/auth/failed-ips
  app.get(
    "/failed-ips",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = timeRangeQuerySchema.parse(request.query);
      const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = query.to ? new Date(query.to) : new Date();

      const data = await authService.getTopFailedIps(from, to);

      const response: ApiResponse<typeof data> = { success: true, data };
      reply.send(response);
    }
  );

  // GET /api/v1/security/auth/failed-users
  app.get(
    "/failed-users",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = timeRangeQuerySchema.parse(request.query);
      const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = query.to ? new Date(query.to) : new Date();

      const data = await authService.getTopFailedUsers(from, to);

      const response: ApiResponse<typeof data> = { success: true, data };
      reply.send(response);
    }
  );

  // GET /api/v1/security/auth/brute-force
  app.get(
    "/brute-force",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = timeRangeQuerySchema.parse(request.query);
      const from = query.from ? new Date(query.from) : new Date(Date.now() - 5 * 60 * 1000);
      const to = query.to ? new Date(query.to) : new Date();

      const data = await authService.getBruteForceAlerts(from, to);

      const response: ApiResponse<typeof data> = { success: true, data };
      reply.send(response);
    }
  );
}
