import type { FastifyRequest, FastifyReply } from "fastify";

// Extend FastifyRequest to include agent info
declare module "fastify" {
  interface FastifyRequest {
    agentId?: string;
  }
}

/**
 * Agent auth hook - verifies API key from x-api-key header
 * Usage: { onRequest: [agentAuthHook] }
 *
 * In production, API keys should be stored in database and hashed.
 * For now, we use a simple env variable check.
 */
export async function agentAuthHook(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers["x-api-key"] as string;

  if (!apiKey) {
    return reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing x-api-key header",
      },
    });
  }

  // Validate agent API key
  const validKey = request.server.config.AGENT_API_KEY;
  if (request.server.config.NODE_ENV === "production" && apiKey !== validKey) {
    return reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid API key",
      },
    });
  }

  // Store agent ID from request body or generate from IP
  request.agentId = apiKey;
}
