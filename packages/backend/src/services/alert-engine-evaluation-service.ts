import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { alertRules } from "../db/schema/alert-rules-table.js";
import { alertEvents } from "../db/schema/alert-events-table.js";

interface ConditionParsed {
  type: "metric_threshold" | "absence" | "count" | "mongodb_no_primary" | "ops_total_drop_zero" | "wt_cache_percent_high";
  metric?: string;
  operator?: string;
  value?: number;
  timeWindow?: string;
  table?: string;
}

/** Alert engine — evaluates rules and fires/resolves alerts */
export class AlertEngineEvaluationService {
  constructor(private app: FastifyInstance) {}

  /** Evaluate all enabled rules */
  async evaluateAllRules(): Promise<{ evaluated: number; fired: number; resolved: number }> {
    const enabledRules = await this.app.db
      .select()
      .from(alertRules)
      .where(eq(alertRules.enabled, true));

    let fired = 0;
    let resolved = 0;

    for (const rule of enabledRules) {
      const result = await this.evaluateRule(rule);
      if (result === "fired") fired++;
      else if (result === "resolved") resolved++;
    }

    return { evaluated: enabledRules.length, fired, resolved };
  }

  /** Evaluate single rule */
  async evaluateRule(rule: typeof alertRules.$inferSelect): Promise<"fired" | "resolved" | "unchanged"> {
    const condition = this.parseCondition(rule.condition);
    const isTriggered = await this.checkCondition(condition);

    if (isTriggered) {
      return await this.handleTriggeredCondition(rule);
    } else {
      return await this.handleResolvedCondition(rule);
    }
  }

  /** Parse condition string into structured format */
  private parseCondition(condition: string): ConditionParsed {
    // metric_threshold: "cpu_percent > 85"
    if (condition.includes("cpu_percent") || condition.includes("ram_percent") || condition.includes("disk_percent")) {
      const match = condition.match(/(\w+)\s*([><=]+)\s*([\d.]+)/);
      if (match) {
        return {
          type: "metric_threshold",
          metric: match[1],
          operator: match[2],
          value: parseFloat(match[3]),
          table: "metrics_system",
        };
      }
    }

    // absence: "no_heartbeat > 5m"
    if (condition.includes("no_heartbeat") || condition.includes("absence")) {
      const match = condition.match(/(\d+)m/);
      return {
        type: "absence",
        timeWindow: match ? `${match[1]} minutes` : "5 minutes",
      };
    }

    // count: "spam_reports > 3 in 1h"
    if (condition.includes("in") && condition.includes("h")) {
      const match = condition.match(/(\w+)\s*>\s*(\d+)\s*in\s*(\d+)h/);
      if (match) {
        return {
          type: "count",
          metric: match[1],
          value: parseInt(match[2]),
          timeWindow: `${match[3]} hours`,
        };
      }
    }

    // MongoDB metric threshold: "repl_lag_seconds > 30", "wt_cache_timeout_count > 0", etc.
    const mongoMetricMatch = condition.match(/^(\w+)\s*([><=]+)\s*([\d.]+)$/);
    if (mongoMetricMatch) {
      const metric = mongoMetricMatch[1];
      if (AlertEngineEvaluationService.ALLOWED_MONGODB_METRICS.has(metric)) {
        return {
          type: "metric_threshold",
          metric,
          operator: mongoMetricMatch[2],
          value: parseFloat(mongoMetricMatch[3]),
          table: "metrics_mongodb",
        };
      }
    }

    // Computed MongoDB conditions
    const cachePctMatch = condition.match(/^wt_cache_percent_high\s*>\s*([\d.]+)$/);
    if (cachePctMatch) {
      return { type: "wt_cache_percent_high", value: parseFloat(cachePctMatch[1]) };
    }

    // Special MongoDB conditions
    if (condition === "mongodb_no_primary") return { type: "mongodb_no_primary" };
    if (condition === "ops_total_drop_zero") return { type: "ops_total_drop_zero" };

    // Default to metric threshold
    return { type: "metric_threshold", metric: "cpu_percent", operator: ">", value: 85 };
  }

