import type { FastifyInstance } from "fastify";
import { auditLog } from "../db/schema/audit-log-table.js";

export class AuditLogWriterService {
  constructor(private app: FastifyInstance) {}

  /**
   * Log a user action to audit log
   */
  async logAction(params: {
    userId?: number;
    username: string;
    action: "create" | "update" | "delete";
    resource: "node" | "ip" | "rule" | "user" | "setting";
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    try {
      await this.app.db.insert(auditLog).values({
        userId: params.userId,
        username: params.username,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        details: params.details,
        ipAddress: params.ipAddress,
        timestamp: new Date(),
      });
    } catch (error) {
      this.app.log.error({ error, params }, "Failed to write audit log");
      // Don't throw - audit logging should not break the main operation
    }
  }

  /**
   * Static helper for convenience - can be called without instantiating service
   */
  static async log(
    app: FastifyInstance,
    params: {
      userId?: number;
      username: string;
      action: "create" | "update" | "delete";
      resource: "node" | "ip" | "rule" | "user" | "setting";
      resourceId?: string;
      details?: Record<string, unknown>;
      ipAddress?: string;
    }
  ) {
    const service = new AuditLogWriterService(app);
    await service.logAction(params);
  }
}
