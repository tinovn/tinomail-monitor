import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { adminAuthHook } from "../../hooks/admin-auth-hook.js";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { nodes } from "../../db/schema/nodes-table.js";

const nodeIdParamsSchema = z.object({
  nodeId: z.string().min(1),
});

export default async function agentUpdateRequestRoutes(app: FastifyInstance) {
  // POST /api/v1/admin/nodes/:nodeId/request-update
  // Admin triggers agent update — sets flag, agent picks it up on next check
  app.post(
    "/nodes/:nodeId/request-update",
    { onRequest: [adminAuthHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { nodeId } = nodeIdParamsSchema.parse(request.params);

      const [updated] = await app.db
        .update(nodes)
        .set({ updateRequested: true })
        .where(eq(nodes.id, nodeId))
        .returning({ id: nodes.id, updateRequested: nodes.updateRequested });

      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: `Node ${nodeId} not found` },
        });
      }

      const response: ApiResponse<{ nodeId: string; updateRequested: boolean }> = {
        success: true,
        data: { nodeId: updated.id, updateRequested: updated.updateRequested ?? true },
      };
      reply.send(response);
    },
  );
}
