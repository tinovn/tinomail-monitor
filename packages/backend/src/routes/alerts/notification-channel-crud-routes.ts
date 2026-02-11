import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { eq } from "drizzle-orm";
import { notificationChannels } from "../../db/schema/notification-channels-table.js";
import { authHook } from "../../hooks/auth-hook.js";
import { notificationChannelBodySchema } from "../../schemas/alert-validation-schemas.js";
import { AlertNotificationDispatchService } from "../../services/alert-notification-dispatch-service.js";

export default async function notificationChannelCrudRoutes(app: FastifyInstance) {
  const notificationService = new AlertNotificationDispatchService(app);

  // GET /api/v1/alerts/channels - List channels
  app.get("/channels", { onRequest: [authHook] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const channels = await app.db.select().from(notificationChannels);

    const response: ApiResponse<typeof channels> = {
      success: true,
      data: channels,
    };
    reply.send(response);
  });

  // POST /api/v1/alerts/channels - Create channel
  app.post("/channels", { onRequest: [authHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = notificationChannelBodySchema.parse(request.body);

    const [channel] = await app.db
      .insert(notificationChannels)
      .values({
        type: body.type,
        name: body.name,
        config: body.config,
        enabled: body.enabled,
      })
      .returning();

    const response: ApiResponse<typeof channel> = {
      success: true,
      data: channel,
    };
    reply.status(201).send(response);
  });

  // PUT /api/v1/alerts/channels/:id - Update channel
  app.put<{ Params: { id: string } }>(
    "/channels/:id",
    { onRequest: [authHook] },
    async (request, reply) => {
      const channelId = parseInt(request.params.id);
      const body = notificationChannelBodySchema.parse(request.body);

      const [updated] = await app.db
        .update(notificationChannels)
        .set({
          type: body.type,
          name: body.name,
          config: body.config,
          enabled: body.enabled,
        })
        .where(eq(notificationChannels.id, channelId))
        .returning();

      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Notification channel not found",
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

  // DELETE /api/v1/alerts/channels/:id - Delete channel
  app.delete<{ Params: { id: string } }>(
    "/channels/:id",
    { onRequest: [authHook] },
    async (request, reply) => {
      const channelId = parseInt(request.params.id);

      const [deleted] = await app.db
        .delete(notificationChannels)
        .where(eq(notificationChannels.id, channelId))
        .returning();

      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Notification channel not found",
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

  // POST /api/v1/alerts/channels/:id/test - Send test notification
  app.post<{ Params: { id: string } }>(
    "/channels/:id/test",
    { onRequest: [authHook] },
    async (request, reply) => {
      const channelId = parseInt(request.params.id);

      const [channel] = await app.db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.id, channelId))
        .limit(1);

      if (!channel) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Notification channel not found",
          },
        });
      }

      // Send test alert
      const testAlert = {
        id: 0,
        severity: "info",
        message: "Test notification from TinoMail Monitor",
        details: { test: true },
        nodeId: "test-node",
        firedAt: new Date(),
      };

      try {
        const results = await notificationService.sendNotification(testAlert, [channel.name]);

        const response: ApiResponse<typeof results> = {
          success: true,
          data: results,
        };
        reply.send(response);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          success: false,
          error: {
            code: "TEST_FAILED",
            message: errorMsg,
          },
        });
      }
    },
  );
}
