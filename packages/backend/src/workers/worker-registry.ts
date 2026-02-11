import type { FastifyInstance } from "fastify";
import type { Worker } from "bullmq";
import { createEmailEventBatchWorker } from "./email-event-batch-worker.js";
import { createDnsblCheckScheduledWorker, scheduleDnsblChecks } from "./dnsbl-check-scheduled-worker.js";
import { createDnsblAutoResponseWorker } from "./dnsbl-auto-response-worker.js";
import { createAbuseDetectionScheduledWorker, scheduleAbuseDetectionChecks } from "./abuse-detection-scheduled-worker.js";
import { createBruteForceDetectionScheduledWorker, scheduleBruteForceDetectionChecks } from "./brute-force-detection-scheduled-worker.js";
import { createAlertEvaluationScheduledWorker, scheduleAlertEvaluationChecks } from "./alert-evaluation-scheduled-worker.js";
import { createAlertEscalationScheduledWorker, scheduleAlertEscalationChecks } from "./alert-escalation-scheduled-worker.js";
import { createReportGenerationScheduledWorker, scheduleReportGeneration } from "./report-generation-scheduled-worker.js";

/**
 * Initialize all BullMQ workers
 * Workers run background jobs for email event processing, metrics aggregation, etc.
 */
export async function initializeWorkers(app: FastifyInstance): Promise<Worker[]> {
  const workers: Worker[] = [];

  try {
    // Email event batch processor
    const emailEventWorker = createEmailEventBatchWorker(app);
    workers.push(emailEventWorker);

    // DNSBL check scheduled worker
    const dnsblCheckWorker = createDnsblCheckScheduledWorker(app);
    workers.push(dnsblCheckWorker);

    // DNSBL auto-response worker
    const dnsblAutoResponseWorker = createDnsblAutoResponseWorker(app);
    workers.push(dnsblAutoResponseWorker);

    // Abuse detection scheduled worker
    const abuseDetectionWorker = createAbuseDetectionScheduledWorker(app);
    workers.push(abuseDetectionWorker);

    // Brute force detection scheduled worker
    const bruteForceWorker = createBruteForceDetectionScheduledWorker(app);
    workers.push(bruteForceWorker);

    // Alert evaluation scheduled worker
    const alertEvaluationWorker = createAlertEvaluationScheduledWorker(app);
    workers.push(alertEvaluationWorker);

    // Alert escalation scheduled worker
    const alertEscalationWorker = createAlertEscalationScheduledWorker(app);
    workers.push(alertEscalationWorker);

    // Report generation scheduled worker
    const reportGenerationWorker = createReportGenerationScheduledWorker(app);
    workers.push(reportGenerationWorker);

    // Schedule DNSBL checks
    await scheduleDnsblChecks(app);

    // Schedule abuse detection checks
    await scheduleAbuseDetectionChecks(app);

    // Schedule brute force detection checks
    await scheduleBruteForceDetectionChecks(app);

    // Schedule alert evaluation checks
    await scheduleAlertEvaluationChecks(app);

    // Schedule alert escalation checks
    await scheduleAlertEscalationChecks(app);

    // Schedule report generation
    await scheduleReportGeneration(app);

    app.log.info({ workerCount: workers.length }, "BullMQ workers initialized");

    return workers;
  } catch (error) {
    app.log.error({ error }, "Failed to initialize workers");
    throw error;
  }
}

/**
 * Graceful shutdown of all workers
 */
export async function shutdownWorkers(workers: Worker[]) {
  await Promise.all(workers.map((worker) => worker.close()));
}
