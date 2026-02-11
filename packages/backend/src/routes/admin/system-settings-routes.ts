import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { eq } from "drizzle-orm";
import { systemSettings } from "../../db/schema/system-settings-table.js";
import { adminAuthHook } from "../../hooks/admin-auth-hook.js";
import { authHook } from "../../hooks/auth-hook.js";
import { settingsUpdateSchema } from "../../schemas/admin-validation-schemas.js";

export default async function systemSettingsRoutes(app: FastifyInstance) {
  // GET /api/v1/admin/settings - Get all settings grouped by category
  app.get("/settings", { onRequest: [authHook] }, async (_request, reply) => {
    const allSettings = await app.db.select().from(systemSettings);

    // Group by category
    const grouped = allSettings.reduce(
      (acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = [];
        }
        acc[setting.category].push({
          key: setting.key,
          value: setting.value,
          updatedAt: setting.updatedAt,
          updatedBy: setting.updatedBy,
        });
        return acc;
      },
      {} as Record<string, any[]>
    );

    const response: ApiResponse<typeof grouped> = {
      success: true,
      data: grouped,
    };
    reply.send(response);
  });

  // GET /api/v1/admin/settings/:key - Get single setting
  app.get<{ Params: { key: string } }>(
    "/settings/:key",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { key } = request.params;

      const [setting] = await app.db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key))
        .limit(1);

      if (!setting) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Setting not found",
          },
        });
      }

      const response: ApiResponse<typeof setting> = {
        success: true,
        data: setting,
      };
      reply.send(response);
    }
  );

  // PUT /api/v1/admin/settings/:key - Update setting (admin only)
  app.put<{ Params: { key: string } }>(
    "/settings/:key",
    { onRequest: [adminAuthHook] },
    async (request, reply) => {
      const { key } = request.params;
      const body = settingsUpdateSchema.parse(request.body);
      const currentUser = request.user as { username: string };

      // Validate setting-specific constraints
      if (key.includes("retention") && typeof body.value === "number" && body.value < 7) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Retention must be at least 7 days",
          },
        });
      }

      if (key.includes("interval") && typeof body.value === "number" && body.value < 10) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Collection interval must be at least 10 seconds",
          },
        });
      }

      // Check if setting exists
      const [existing] = await app.db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Setting not found",
          },
        });
      }

      // Update setting
      const [updated] = await app.db
        .update(systemSettings)
        .set({
          value: body.value as Record<string, unknown>,
          updatedAt: new Date(),
          updatedBy: currentUser.username,
        })
        .where(eq(systemSettings.key, key))
        .returning();

      const response: ApiResponse<typeof updated> = {
        success: true,
        data: updated,
      };
      reply.send(response);
    }
  );
}
