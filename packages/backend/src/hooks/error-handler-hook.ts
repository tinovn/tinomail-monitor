import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import type { ApiError } from "@tinomail/shared";

export default function errorHandlerHook(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Log the error
  request.log.error(
    {
      err: error,
      url: request.url,
      method: request.method,
    },
    "Request error",
  );

  // Validation errors (from Zod or Fastify schema)
  if (error.validation) {
    const errorResponse: ApiError = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: error.validation,
      },
    };
    return reply.status(400).send(errorResponse);
  }

  // JWT authentication errors
  if (error.statusCode === 401 || error.message.includes("token") || error.message.includes("authorized")) {
    const errorResponse: ApiError = {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: error.message || "Authentication required",
      },
    };
    return reply.status(401).send(errorResponse);
  }

  // Rate limit errors
  if (error.statusCode === 429) {
    const errorResponse: ApiError = {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please try again later",
      },
    };
    return reply.status(429).send(errorResponse);
  }

  // Not found errors
  if (error.statusCode === 404) {
    const errorResponse: ApiError = {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: error.message || "Resource not found",
      },
    };
    return reply.status(404).send(errorResponse);
  }

  // Generic errors
  const statusCode = error.statusCode || 500;
  const errorResponse: ApiError = {
    success: false,
    error: {
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: statusCode >= 500 ? "Internal server error" : error.message,
      details: request.server.config.NODE_ENV === "development" ? error.stack : undefined,
    },
  };

  reply.status(statusCode).send(errorResponse);
}
