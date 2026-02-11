import { Worker, Queue } from "bullmq";
import type { FastifyInstance } from "fastify";
import { eq, and, isNull, sql } from "drizzle-orm";
import { alertEvents } from "../db/schema/alert-events-table.js";
import { alertRules } from "../db/schema/alert-rules-table.js";
import { AlertNotificationDispatchService } from "../services/alert-notification-dispatch-service.js";

interface AlertEscalationJob {
  timestamp: string;
}

export function createAlertEscalationScheduledWorker(app: FastifyInstance) {
  const notificationService = new AlertNotificationDispatchService(app);

  const worker = new Worker<AlertEscalationJob>(
    "alert-escalation-scheduled",
    async () => {
      try {
        const now = new Date();

        // Query firing alerts without acknowledgement
        const firingAlerts = await app.db
          .select({
            alert: alertEvents,
            rule: alertRules,
          })
          .from(alertEvents)
          .innerJoin(alertRules, eq(alertEvents.ruleId, alertRules.id))
          .where(
            and(
              eq(alertEvents.status, "firing"),
              isNull(alertEvents.acknowledgedBy),
              // Not snoozed
              sql`(${alertEvents.snoozedUntil} IS NULL OR ${alertEvents.snoozedUntil} < ${now})`,
            ),
          );

        let escalated = 0;

        for (const { alert, rule } of firingAlerts) {
          if (!alert.firedAt) continue;

          const minutesSinceFired = (now.getTime() - alert.firedAt.getTime()) / 60000;
          const currentLevel = alert.escalationLevel || 0;

          let newLevel = currentLevel;
          let shouldEscalate = false;

          // L1: 0-15min (already notified on fire)
          // L2: 15-30min
          if (minutesSinceFired >= 15 && minutesSinceFired < 30 && currentLevel === 0) {
            newLevel = 1;
            shouldEscalate = true;
          }

          // L3: 30min+
          if (minutesSinceFired >= 30 && currentLevel < 2) {
            newLevel = 2;
            shouldEscalate = true;
          }

          if (shouldEscalate) {
            // Update escalation level
            await app.db
              .update(alertEvents)
              .set({ escalationLevel: newLevel })
              .where(eq(alertEvents.id, alert.id));

            // Re-notify with escalation tag
            const channels = rule.channels || [];
            await notificationService.sendNotification(
              {
                id: alert.id,
                severity: `${alert.severity} [L${newLevel} ESCALATION]`,
                message: `⚠️ ESCALATED: ${alert.message} (unacknowledged for ${Math.floor(minutesSinceFired)}min)`,
                details: alert.details,
                nodeId: alert.nodeId,
                firedAt: alert.firedAt,
              },
              channels,
            );

            escalated++;

            app.log.warn(
              {
                alertId: alert.id,
                ruleId: rule.id,
                escalationLevel: newLevel,
                minutesSinceFired: Math.floor(minutesSinceFired),
              },
              "Alert escalated",
            );
          }
        }

        app.log.info(
          {
            checked: firingAlerts.length,
            escalated,
          },
          "Alert escalation check completed",
        );

        return { checked: firingAlerts.length, escalated };
      } catch (error) {
        app.log.error({ error }, "Alert escalation failed");
        throw error;
      }
    },
    {
      connection: app.redisWorker,
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    app.log.debug({ jobId: job.id }, "Alert escalation job completed");
  });

  worker.on("failed", (job, err) => {
    app.log.error(
      { jobId: job?.id, error: err },
      "Alert escalation job failed",
    );
  });

  return worker;
}

/** Schedule alert escalation checks every 1 minute */
export async function scheduleAlertEscalationChecks(app: FastifyInstance) {
  const queue = new Queue("alert-escalation-scheduled", {
    connection: app.redisWorker,
  });

  // Every 1 minute
  await queue.add(
    "escalation-check",
    { timestamp: new Date().toISOString() },
    {
      repeat: {
        pattern: "* * * * *",
      },
    },
  );

  app.log.info("Alert escalation scheduled checks configured (every 1min)");
}
