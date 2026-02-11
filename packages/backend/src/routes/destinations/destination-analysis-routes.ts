import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { DestinationDeliveryAnalysisService } from "../../services/destination-delivery-analysis-service.js";
import { destinationQuerySchema, destinationParamsSchema } from "../../schemas/destination-validation-schemas.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function destinationAnalysisRoutes(app: FastifyInstance) {
  const destinationService = new DestinationDeliveryAnalysisService(app);

  // GET /api/v1/destinations - Get top destinations with delivery stats
  app.get<{ Querystring: { from?: string; to?: string; limit?: string } }>(
    "/",
    { onRequest: [authHook] },
    async (request, reply) => {
      const query = destinationQuerySchema.parse(request.query);
      const destinations = await destinationService.getTopDestinations(
        new Date(query.from),
        new Date(query.to),
        query.limit
      );

      const response: ApiResponse<typeof destinations> = {
        success: true,
        data: destinations,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/destinations/:domain - Get per-destination detail
  app.get<{ Params: { domain: string }; Querystring: { from?: string; to?: string } }>(
    "/:domain",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { domain } = destinationParamsSchema.parse(request.params);
      const query = destinationQuerySchema.parse(request.query);

      const detail = await destinationService.getDestinationDetail(
        domain,
        new Date(query.from),
        new Date(query.to)
      );

      if (!detail) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Destination domain not found or no data in time range",
          },
        });
      }

      const response: ApiResponse<typeof detail> = {
        success: true,
        data: detail,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/destinations/heatmap - Get delivery heatmap (global)
  app.get<{ Querystring: { from?: string; to?: string } }>(
    "/heatmap",
    { onRequest: [authHook] },
    async (request, reply) => {
      const query = destinationQuerySchema.parse(request.query);
      const heatmap = await destinationService.getDeliveryHeatmap(
        new Date(query.from),
        new Date(query.to)
      );

      const response: ApiResponse<typeof heatmap> = {
        success: true,
        data: heatmap,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/destinations/:domain/heatmap - Per-destination delivery heatmap
  app.get<{ Params: { domain: string }; Querystring: { from?: string; to?: string } }>(
    "/:domain/heatmap",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { domain } = destinationParamsSchema.parse(request.params);
      const query = destinationQuerySchema.parse(request.query);
      const from = new Date(query.from);
      const to = new Date(query.to);

      const data = await app.sql`
        SELECT
          EXTRACT(HOUR FROM time)::int AS hour,
          EXTRACT(DOW FROM time)::int AS weekday,
          CASE WHEN COUNT(*) > 0
            THEN (COUNT(*) FILTER (WHERE event_type = 'delivered')::float / COUNT(*) * 100)
            ELSE 0
          END AS delivered_percent,
          COUNT(*)::int AS total_sent
        FROM email_events
        WHERE to_domain = ${domain}
          AND time >= ${from}
          AND time <= ${to}
        GROUP BY hour, weekday
        ORDER BY weekday, hour
      `;

      const result = data.map((row: Record<string, unknown>) => ({
        hour: Number(row.hour),
        weekday: Number(row.weekday),
        deliveredPercent: Number(row.delivered_percent) || 0,
        totalSent: Number(row.total_sent) || 0,
      }));

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      reply.send(response);
    }
  );
}
