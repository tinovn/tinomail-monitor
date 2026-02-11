import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { OverviewService } from "../../services/overview-service.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function overviewRoutes(app: FastifyInstance) {
  const overviewService = new OverviewService(app);

  // GET /api/v1/overview - Alias for summary (frontend calls this)
  app.get("/", { onRequest: [authHook] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const summary = await overviewService.getOverviewSummary();

    const response: ApiResponse<typeof summary> = {
      success: true,
      data: summary,
    };
    reply.send(response);
  });

  // GET /api/v1/overview/summary - Get dashboard overview summary (requires auth)
  app.get("/summary", { onRequest: [authHook] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const summary = await overviewService.getOverviewSummary();

    const response: ApiResponse<typeof summary> = {
      success: true,
      data: summary,
    };
    reply.send(response);
  });
}
