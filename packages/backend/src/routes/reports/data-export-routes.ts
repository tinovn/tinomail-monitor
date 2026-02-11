import type { FastifyInstance } from "fastify";
import { authHook } from "../../hooks/auth-hook.js";
import { DataExportStreamingService } from "../../services/data-export-streaming-service.js";
import { exportQuerySchema } from "../../schemas/report-export-validation-schemas.js";

export default async function dataExportRoutes(app: FastifyInstance) {
  const exportService = new DataExportStreamingService(app);

  // GET /api/v1/export/email-events
  app.get<{ Querystring: any }>(
    "/email-events",
    { onRequest: [authHook] },
    async (request, reply) => {
      const query = exportQuerySchema.parse(request.query);

      const filename = `email-events-${query.from}-${query.to}.${query.format}`;
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);

      if (query.format === "csv") {
        reply.type("text/csv");
      } else {
        reply.type("application/json");
      }

      const filters = {
        from: new Date(query.from),
        to: new Date(query.to),
        eventType: query.eventType,
      };

      await exportService.exportEmailEvents(filters, query.format, reply);
    }
  );

  // GET /api/v1/export/server-metrics
  app.get<{ Querystring: any }>(
    "/server-metrics",
    { onRequest: [authHook] },
    async (request, reply) => {
      const query = exportQuerySchema.parse(request.query);

      if (!query.nodeId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "nodeId is required for server metrics export",
          },
        });
      }

      const filename = `server-metrics-node${query.nodeId}-${query.from}-${query.to}.${query.format}`;
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);

      if (query.format === "csv") {
        reply.type("text/csv");
      } else {
        reply.type("application/json");
      }

      const filters = {
        from: new Date(query.from),
        to: new Date(query.to),
        nodeId: query.nodeId,
      };

      await exportService.exportServerMetrics(filters, query.format, reply);
    }
  );

  // GET /api/v1/export/blacklist-history
  app.get<{ Querystring: any }>(
    "/blacklist-history",
    { onRequest: [authHook] },
    async (request, reply) => {
      const query = exportQuerySchema.parse(request.query);

      const filename = `blacklist-history-${query.from}-${query.to}.${query.format}`;
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);

      if (query.format === "csv") {
        reply.type("text/csv");
      } else {
        reply.type("application/json");
      }

      const filters = {
        from: new Date(query.from),
        to: new Date(query.to),
      };

      await exportService.exportBlacklistHistory(filters, query.format, reply);
    }
  );

  // GET /api/v1/export/alert-history
  app.get<{ Querystring: any }>(
    "/alert-history",
    { onRequest: [authHook] },
    async (request, reply) => {
      const query = exportQuerySchema.parse(request.query);

      const filename = `alert-history-${query.from}-${query.to}.${query.format}`;
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);

      if (query.format === "csv") {
        reply.type("text/csv");
      } else {
        reply.type("application/json");
      }

      const filters = {
        from: new Date(query.from),
        to: new Date(query.to),
        severity: query.severity,
      };

      await exportService.exportAlertHistory(filters, query.format, reply);
    }
  );
}
