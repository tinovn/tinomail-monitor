import { Worker, Queue } from "bullmq";
import type { FastifyInstance } from "fastify";
import { AlertEngineEvaluationService } from "../services/alert-engine-evaluation-service.js";

interface AlertEvaluationJob {
  timestamp: string;
}

export function createAlertEvaluationScheduledWorker(app: FastifyInstance) {
  const alertEngine = new AlertEngineEvaluationService(app);

  const worker = new Worker<AlertEvaluationJob>(
    "alert-evaluation-scheduled",
    async () => {
      const startTime = Date.now();

      try {
        const result = await alertEngine.evaluateAllRules();

        const evaluationTime = Date.now() - startTime;

        app.log.info(
          {
            evaluated: result.evaluated,
            fired: result.fired,
            resolved: result.resolved,
            evaluationTimeMs: evaluationTime,
          },
          "Alert evaluation completed",
        );

        return {
          evaluated: result.evaluated,
          fired: result.fired,
          resolved: result.resolved,
          evaluationTimeMs: evaluationTime,
        };
      } catch (error) {
        app.log.error({ error }, "Alert evaluation failed");
        throw error;
      }
    },
    {
      connection: app.redisWorker,
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    app.log.debug({ jobId: job.id }, "Alert evaluation job completed");
  });

  worker.on("failed", (job, err) => {
    app.log.error(
      { jobId: job?.id, error: err },
      "Alert evaluation job failed",
    );
  });

  return worker;
}

/** Schedule alert evaluation checks every 30 seconds */
export async function scheduleAlertEvaluationChecks(app: FastifyInstance) {
  const queue = new Queue("alert-evaluation-scheduled", {
    connection: app.redisWorker,
  });

  // Every 30 seconds
  await queue.add(
    "evaluation-check",
    { timestamp: new Date().toISOString() },
    {
      repeat: {
        pattern: "*/30 * * * * *", // Every 30 seconds (cron with seconds)
      },
    },
  );

  app.log.info("Alert evaluation scheduled checks configured (every 30s)");
}
