import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { MongodbClusterStatusService, type MongodbNodeStatus } from "../../services/mongodb-cluster-status-service.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function mongodbClusterRoutes(app: FastifyInstance) {
  const clusterService = new MongodbClusterStatusService(app);

  // GET /api/v1/mongodb/cluster-status
  app.get("/cluster-status", { onRequest: [authHook] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const status = await clusterService.getClusterStatus();

    const response: ApiResponse<MongodbNodeStatus[]> = {
      success: true,
      data: status,
    };
    reply.send(response);
  });
}