  /** Check if condition is currently true */
  private async checkCondition(condition: ConditionParsed): Promise<boolean> {
    switch (condition.type) {
      case "metric_threshold":
        if (condition.table === "metrics_mongodb") return await this.checkMongodbMetricThreshold(condition);
        return await this.checkMetricThreshold(condition);
      case "absence":
        return await this.checkAbsence(condition);
      case "count":
        return await this.checkCount(condition);
      case "mongodb_no_primary":
        return await this.checkMongodbNoPrimary();
      case "ops_total_drop_zero":
        return await this.checkOpsTotalDropZero();
      case "wt_cache_percent_high":
        return await this.checkWtCachePercentHigh(condition);
      default:
        return false;
    }
  }

  /** Whitelist of allowed metric column names to prevent SQL injection */
  private static readonly ALLOWED_METRICS = new Set([
    "cpu_percent", "ram_percent", "disk_percent", "load_avg_1",
    "load_avg_5", "load_avg_15", "net_in_bytes", "net_out_bytes",
    "swap_percent", "iops_read", "iops_write",
  ]);

  /** Whitelist of allowed MongoDB metric column names */
  private static readonly ALLOWED_MONGODB_METRICS = new Set([
    "repl_lag_seconds", "connections_current", "wt_cache_used_bytes",
    "wt_cache_max_bytes", "wt_cache_dirty_bytes", "wt_cache_timeout_count",
    "wt_eviction_calls", "oplog_window_hours",
    "ops_insert", "ops_query", "ops_update", "ops_delete", "ops_command",
  ]);

  /** Parse and validate interval string to prevent SQL injection */
  private parseIntervalSafe(timeWindow: string): string {
    const match = timeWindow.match(/^(\d+)\s*(minutes?|hours?|days?|seconds?)$/);
    if (!match) return "5 minutes";
    return `${parseInt(match[1])} ${match[2]}`;
  }

  /** Check metric threshold */
  private async checkMetricThreshold(condition: ConditionParsed): Promise<boolean> {
    if (!condition.metric || !condition.operator || condition.value === undefined) return false;

    // Validate metric name against whitelist
    if (!AlertEngineEvaluationService.ALLOWED_METRICS.has(condition.metric)) {
      this.app.log.warn({ metric: condition.metric }, "Rejected unknown metric name in alert condition");
      return false;
    }

    // Use parameterized query with validated column name via sql.identifier
    const sql = this.app.sql;
    const recentMetrics = await sql`
      SELECT DISTINCT ON (node_id)
        node_id, ${sql(condition.metric)}, time
      FROM metrics_system
      WHERE time >= NOW() - INTERVAL '2 minutes'
      ORDER BY node_id, time DESC
    `;

    if (recentMetrics.length === 0) return false;

    // Check if any node exceeds threshold
    for (const metric of recentMetrics) {
      const value = metric[condition.metric];
      if (value !== null && this.compareValues(value, condition.operator, condition.value)) {
        return true;
      }
    }

    return false;
  }

  /** Check absence (no heartbeat) */
  private async checkAbsence(condition: ConditionParsed): Promise<boolean> {
    const interval = this.parseIntervalSafe(condition.timeWindow || "5 minutes");

    const sql = this.app.sql;
    const staleNodes = await sql`
      SELECT id, hostname, last_seen
      FROM nodes
      WHERE status = 'active'
        AND last_seen < NOW() - ${sql(interval)}::interval
    `;

    return staleNodes.length > 0;
  }

  /** Check event count in time window */
  private async checkCount(condition: ConditionParsed): Promise<boolean> {
    if (!condition.metric || condition.value === undefined) return false;

    const interval = this.parseIntervalSafe(condition.timeWindow || "1 hour");

    const sql = this.app.sql;
    const counts = await sql`
      SELECT COUNT(*) as count
      FROM email_events
      WHERE event_type = 'spam_report'
        AND time >= NOW() - ${sql(interval)}::interval
    `;

    return counts[0]?.count > condition.value;
  }

