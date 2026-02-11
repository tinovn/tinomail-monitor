import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { AuthService } from "../../services/auth-service.js";
import { loginSchema, refreshTokenSchema } from "../../schemas/auth-validation-schemas.js";

export default async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(app);

  // Rate limiting for auth routes - 100 requests per minute
  await app.register(import("@fastify/rate-limit"), {
    max: 100,
    timeWindow: "1 minute",
  });

  // POST /api/v1/auth/login
  app.post(
    "/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string" },
            password: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = loginSchema.parse(request.body);
      const tokens = await authService.login(body.username, body.password);

      if (!tokens) {
        return reply.status(401).send({
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid username or password",
          },
        });
      }

      const response: ApiResponse<typeof tokens> = {
        success: true,
        data: tokens,
      };

      reply.send(response);
    },
  );

  // POST /api/v1/auth/refresh
  app.post("/refresh", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = refreshTokenSchema.parse(request.body);
    const tokens = await authService.refreshToken(body.refreshToken);

    if (!tokens) {
      return reply.status(401).send({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid or expired refresh token",
        },
      });
    }

    const response: ApiResponse<typeof tokens> = {
      success: true,
      data: tokens,
    };

    reply.send(response);
  });
}
