import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Admin auth hook - verifies JWT token and checks for admin role
 * Usage: { onRequest: [adminAuthHook] }
 */
export async function adminAuthHook(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();

    const user = request.user as { userId: number; username: string; role: string };

    if (user.role !== "admin") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Admin access required",
        },
      });
    }
  } catch (err) {
    reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or missing authentication token",
      },
    });
  }
}
