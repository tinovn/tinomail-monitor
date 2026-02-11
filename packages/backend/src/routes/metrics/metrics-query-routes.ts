import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { MetricsQueryService } from "../../services/metrics-query-service.js";
import { timeRangeQuerySchema } from "../../schemas/metrics-validation-schemas.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function metricsQueryRoutes(app: FastifyInstance) {
  const metricsQuery = new MetricsQueryService(app);

  // GET /api/v1/metrics/system
  app.get("/system", { onRequest: [authHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = timeRangeQuerySchema.parse(request.query);
    const metrics = await metricsQuery.querySystemMetrics(query);

    const response: ApiResponse<typeof metrics> = {
      success: true,
      data: metrics,
    };
    reply.send(response);
  });

  // GET /api/v1/metrics/mongodb
  app.get("/mongodb", { onRequest: [authHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = timeRangeQuerySchema.parse(request.query);
    const metrics = await metricsQuery.queryMongodbMetrics(query);

    const response: ApiResponse<typeof metrics> = {
      success: true,
      data: metrics,
    };
    reply.send(response);
  });

  // GET /api/v1/metrics/redis
  app.get("/redis", { onRequest: [authHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = timeRangeQuerySchema.parse(request.query);
    const metrics = await metricsQuery.queryRedisMetrics(query);

    const response: ApiResponse<typeof metrics> = {
      success: true,
      data: metrics,
    };
    reply.send(response);
  });

  // GET /api/v1/metrics/zonemta
  app.get("/zonemta", { onRequest: [authHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = timeRangeQuerySchema.parse(request.query);
    const metrics = await metricsQuery.queryZonemtaMetrics(query);

    const response: ApiResponse<typeof metrics> = {
      success: true,
      data: metrics,
    };
    reply.send(response);
  });

  // GET /api/v1/metrics/rspamd
  app.get("/rspamd", { onRequest: [authHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = timeRangeQuerySchema.parse(request.query);
    const metrics = await metricsQuery.queryRspamdMetrics(query);

    const response: ApiResponse<typeof metrics> = {
      success: true,
      data: metrics,
    };
    reply.send(response);
  });
}
