import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { authHook } from "../../hooks/auth-hook.js";
import {
  MongodbTimeseriesQueryService,
  type ReplEvent,
  type OplogForecast,
  type ConnectionBreakdown,
  type GridfsBreakdown,
} from "../../services/mongodb-timeseries-query-service.js";

interface ReplEventsQuery {
  from: string;
  to: string;
}

export default async function mongodbTimeseriesQueryRoutes(app: FastifyInstance) {
  const queryService = new MongodbTimeseriesQueryService(app);

  // GET /api/v1/mongodb/repl-events?from=&to=
  app.get<{ Querystring: ReplEventsQuery }>(
    "/repl-events",
    { onRequest: [authHook] },
    async (request: FastifyRequest<{ Querystring: ReplEventsQuery }>, reply: FastifyReply) => {
      const { from, to } = request.query;
      const events = await queryService.getReplEvents(from, to);

      const response: ApiResponse<ReplEvent[]> = { success: true, data: events };
      reply.send(response);
    },
  );

  // GET /api/v1/mongodb/repl-lag-sparkline
  app.get("/repl-lag-sparkline", { onRequest: [authHook] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await queryService.getReplLagSparkline();

    const response: ApiResponse<Record<string, number[]>> = { success: true, data };
    reply.send(response);
  });

  // GET /api/v1/mongodb/oplog-forecast
  app.get("/oplog-forecast", { onRequest: [authHook] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await queryService.getOplogForecast();

    const response: ApiResponse<OplogForecast> = { success: true, data };
    reply.send(response);
  });

  // GET /api/v1/mongodb/connection-breakdown
  app.get("/connection-breakdown", { onRequest: [authHook] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await queryService.getConnectionBreakdown();

    const response: ApiResponse<ConnectionBreakdown | null> = { success: true, data };
    reply.send(response);
  });

  // GET /api/v1/mongodb/gridfs-breakdown
  app.get("/gridfs-breakdown", { onRequest: [authHook] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await queryService.getGridfsBreakdown();

    const response: ApiResponse<GridfsBreakdown | null> = { success: true, data };
    reply.send(response);
  });
}