  /** Check MongoDB metric threshold (queries metrics_mongodb table) */
  private async checkMongodbMetricThreshold(condition: ConditionParsed): Promise<boolean> {
    if (!condition.metric || !condition.operator || condition.value === undefined) return false;

    if (!AlertEngineEvaluationService.ALLOWED_MONGODB_METRICS.has(condition.metric)) {
      this.app.log.warn({ metric: condition.metric }, "Rejected unknown MongoDB metric name in alert condition");
      return false;
    }

    try {
      const sql = this.app.sql;
      const recentMetrics = await sql`
        SELECT DISTINCT ON (node_id)
          node_id, ${sql(condition.metric)}, time
        FROM metrics_mongodb
        WHERE time >= NOW() - INTERVAL '2 minutes'
        ORDER BY node_id, time DESC
      `;

      if (recentMetrics.length === 0) return false;

      for (const metric of recentMetrics) {
        const value = metric[condition.metric];
        if (value !== null && this.compareValues(value, condition.operator, condition.value)) {
          return true;
        }
      }

      return false;
    } catch (err: any) {
      // 42703 = undefined_column — new columns not migrated yet
      if (err?.code === "42703") return false;
      throw err;
    }
  }

  /** Check if MongoDB has no primary node in the last 2 minutes */
  private async checkMongodbNoPrimary(): Promise<boolean> {
    const sql = this.app.sql;
    const result = await sql`
      SELECT COUNT(*) as cnt FROM (
        SELECT DISTINCT ON (node_id) node_id, role FROM metrics_mongodb
        WHERE time >= NOW() - INTERVAL '2 minutes'
        ORDER BY node_id, time DESC
      ) latest WHERE role = 'primary'
    `;

    return parseInt(result[0]?.cnt ?? "0") === 0;
  }

  /** Check if total ops dropped to zero while connections are active */
  private async checkOpsTotalDropZero(): Promise<boolean> {
    const sql = this.app.sql;
    const result = await sql`
      SELECT node_id,
        COALESCE(ops_insert, 0) + COALESCE(ops_query, 0) + COALESCE(ops_update, 0) + COALESCE(ops_delete, 0) AS total_ops,
        connections_current
      FROM (
        SELECT DISTINCT ON (node_id) * FROM metrics_mongodb
        WHERE time >= NOW() - INTERVAL '2 minutes'
        ORDER BY node_id, time DESC
      ) latest
      WHERE connections_current > 10
    `;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.some((row: any) => Number(row.total_ops) === 0);
  }

  /** Check if WiredTiger cache usage exceeds percentage threshold */
  private async checkWtCachePercentHigh(condition: ConditionParsed): Promise<boolean> {
    if (condition.value === undefined) return false;

    const sql = this.app.sql;
    const result = await sql`
      SELECT node_id, wt_cache_used_bytes, wt_cache_max_bytes
      FROM (
        SELECT DISTINCT ON (node_id) node_id, wt_cache_used_bytes, wt_cache_max_bytes
        FROM metrics_mongodb
        WHERE time >= NOW() - INTERVAL '2 minutes'
        ORDER BY node_id, time DESC
      ) latest
      WHERE wt_cache_max_bytes > 0
    `;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.some((row: any) => {
      const pct = (Number(row.wt_cache_used_bytes) / Number(row.wt_cache_max_bytes)) * 100;
      return pct > condition.value!;
    });
  }

