import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { MailUserAnalyticsService } from "../../services/mail-user-analytics-service.js";
import {
  mailUserQuerySchema,
  mailUserParamsSchema,
  mailUserActivityQuerySchema,
} from "../../schemas/mail-user-validation-schemas.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function mailUserAnalyticsRoutes(app: FastifyInstance) {
  const mailUserService = new MailUserAnalyticsService(app);

  // GET /api/v1/mail-users - Paginated user list with risk badges
  app.get<{ Querystring: { page?: number; limit?: number; search?: string; sortBy?: string; sortDir?: "asc" | "desc" } }>(
    "/",
    { onRequest: [authHook] },
    async (request, reply) => {
      const query = mailUserQuerySchema.parse(request.query);
      const result = await mailUserService.getMailUsers(
        query.page,
        query.limit,
        query.search,
        query.sortBy,
        query.sortDir
      );

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/mail-users/abuse-flags - Flagged users list
  app.get("/abuse-flags", { onRequest: [authHook] }, async (_request, reply) => {
    const flaggedUsers = await mailUserService.getAbuseFlaggedUsers();
    const response: ApiResponse<typeof flaggedUsers> = {
      success: true,
      data: flaggedUsers,
    };
    reply.send(response);
  });

  // GET /api/v1/mail-users/:address - User detail
  app.get<{ Params: { address: string } }>(
    "/:address",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { address } = mailUserParamsSchema.parse(request.params);
      const userDetail = await mailUserService.getMailUserDetail(address);

      if (!userDetail) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Mail user not found or no activity in the last 24 hours",
          },
        });
      }

      const response: ApiResponse<typeof userDetail> = {
        success: true,
        data: userDetail,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/mail-users/:address/activity - Send/receive time-series
  app.get<{ Params: { address: string }; Querystring: { from?: string; to?: string } }>(
    "/:address/activity",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { address } = mailUserParamsSchema.parse(request.params);
      const query = mailUserActivityQuerySchema.parse(request.query);

      const activity = await mailUserService.getMailUserActivity(
        address,
        new Date(query.from),
        new Date(query.to)
      );

      const response: ApiResponse<typeof activity> = {
        success: true,
        data: activity,
      };
      reply.send(response);
    }
  );
}
