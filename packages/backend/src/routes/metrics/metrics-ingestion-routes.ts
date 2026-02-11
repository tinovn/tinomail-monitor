import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { MetricsIngestionService } from "../../services/metrics-ingestion-service.js";
import {
  systemMetricsSchema,
  mongodbMetricsSchema,
  redisMetricsSchema,
  zonemtaMetricsSchema,
  rspamdMetricsSchema,
} from "../../schemas/metrics-validation-schemas.js";
import { agentAuthHook } from "../../hooks/agent-auth-hook.js";

export default async function metricsIngestionRoutes(app: FastifyInstance) {
  const metricsService = new MetricsIngestionService(app);

  // Rate limiting for agent metrics - 1000 requests per minute
  await app.register(import("@fastify/rate-limit"), {
    max: 1000,
    timeWindow: "1 minute",
  });

  // POST /api/v1/metrics/system
  app.post("/system", { onRequest: [agentAuthHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = systemMetricsSchema.parse(request.body);
    await metricsService.ingestSystemMetrics(body);

    const response: ApiResponse<{ received: boolean }> = {
      success: true,
      data: { received: true },
    };
    reply.status(201).send(response);
  });

  // POST /api/v1/metrics/mongodb
  app.post("/mongodb", { onRequest: [agentAuthHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = mongodbMetricsSchema.parse(request.body);
    await metricsService.ingestMongodbMetrics(body);

    const response: ApiResponse<{ received: boolean }> = {
      success: true,
      data: { received: true },
    };
    reply.status(201).send(response);
  });

  // POST /api/v1/metrics/redis
  app.post("/redis", { onRequest: [agentAuthHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = redisMetricsSchema.parse(request.body);
    await metricsService.ingestRedisMetrics(body);

    const response: ApiResponse<{ received: boolean }> = {
      success: true,
      data: { received: true },
    };
    reply.status(201).send(response);
  });

  // POST /api/v1/metrics/zonemta
  app.post("/zonemta", { onRequest: [agentAuthHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = zonemtaMetricsSchema.parse(request.body);
    await metricsService.ingestZonemtaMetrics(body);

    const response: ApiResponse<{ received: boolean }> = {
      success: true,
      data: { received: true },
    };
    reply.status(201).send(response);
  });

  // POST /api/v1/metrics/rspamd
  app.post("/rspamd", { onRequest: [agentAuthHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = rspamdMetricsSchema.parse(request.body);
    await metricsService.ingestRspamdMetrics(body);

    const response: ApiResponse<{ received: boolean }> = {
      success: true,
      data: { received: true },
    };
    reply.status(201).send(response);
  });
}
