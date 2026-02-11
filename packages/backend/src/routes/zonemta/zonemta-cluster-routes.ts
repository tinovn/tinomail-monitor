import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { ZonemtaClusterQueryService } from "../../services/zonemta-cluster-query-service.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function zonemtaClusterRoutes(app: FastifyInstance) {
  const service = new ZonemtaClusterQueryService(app);

  // GET /api/v1/zonemta/nodes - Get all MTA nodes with stats
  app.get(
    "/nodes",
    { onRequest: [authHook] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const nodes = await service.getMtaNodes();
      const response: ApiResponse<typeof nodes> = {
        success: true,
        data: nodes,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/zonemta/nodes/:id/performance - Get performance metrics for a node
  app.get<{ Params: { id: string }; Querystring: { hours?: string } }>(
    "/nodes/:id/performance",
    { onRequest: [authHook] },
    async (request, reply) => {
      const hours = request.query.hours ? parseInt(request.query.hours, 10) : 24;
      const performance = await service.getNodePerformance(request.params.id, hours);

      if (!performance) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "MTA node not found",
          },
        });
      }

      const response: ApiResponse<typeof performance> = {
        success: true,
        data: performance,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/zonemta/nodes/:id/ips - Get IPs for a node with enriched stats
  app.get<{
    Params: { id: string };
    Querystring: {
      status?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      limit?: string;
      offset?: string;
    };
  }>(
    "/nodes/:id/ips",
    { onRequest: [authHook] },
    async (request, reply) => {
      const options = {
        status: request.query.status,
        search: request.query.search,
        sortBy: request.query.sortBy,
        sortOrder: request.query.sortOrder,
        limit: request.query.limit ? parseInt(request.query.limit, 10) : 254,
        offset: request.query.offset ? parseInt(request.query.offset, 10) : 0,
      };

      const ips = await service.getNodeIps(request.params.id, options);
      const response: ApiResponse<typeof ips> = {
        success: true,
        data: ips,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/zonemta/nodes/:id/destinations - Get destination quality breakdown
  app.get<{ Params: { id: string }; Querystring: { hours?: string } }>(
    "/nodes/:id/destinations",
    { onRequest: [authHook] },
    async (request, reply) => {
      const hours = request.query.hours ? parseInt(request.query.hours, 10) : 24;
      const destinations = await service.getNodeDestinations(request.params.id, hours);

      const response: ApiResponse<typeof destinations> = {
        success: true,
        data: destinations,
      };
      reply.send(response);
    }
  );
}
