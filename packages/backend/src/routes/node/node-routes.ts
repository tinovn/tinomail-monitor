import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { NodeService } from "../../services/node-service.js";
import { registerNodeSchema, updateNodeMaintenanceSchema } from "../../schemas/node-validation-schemas.js";
import { authHook } from "../../hooks/auth-hook.js";
import { agentAuthHook } from "../../hooks/agent-auth-hook.js";

export default async function nodeRoutes(app: FastifyInstance) {
  const nodeService = new NodeService(app);

  // GET /api/v1/nodes - Get all nodes (requires auth)
  app.get("/", { onRequest: [authHook] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const nodes = await nodeService.getNodes();
    const response: ApiResponse<typeof nodes> = {
      success: true,
      data: nodes,
    };
    reply.send(response);
  });

  // GET /api/v1/nodes/with-latest-metrics - Get all nodes with latest system metrics (requires auth)
  app.get("/with-latest-metrics", { onRequest: [authHook] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const nodes = await nodeService.getNodesWithLatestMetrics();
    const response: ApiResponse<typeof nodes> = {
      success: true,
      data: nodes,
    };
    reply.send(response);
  });

  // GET /api/v1/nodes/:id - Get node by ID (requires auth)
  app.get<{ Params: { id: string } }>(
    "/:id",
    { onRequest: [authHook] },
    async (request, reply) => {
      const node = await nodeService.getNodeById(request.params.id);

      if (!node) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Node not found",
          },
        });
      }

      const response: ApiResponse<typeof node> = {
        success: true,
        data: node,
      };
      reply.send(response);
    },
  );

  // POST /api/v1/nodes - Register node (agent auth)
  app.post("/", { onRequest: [agentAuthHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = registerNodeSchema.parse(request.body);
    const result = await nodeService.registerNode(body);

    if (result === "blocked") {
      return reply.status(403).send({
        success: false,
        error: { code: "BLOCKED", message: `Node ${body.nodeId} is blocked` },
      });
    }

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };
    reply.status(201).send(response);
  });

  // PUT /api/v1/nodes/:id/maintenance - Set maintenance mode (requires auth)
  app.put<{ Params: { id: string } }>(
    "/:id/maintenance",
    { onRequest: [authHook] },
    async (request, reply) => {
      const body = updateNodeMaintenanceSchema.parse(request.body);
      const node = await nodeService.setMaintenance(request.params.id, body.maintenance);

      if (!node) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Node not found",
          },
        });
      }

      const response: ApiResponse<typeof node> = {
        success: true,
        data: node,
      };
      reply.send(response);
    },
  );
}
