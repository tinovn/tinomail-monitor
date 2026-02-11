import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { eq } from "drizzle-orm";
import { alertEvents } from "../../db/schema/alert-events-table.js";
import { authHook } from "../../hooks/auth-hook.js";
import { alertActionBodySchema } from "../../schemas/alert-validation-schemas.js";

export default async function alertActionRoutes(app: FastifyInstance) {
  // POST /api/v1/alerts/:id/acknowledge - Acknowledge alert
  app.post<{ Params: { id: string } }>(
    "/:id/acknowledge",
    { onRequest: [authHook] },
    async (request, reply) => {
      const alertId = parseInt(request.params.id);
      const userId = (request.user as { userId: string })?.userId || "system";

      const [alert] = await app.db
        .select()
        .from(alertEvents)
        .where(eq(alertEvents.id, alertId))
        .limit(1);

      if (!alert) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Alert not found",
          },
        });
      }

      const [updated] = await app.db
        .update(alertEvents)
        .set({
          acknowledgedBy: userId,
          acknowledgedAt: new Date(),
        })
        .where(eq(alertEvents.id, alertId))
        .returning();

      // Emit Socket.IO event
      app.io.to("alerts").emit("alert:acknowledged", {
        alertId: updated.id,
        acknowledgedBy: userId,
        timestamp: updated.acknowledgedAt?.toISOString(),
      });

      const response: ApiResponse<typeof updated> = {
        success: true,
        data: updated,
      };
      reply.send(response);
    },
  );

  // POST /api/v1/alerts/:id/snooze - Snooze alert
  app.post<{ Params: { id: string } }>(
    "/:id/snooze",
    { onRequest: [authHook] },
    async (request, reply) => {
      const alertId = parseInt(request.params.id);
      const body = alertActionBodySchema.parse(request.body);

      const [alert] = await app.db
        .select()
        .from(alertEvents)
        .where(eq(alertEvents.id, alertId))
        .limit(1);

      if (!alert) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Alert not found",
          },
        });
      }

      // Calculate snooze duration
      const snoozedUntil = new Date();
      switch (body.duration) {
        case "1h":
          snoozedUntil.setHours(snoozedUntil.getHours() + 1);
          break;
        case "4h":
          snoozedUntil.setHours(snoozedUntil.getHours() + 4);
          break;
        case "24h":
          snoozedUntil.setHours(snoozedUntil.getHours() + 24);
          break;
      }

      const [updated] = await app.db
        .update(alertEvents)
        .set({ snoozedUntil })
        .where(eq(alertEvents.id, alertId))
        .returning();

      // Emit Socket.IO event
      app.io.to("alerts").emit("alert:snoozed", {
        alertId: updated.id,
        snoozedUntil: updated.snoozedUntil?.toISOString(),
      });

      const response: ApiResponse<typeof updated> = {
        success: true,
        data: updated,
      };
      reply.send(response);
    },
  );
}
