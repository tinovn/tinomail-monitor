import { Worker, Queue } from "bullmq";
import type { FastifyInstance } from "fastify";
import { ReportDataAggregationService } from "../services/report-data-aggregation-service.js";
import { reportHistory } from "../db/schema/report-history-table.js";

interface ReportGenerationJob {
  type: "daily" | "weekly" | "monthly" | "ip-reputation";
  date?: string;
  emailTo?: string[];
  triggeredBy?: string;
}

export function createReportGenerationScheduledWorker(app: FastifyInstance) {
  const reportService = new ReportDataAggregationService(app);

  const worker = new Worker<ReportGenerationJob>(
    "report-generation-scheduled",
    async (job) => {
      const { type, date, emailTo, triggeredBy } = job.data;
      const startTime = Date.now();

      try {
        let reportData: any;
        let periodStart: Date;
        let periodEnd: Date;

        const targetDate = date ? new Date(date) : new Date();

        switch (type) {
          case "daily":
            periodStart = new Date(targetDate);
            periodStart.setHours(0, 0, 0, 0);
            periodEnd = new Date(targetDate);
            periodEnd.setHours(23, 59, 59, 999);
            reportData = await reportService.getDailySummary(targetDate);
            break;

          case "weekly":
            periodStart = new Date(targetDate);
            periodStart.setDate(periodStart.getDate() - periodStart.getDay());
            periodStart.setHours(0, 0, 0, 0);
            periodEnd = new Date(periodStart);
            periodEnd.setDate(periodEnd.getDate() + 6);
            periodEnd.setHours(23, 59, 59, 999);
            reportData = await reportService.getWeeklySummary(periodStart);
            break;

          case "monthly":
            periodStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
            periodEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
            periodEnd.setHours(23, 59, 59, 999);
            reportData = await reportService.getMonthlySummary(periodStart);
            break;

          case "ip-reputation":
            periodStart = new Date();
            periodEnd = new Date();
            reportData = await reportService.getIpReputationReport();
            break;

          default:
            throw new Error(`Unknown report type: ${type}`);
        }

        // Store report in history
        await app.db.insert(reportHistory).values({
          type,
          generatedAt: new Date(),
          periodStart,
          periodEnd,
          data: reportData,
          emailedTo: emailTo,
          createdBy: triggeredBy || "system",
        });

        const generationTime = Date.now() - startTime;

        app.log.info(
          {
            type,
            periodStart,
            periodEnd,
            generationTimeMs: generationTime,
          },
          "Report generated successfully"
        );

        return {
          type,
          periodStart,
          periodEnd,
          generationTimeMs: generationTime,
        };
      } catch (error) {
        app.log.error({ error, type }, "Report generation failed");
        throw error;
      }
    },
    {
      connection: app.redisWorker,
      concurrency: 1,
    }
  );

  worker.on("completed", (job) => {
    app.log.debug({ jobId: job.id }, "Report generation job completed");
  });

  worker.on("failed", (job, err) => {
    app.log.error({ jobId: job?.id, error: err }, "Report generation job failed");
  });

  return worker;
}

/** Schedule report generation at specified times */
export async function scheduleReportGeneration(app: FastifyInstance) {
  const queue = new Queue("report-generation-scheduled", {
    connection: app.redisWorker,
  });

  // Daily report at 8 AM UTC
  await queue.add(
    "daily-report",
    { type: "daily" },
    {
      repeat: {
        pattern: "0 8 * * *", // Every day at 8 AM
      },
    }
  );

  // Weekly report on Monday at 9 AM UTC
  await queue.add(
    "weekly-report",
    { type: "weekly" },
    {
      repeat: {
        pattern: "0 9 * * 1", // Every Monday at 9 AM
      },
    }
  );

  // Monthly report on 1st of month at 9 AM UTC
  await queue.add(
    "monthly-report",
    { type: "monthly" },
    {
      repeat: {
        pattern: "0 9 1 * *", // 1st of every month at 9 AM
      },
    }
  );

  app.log.info("Report generation scheduled checks configured");
}