  /** Compare values based on operator */
  private compareValues(actual: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case ">": return actual > threshold;
      case ">=": return actual >= threshold;
      case "<": return actual < threshold;
      case "<=": return actual <= threshold;
      case "==":
      case "=": return actual === threshold;
      default: return false;
    }
  }

  /** Handle triggered condition (with duration and cooldown) */
  private async handleTriggeredCondition(rule: typeof alertRules.$inferSelect): Promise<"fired" | "unchanged"> {
    const redisKey = `alert:condition:${rule.id}`;
    const firstTrueAt = await this.app.redis.get(redisKey);

    if (!firstTrueAt) {
      // First time condition is true — start tracking
      await this.app.redis.set(redisKey, new Date().toISOString(), "EX", 3600); // 1 hour TTL
      return "unchanged";
    }

    // Check if duration requirement met
    const firstTrue = new Date(firstTrueAt);
    const durationMs = this.parseDuration(rule.duration || "30s");
    const elapsed = Date.now() - firstTrue.getTime();

    if (elapsed < durationMs) {
      return "unchanged"; // Not long enough yet
    }

    // Check cooldown period
    const lastFired = await this.getLastFiredTime(rule.id);
    if (lastFired) {
      const cooldownMs = this.parseDuration(rule.cooldown || "30 minutes");
      const sinceLastFired = Date.now() - lastFired.getTime();
      if (sinceLastFired < cooldownMs) {
        return "unchanged"; // Still in cooldown
      }
    }

    // Fire alert
    await this.fireAlert(rule);
    await this.app.redis.del(redisKey); // Reset tracking
    return "fired";
  }

  /** Handle resolved condition */
  private async handleResolvedCondition(rule: typeof alertRules.$inferSelect): Promise<"resolved" | "unchanged"> {
    const redisKey = `alert:condition:${rule.id}`;
    await this.app.redis.del(redisKey); // Clear tracking

    // Check for active alerts to resolve
    const [activeAlert] = await this.app.db
      .select()
      .from(alertEvents)
      .where(and(eq(alertEvents.ruleId, rule.id), eq(alertEvents.status, "firing")))
      .orderBy(desc(alertEvents.firedAt))
      .limit(1);

    if (activeAlert) {
      await this.resolveAlert(activeAlert.id);
      return "resolved";
    }

    return "unchanged";
  }

  /** Fire new alert */
  private async fireAlert(rule: typeof alertRules.$inferSelect): Promise<void> {
    const [alertEvent] = await this.app.db
      .insert(alertEvents)
      .values({
        ruleId: rule.id,
        severity: rule.severity,
        status: "firing",
        message: `Alert: ${rule.name}`,
        details: { condition: rule.condition, threshold: rule.threshold },
        notified: false,
      })
      .returning();

    // Emit Socket.IO event
    this.app.io.to("alerts").emit("alert:fired", {
      id: alertEvent.id,
      ruleId: rule.id,
      severity: rule.severity,
      message: alertEvent.message,
      timestamp: alertEvent.firedAt?.toISOString(),
    });

    this.app.log.warn({ ruleId: rule.id, alertId: alertEvent.id }, `Alert fired: ${rule.name}`);
  }

  /** Resolve active alert */
  private async resolveAlert(alertId: number): Promise<void> {
    await this.app.db
      .update(alertEvents)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(alertEvents.id, alertId));

    // Emit Socket.IO event
    this.app.io.to("alerts").emit("alert:resolved", {
      id: alertId,
      timestamp: new Date().toISOString(),
    });

    this.app.log.info({ alertId }, "Alert resolved");
  }

  /** Get last fired time for rule */
  private async getLastFiredTime(ruleId: number): Promise<Date | null> {
    const [lastAlert] = await this.app.db
      .select()
      .from(alertEvents)
      .where(eq(alertEvents.ruleId, ruleId))
      .orderBy(desc(alertEvents.firedAt))
      .limit(1);

    return lastAlert?.firedAt || null;
  }

  /** Parse duration string to milliseconds */
  private parseDuration(duration: string): number {
    const match = duration.match(/(\d+)\s*(s|m|h|d)/);
    if (!match) return 30000; // Default 30s

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case "s": return value * 1000;
      case "m": return value * 60 * 1000;
      case "h": return value * 60 * 60 * 1000;
      case "d": return value * 24 * 60 * 60 * 1000;
      default: return 30000;
    }
  }
}
