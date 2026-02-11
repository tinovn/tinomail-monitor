import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { eq, and } from "drizzle-orm";
import { savedViews } from "../../db/schema/saved-views-table.js";
import {
  savedSearchBodySchema,
  savedSearchIdSchema,
} from "../../schemas/log-search-validation-schemas.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function savedSearchRoutes(app: FastifyInstance) {
  // POST /api/v1/logs/saved-searches
  app.post(
    "/saved-searches",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = savedSearchBodySchema.parse(request.body);
      const userId = (request.user as any)?.userId;

      const [savedSearch] = await app.db
        .insert(savedViews)
        .values({
          userId,
          name: body.name,
          config: { type: "search", ...body.config },
          isDefault: body.isDefault || false,
        })
        .returning();

      const response: ApiResponse<typeof savedSearch> = {
        success: true,
        data: savedSearch,
      };
      reply.status(201).send(response);
    }
  );

  // GET /api/v1/logs/saved-searches
  app.get(
    "/saved-searches",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any)?.userId;

      const searches = await app.db
        .select()
        .from(savedViews)
        .where(eq(savedViews.userId, userId));

      const response: ApiResponse<typeof searches> = {
        success: true,
        data: searches,
      };
      reply.send(response);
    }
  );

  // DELETE /api/v1/logs/saved-searches/:id
  app.delete(
    "/saved-searches/:id",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = savedSearchIdSchema.parse(request.params);
      const userId = (request.user as any)?.userId;

      await app.db
        .delete(savedViews)
        .where(and(eq(savedViews.id, params.id), eq(savedViews.userId, userId)));

      const response: ApiResponse<{ deleted: boolean }> = {
        success: true,
        data: { deleted: true },
      };
      reply.send(response);
    }
  );
}
