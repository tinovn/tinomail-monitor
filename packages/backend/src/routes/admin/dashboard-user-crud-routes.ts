import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { eq } from "drizzle-orm";
import { dashboardUsers } from "../../db/schema/dashboard-users-table.js";
import { adminAuthHook } from "../../hooks/admin-auth-hook.js";
import { AuthService } from "../../services/auth-service.js";
import {
  dashboardUserBodySchema,
  dashboardUserUpdateSchema,
  passwordResetSchema,
} from "../../schemas/admin-validation-schemas.js";

export default async function dashboardUserCrudRoutes(app: FastifyInstance) {
  const authService = new AuthService(app);

  // GET /api/v1/admin/users - List all dashboard users
  app.get("/users", { onRequest: [adminAuthHook] }, async (_request, reply) => {
    const users = await app.db
      .select({
        id: dashboardUsers.id,
        username: dashboardUsers.username,
        email: dashboardUsers.email,
        role: dashboardUsers.role,
        telegramId: dashboardUsers.telegramId,
        createdAt: dashboardUsers.createdAt,
      })
      .from(dashboardUsers);

    const response: ApiResponse<typeof users> = {
      success: true,
      data: users,
    };
    reply.send(response);
  });

  // POST /api/v1/admin/users - Create new user
  app.post(
    "/users",
    { onRequest: [adminAuthHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = dashboardUserBodySchema.parse(request.body);

      // Check if username already exists
      const [existing] = await app.db
        .select()
        .from(dashboardUsers)
        .where(eq(dashboardUsers.username, body.username))
        .limit(1);

      if (existing) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "USERNAME_EXISTS",
            message: "Username already exists",
          },
        });
      }

      // Hash password
      const passwordHash = await authService.hashPassword(body.password);

      // Create user
      const [user] = await app.db
        .insert(dashboardUsers)
        .values({
          username: body.username,
          email: body.email,
          passwordHash,
          role: body.role,
        })
        .returning({
          id: dashboardUsers.id,
          username: dashboardUsers.username,
          email: dashboardUsers.email,
          role: dashboardUsers.role,
          createdAt: dashboardUsers.createdAt,
        });

      const response: ApiResponse<typeof user> = {
        success: true,
        data: user,
      };
      reply.status(201).send(response);
    }
  );

  // PUT /api/v1/admin/users/:id - Update user
  app.put<{ Params: { id: string } }>(
    "/users/:id",
    { onRequest: [adminAuthHook] },
    async (request, reply) => {
      const userId = parseInt(request.params.id);
      const body = dashboardUserUpdateSchema.parse(request.body);

      // Check if user exists
      const [existing] = await app.db
        .select()
        .from(dashboardUsers)
        .where(eq(dashboardUsers.id, userId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "User not found",
          },
        });
      }

      // Update user
      const [updated] = await app.db
        .update(dashboardUsers)
        .set({
          email: body.email,
          role: body.role,
        })
        .where(eq(dashboardUsers.id, userId))
        .returning({
          id: dashboardUsers.id,
          username: dashboardUsers.username,
          email: dashboardUsers.email,
          role: dashboardUsers.role,
          createdAt: dashboardUsers.createdAt,
        });

      const response: ApiResponse<typeof updated> = {
        success: true,
        data: updated,
      };
      reply.send(response);
    }
  );

  // DELETE /api/v1/admin/users/:id - Delete user
  app.delete<{ Params: { id: string } }>(
    "/users/:id",
    { onRequest: [adminAuthHook] },
    async (request, reply) => {
      const userId = parseInt(request.params.id);

      // Prevent deleting self
      const currentUser = request.user as { userId: number };
      if (currentUser.userId === userId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "Cannot delete your own account",
          },
        });
      }

      const [deleted] = await app.db
        .delete(dashboardUsers)
        .where(eq(dashboardUsers.id, userId))
        .returning({ id: dashboardUsers.id });

      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "User not found",
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

  // POST /api/v1/admin/users/:id/reset-password - Reset user password
  app.post<{ Params: { id: string } }>(
    "/users/:id/reset-password",
    { onRequest: [adminAuthHook] },
    async (request, reply) => {
      const userId = parseInt(request.params.id);
      const body = passwordResetSchema.parse(request.body);

      // Check if user exists
      const [existing] = await app.db
        .select()
        .from(dashboardUsers)
        .where(eq(dashboardUsers.id, userId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "User not found",
          },
        });
      }

      // Hash new password
      const passwordHash = await authService.hashPassword(body.newPassword);

      // Update password
      await app.db
        .update(dashboardUsers)
        .set({ passwordHash })
        .where(eq(dashboardUsers.id, userId));

      const response: ApiResponse<{ success: boolean }> = {
        success: true,
        data: { success: true },
      };
      reply.send(response);
    }
  );
}
