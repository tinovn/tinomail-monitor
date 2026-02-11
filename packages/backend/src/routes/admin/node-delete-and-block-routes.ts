import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { adminAuthHook } from "../../hooks/admin-auth-hook.js";
import { NodeService } from "../../services/node-service.js";
import { z } from "zod";

const nodeIdParamsSchema = z.object({
  nodeId: z.string().min(1),
});

const blockBodySchema = z.object({
  blocked: z.boolean(),
});

export default async function nodeDeleteAndBlockRoutes(app: FastifyInstance) {
  const nodeService = new NodeService(app);

  // DELETE /api/v1/admin/nodes/:nodeId — remove node record
  app.delete<{ Params: { nodeId: string } }>(
    "/nodes/:nodeId",
    { onRequest: [adminAuthHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { nodeId } = nodeIdParamsSchema.parse(request.params);
      const deleted = await nodeService.deleteNode(nodeId);

      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: `Node ${nodeId} not found` },
        });
      }

      const response: ApiResponse<{ nodeId: string }> = {
        success: true,
        data: { nodeId },
      };
      reply.send(response);
    },
  );

  // PUT /api/v1/admin/nodes/:nodeId/block — toggle block status
  app.put<{ Params: { nodeId: string } }>(
    "/nodes/:nodeId/block",
    { onRequest: [adminAuthHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { nodeId } = nodeIdParamsSchema.parse(request.params);
      const { blocked } = blockBodySchema.parse(request.body);
      const node = await nodeService.setBlocked(nodeId, blocked);

      if (!node) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: `Node ${nodeId} not found` },
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
