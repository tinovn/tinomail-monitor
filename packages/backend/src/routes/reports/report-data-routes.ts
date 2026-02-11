import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { authHook } from "../../hooks/auth-hook.js";
import { ReportDataAggregationService } from "../../services/report-data-aggregation-service.js";
import { reportQuerySchema, reportGenerationSchema } from "../../schemas/report-export-validation-schemas.js";
import { reportHistory } from "../../db/schema/report-history-table.js";
import { desc } from "drizzle-orm";
import { Queue } from "bullmq";

export default async function reportDataRoutes(app: FastifyInstance) {
  const reportService = new ReportDataAggregationService(app);

  // GET /api/v1/reports/daily?date=YYYY-MM-DD
  app.get<{ Querystring: { date?: string } }>(
    "/daily",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { date } = reportQuerySchema.parse(request.query);
      const reportDate = date ? new Date(date) : new Date();

      const data = await reportService.getDailySummary(reportDate);

      const response: ApiResponse<typeof data> = {
        success: true,
        data,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/reports/weekly?week=YYYY-Www
  app.get<{ Querystring: { week?: string } }>(
    "/weekly",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { week } = reportQuerySchema.parse(request.query);

      // Parse week string (e.g., "2024-W05")
      let weekStart: Date;
      if (week) {
        const [year, weekNum] = week.split("-W");
        weekStart = new Date(parseInt(year), 0, 1 + (parseInt(weekNum) - 1) * 7);
      } else {
        weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of current week
      }

      const data = await reportService.getWeeklySummary(weekStart);

      const response: ApiResponse<typeof data> = {
        success: true,
        data,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/reports/monthly?month=YYYY-MM
  app.get<{ Querystring: { month?: string } }>(
    "/monthly",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { month } = reportQuerySchema.parse(request.query);

      let monthStart: Date;
      if (month) {
        const [year, monthNum] = month.split("-");
        monthStart = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      } else {
        monthStart = new Date();
        monthStart.setDate(1);
      }

      const data = await reportService.getMonthlySummary(monthStart);

      const response: ApiResponse<typeof data> = {
        success: true,
        data,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/reports/ip-reputation
  app.get(
    "/ip-reputation",
    { onRequest: [authHook] },
    async (_request, reply) => {
      const data = await reportService.getIpReputationReport();

      const response: ApiResponse<typeof data> = {
        success: true,
        data,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/reports/history
  app.get(
    "/history",
    { onRequest: [authHook] },
    async (_request, reply) => {
      const reports = await app.db
        .select()
        .from(reportHistory)
        .orderBy(desc(reportHistory.generatedAt))
        .limit(100);

      const response: ApiResponse<typeof reports> = {
        success: true,
        data: reports,
      };
      reply.send(response);
    }
  );

  // POST /api/v1/reports/generate
  app.post(
    "/generate",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = reportGenerationSchema.parse(request.body);

      // Enqueue report generation job
      const queue = new Queue("report-generation-scheduled", {
        connection: app.redisWorker,
      });

      const job = await queue.add("manual-report", {
        type: body.type,
        date: body.date || new Date().toISOString(),
        emailTo: body.emailTo,
        triggeredBy: (request.user as any)?.username || "system",
      });

      const response: ApiResponse<{ jobId: string }> = {
        success: true,
        data: { jobId: job.id || "unknown" },
      };
      reply.status(202).send(response);
    }
  );
}
