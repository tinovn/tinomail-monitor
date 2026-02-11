import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { eq } from "drizzle-orm";
import { alertRules } from "../../db/schema/alert-rules-table.js";
import { authHook } from "../../hooks/auth-hook.js";
import { alertRuleBodySchema } from "../../schemas/alert-validation-schemas.js";

export default async function alertRuleCrudRoutes(app: FastifyInstance) {
  // GET /api/v1/alerts/rules - List all rules
  app.get("/rules", { onRequest: [authHook] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const rules = await app.db.select().from(alertRules);

    const response: ApiResponse<typeof rules> = {
      success: true,
      data: rules,
    };
    reply.send(response);
  });

  // POST /api/v1/alerts/rules - Create rule
  app.post("/rules", { onRequest: [authHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = alertRuleBodySchema.parse(request.body);

    const [rule] = await app.db
      .insert(alertRules)
      .values({
        name: body.name,
        description: body.description,
        severity: body.severity,
        condition: body.condition,
        threshold: body.threshold,
        duration: body.duration,
        channels: body.channels,
        enabled: body.enabled,
        cooldown: body.cooldown,
      })
      .returning();

    const response: ApiResponse<typeof rule> = {
      success: true,
      data: rule,
    };
    reply.status(201).send(response);
  });

  // PUT /api/v1/alerts/rules/:id - Update rule
  app.put<{ Params: { id: string } }>(
    "/rules/:id",
    { onRequest: [authHook] },
    async (request, reply) => {
      const ruleId = parseInt(request.params.id);
      const body = alertRuleBodySchema.parse(request.body);

      const [updated] = await app.db
        .update(alertRules)
        .set({
          name: body.name,
          description: body.description,
          severity: body.severity,
          condition: body.condition,
          threshold: body.threshold,
          duration: body.duration,
          channels: body.channels,
          enabled: body.enabled,
          cooldown: body.cooldown,
        })
        .where(eq(alertRules.id, ruleId))
        .returning();

      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Alert rule not found",
          },
        });
      }

      const response: ApiResponse<typeof updated> = {
        success: true,
        data: updated,
      };
      reply.send(response);
    },
  );

  // DELETE /api/v1/alerts/rules/:id - Delete rule
  app.delete<{ Params: { id: string } }>(
    "/rules/:id",
    { onRequest: [authHook] },
    async (request, reply) => {
      const ruleId = parseInt(request.params.id);

      const [deleted] = await app.db
        .delete(alertRules)
        .where(eq(alertRules.id, ruleId))
        .returning();

      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Alert rule not found",
          },
        });
      }

      const response: ApiResponse<{ id: number }> = {
        success: true,
        data: { id: deleted.id },
      };
      reply.send(response);
    },
  );

  // PUT /api/v1/alerts/rules/:id/toggle - Enable/disable rule
  app.put<{ Params: { id: string } }>(
    "/rules/:id/toggle",
    { onRequest: [authHook] },
    async (request, reply) => {
      const ruleId = parseInt(request.params.id);

      // Get current state
      const [current] = await app.db
        .select()
        .from(alertRules)
        .where(eq(alertRules.id, ruleId))
        .limit(1);

      if (!current) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Alert rule not found",
          },
        });
      }

      // Toggle
      const [updated] = await app.db
        .update(alertRules)
        .set({ enabled: !current.enabled })
        .where(eq(alertRules.id, ruleId))
        .returning();

      const response: ApiResponse<typeof updated> = {
        success: true,
        data: updated,
      };
      reply.send(response);
    },
  );
}
