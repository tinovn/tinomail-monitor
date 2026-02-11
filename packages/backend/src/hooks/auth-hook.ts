import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Auth hook - verifies JWT token and decorates request with user data
 * Usage: { onRequest: [authHook] }
 */
export async function authHook(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
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
