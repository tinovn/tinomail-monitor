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

// Agent sends { type: "system", data: { ... } } — extract .data before Zod parse
function extractPayloadData(body: unknown): unknown {
  const raw = body as Record<string, unknown>;
  return raw?.data ?? raw;
}

// Agent sends "time" field, backend schema expects "timestamp" — remap
function remapTimeField(data: unknown): unknown {
  const obj = data as Record<string, unknown>;
  if (obj?.time && !obj?.timestamp) {
    const { time, ...rest } = obj;
    return { ...rest, timestamp: time };
  }
  return obj;
}

export default async function metricsIngestionRoutes(app: FastifyInstance) {
  const metricsService = new MetricsIngestionService(app);

  // Rate limiting for agent metrics - 1000 requests per minute
  await app.register(import("@fastify/rate-limit"), {
    max: 1000,
    timeWindow: "1 minute",
  });

  // POST /api/v1/metrics/system
  app.post("/system", { onRequest: [agentAuthHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = remapTimeField(extractPayloadData(request.body));
    const body = systemMetricsSchema.parse(data);
    await metricsService.ingestSystemMetrics(body);

    const response: ApiResponse<{ received: boolean }> = {
      success: true,
      data: { received: true },
    };
    reply.status(201).send(response);
  });

  // POST /api/v1/metrics/mongodb
  app.post("/mongodb", { onRequest: [agentAuthHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = remapTimeField(extractPayloadData(request.body));
    const body = mongodbMetricsSchema.parse(data);
    await metricsService.ingestMongodbMetrics(body);

    const response: ApiResponse<{ received: boolean }> = {
      success: true,
      data: { received: true },
    };
    reply.status(201).send(response);
  });

  // POST /api/v1/metrics/redis
  app.post("/redis", { onRequest: [agentAuthHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = remapTimeField(extractPayloadData(request.body));
    const body = redisMetricsSchema.parse(data);
    await metricsService.ingestRedisMetrics(body);

    const response: ApiResponse<{ received: boolean }> = {
      success: true,
      data: { received: true },
    };
    reply.status(201).send(response);
  });

  // POST /api/v1/metrics/zonemta
  app.post("/zonemta", { onRequest: [agentAuthHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = remapTimeField(extractPayloadData(request.body));
    const body = zonemtaMetricsSchema.parse(data);
    await metricsService.ingestZonemtaMetrics(body);

    const response: ApiResponse<{ received: boolean }> = {
      success: true,
      data: { received: true },
    };
    reply.status(201).send(response);
  });

  // POST /api/v1/metrics/rspamd
  app.post("/rspamd", { onRequest: [agentAuthHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = remapTimeField(extractPayloadData(request.body));
    const body = rspamdMetricsSchema.parse(data);
    await metricsService.ingestRspamdMetrics(body);

    const response: ApiResponse<{ received: boolean }> = {
      success: true,
      data: { received: true },
    };
    reply.status(201).send(response);
  });
}
