import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { alertEvents } from "../../db/schema/alert-events-table.js";
import { alertRules } from "../../db/schema/alert-rules-table.js";
import { authHook } from "../../hooks/auth-hook.js";
import { alertHistoryQuerySchema } from "../../schemas/alert-validation-schemas.js";

export default async function alertActiveAndHistoryRoutes(app: FastifyInstance) {
  // GET /api/v1/alerts - Active alerts (status='firing', not snoozed)
  app.get("/", { onRequest: [authHook] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const now = new Date();

    const activeAlerts = await app.db
      .select({
        alert: alertEvents,
        rule: alertRules,
      })
      .from(alertEvents)
      .innerJoin(alertRules, eq(alertEvents.ruleId, alertRules.id))
      .where(
        and(
          eq(alertEvents.status, "firing"),
          // Not snoozed
          sql`(${alertEvents.snoozedUntil} IS NULL OR ${alertEvents.snoozedUntil} < ${now})`,
        ),
      )
      .orderBy(
        sql`CASE ${alertEvents.severity} WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END`,
        desc(alertEvents.firedAt),
      );

    const response: ApiResponse<typeof activeAlerts> = {
      success: true,
      data: activeAlerts,
    };
    reply.send(response);
  });

  // GET /api/v1/alerts/recent - Most recent alerts for overview dashboard
  app.get<{ Querystring: { limit?: string } }>(
    "/recent",
    { onRequest: [authHook] },
    async (request, reply) => {
      const limit = Math.min(parseInt(request.query.limit || "5"), 20);

      const recentAlerts = await app.db
        .select({
          id: alertEvents.id,
          ruleId: alertEvents.ruleId,
          severity: alertEvents.severity,
          message: alertEvents.message,
          triggeredAt: alertEvents.firedAt,
          status: alertEvents.status,
        })
        .from(alertEvents)
        .orderBy(desc(alertEvents.firedAt))
        .limit(limit);

      const response: ApiResponse<typeof recentAlerts> = {
        success: true,
        data: recentAlerts,
      };
      reply.send(response);
    },
  );

  // GET /api/v1/alerts/history - Alert history with pagination and filters
  app.get("/history", { onRequest: [authHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = alertHistoryQuerySchema.parse(request.query);
    const offset = (query.page - 1) * query.limit;

    // Build conditions
    const conditions = [];
    if (query.severity) {
      conditions.push(eq(alertEvents.severity, query.severity));
    }
    if (query.ruleId) {
      conditions.push(eq(alertEvents.ruleId, query.ruleId));
    }
    if (query.from) {
      conditions.push(gte(alertEvents.firedAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lte(alertEvents.firedAt, new Date(query.to)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Query with pagination
    const [alerts, countResult] = await Promise.all([
      app.db
        .select({
          alert: alertEvents,
          rule: alertRules,
        })
        .from(alertEvents)
        .innerJoin(alertRules, eq(alertEvents.ruleId, alertRules.id))
        .where(whereClause)
        .orderBy(desc(alertEvents.firedAt))
        .limit(query.limit)
        .offset(offset),
      app.db
        .select({ count: sql<number>`count(*)` })
        .from(alertEvents)
        .where(whereClause),
    ]);

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / query.limit);

    const response: ApiResponse<{
      alerts: typeof alerts;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }> = {
      success: true,
      data: {
        alerts,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
        },
      },
    };
    reply.send(response);
  });

  // GET /api/v1/alerts/frequency - Daily alert counts for last 30 days
  app.get("/frequency", { onRequest: [authHook] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const frequency = await app.sql`
      SELECT
        DATE(fired_at) as date,
        severity,
        COUNT(*) as count
      FROM alert_events
      WHERE fired_at >= ${thirtyDaysAgo.toISOString()}::timestamptz
      GROUP BY DATE(fired_at), severity
      ORDER BY date DESC
    `;

    const response: ApiResponse<typeof frequency> = {
      success: true,
      data: frequency,
    };
    reply.send(response);
  });
}
