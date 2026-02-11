import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { eq } from "drizzle-orm";
import { ipPools } from "../../db/schema/ip-pools-table.js";
import { createIpPoolSchema, updateIpPoolSchema } from "../../schemas/ip-validation-schemas.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function ipPoolRoutes(app: FastifyInstance) {
  // POST /api/v1/ips/pools - Create a new IP pool
  app.post(
    "/pools",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createIpPoolSchema.parse(request.body);

      const [pool] = await app.db
        .insert(ipPools)
        .values({
          name: body.name,
          type: body.type,
          ips: body.ips,
          description: body.description || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const response: ApiResponse<typeof pool> = {
        success: true,
        data: pool,
      };
      reply.status(201).send(response);
    }
  );

  // GET /api/v1/ips/pools - Get all IP pools
  app.get(
    "/pools",
    { onRequest: [authHook] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const pools = await app.db.select().from(ipPools);

      const response: ApiResponse<typeof pools> = {
        success: true,
        data: pools,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/ips/pools/:id - Get a specific IP pool
  app.get<{ Params: { id: string } }>(
    "/pools/:id",
    { onRequest: [authHook] },
    async (request, reply) => {
      const poolId = parseInt(request.params.id, 10);
      const [pool] = await app.db
        .select()
        .from(ipPools)
        .where(eq(ipPools.id, poolId))
        .limit(1);

      if (!pool) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "IP pool not found",
          },
        });
      }

      const response: ApiResponse<typeof pool> = {
        success: true,
        data: pool,
      };
      reply.send(response);
    }
  );

  // PUT /api/v1/ips/pools/:id - Update an IP pool
  app.put<{ Params: { id: string } }>(
    "/pools/:id",
    { onRequest: [authHook] },
    async (request, reply) => {
      const poolId = parseInt(request.params.id, 10);
      const body = updateIpPoolSchema.parse(request.body);

      const updateData: {
        name?: string;
        type?: string;
        ips?: string[];
        description?: string;
        updatedAt: Date;
      } = { updatedAt: new Date() };

      if (body.name) updateData.name = body.name;
      if (body.type) updateData.type = body.type;
      if (body.ips) updateData.ips = body.ips;
      if (body.description !== undefined) updateData.description = body.description;

      const [updated] = await app.db
        .update(ipPools)
        .set(updateData)
        .where(eq(ipPools.id, poolId))
        .returning();

      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "IP pool not found",
          },
        });
      }

      const response: ApiResponse<typeof updated> = {
        success: true,
        data: updated,
      };
      reply.send(response);
    }
  );

  // DELETE /api/v1/ips/pools/:id - Delete an IP pool
  app.delete<{ Params: { id: string } }>(
    "/pools/:id",
    { onRequest: [authHook] },
    async (request, reply) => {
      const poolId = parseInt(request.params.id, 10);
      const [deleted] = await app.db
        .delete(ipPools)
        .where(eq(ipPools.id, poolId))
        .returning();

      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "IP pool not found",
          },
        });
      }

      const response: ApiResponse<{ id: number }> = {
        success: true,
        data: { id: deleted.id },
      };
      reply.send(response);
    }
  );
}
