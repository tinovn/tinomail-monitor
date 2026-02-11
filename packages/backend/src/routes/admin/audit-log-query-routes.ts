import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
import { auditLog } from "../../db/schema/audit-log-table.js";
import { adminAuthHook } from "../../hooks/admin-auth-hook.js";
import { auditLogQuerySchema } from "../../schemas/admin-validation-schemas.js";

export default async function auditLogQueryRoutes(app: FastifyInstance) {
  // GET /api/v1/admin/audit-log - Query audit log with filters and pagination
  app.get<{ Querystring: any }>(
    "/audit-log",
    { onRequest: [adminAuthHook] },
    async (request, reply) => {
      const query = auditLogQuerySchema.parse(request.query);

      // Build where conditions
      const conditions = [];

      if (query.user) {
        conditions.push(eq(auditLog.username, query.user));
      }

      if (query.action) {
        conditions.push(eq(auditLog.action, query.action));
      }

      if (query.resource) {
        conditions.push(eq(auditLog.resource, query.resource));
      }

      if (query.from) {
        conditions.push(gte(auditLog.timestamp, new Date(query.from)));
      }

      if (query.to) {
        conditions.push(lte(auditLog.timestamp, new Date(query.to)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Count total
      const [countResult] = await app.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(auditLog)
        .where(whereClause);

      const total = Number(countResult?.count || 0);

      // Fetch logs with pagination
      const logs = await app.db
        .select()
        .from(auditLog)
        .where(whereClause)
        .orderBy(desc(auditLog.timestamp))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit);

      const response: ApiResponse<{
        logs: typeof logs;
        pagination: { page: number; limit: number; total: number; pages: number };
      }> = {
        success: true,
        data: {
          logs,
          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            pages: Math.ceil(total / query.limit),
          },
        },
      };
      reply.send(response);
    }
  );
}
