import type { FastifyInstance } from "fastify";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

interface ExportFilters {
  from: Date;
  to: Date;
  nodeId?: number;
  eventType?: string;
  status?: string;
  severity?: string;
}

export class DataExportStreamingService {
  constructor(private app: FastifyInstance) {}

  /**
   * Export email events as CSV or JSON stream
   */
  async exportEmailEvents(filters: ExportFilters, format: "csv" | "json", replyStream: any) {
    const query = `
      SELECT
        time,
        event_type,
        message_id,
        from_address,
        to_address,
        from_domain,
        to_domain,
        mta_node,
        bounce_type,
        bounce_category,
        delivery_time_ms
      FROM email_events
      WHERE time >= $1 AND time <= $2
        ${filters.eventType ? `AND event_type = $3` : ""}
      ORDER BY time DESC
      LIMIT 50000
    `;

    const params: any[] = [filters.from, filters.to];
    if (filters.eventType) params.push(filters.eventType);

    if (format === "csv") {
      await this.streamAsCSV(query, params, replyStream, [
        "time",
        "event_type",
        "message_id",
        "from_address",
        "to_address",
        "from_domain",
        "to_domain",
        "mta_node",
        "bounce_type",
        "bounce_category",
        "delivery_time_ms",
      ]);
    } else {
      await this.streamAsJSON(query, params, replyStream);
    }
  }

  /**
   * Export server metrics as CSV or JSON stream
   */
  async exportServerMetrics(filters: ExportFilters, format: "csv" | "json", replyStream: any) {
    if (!filters.nodeId) {
      throw new Error("nodeId is required for server metrics export");
    }

    const query = `
      SELECT
        time,
        node_id,
        cpu_usage,
        memory_used,
        memory_total,
        disk_used,
        disk_total,
        network_rx_bytes,
        network_tx_bytes,
        load_avg_1m
      FROM metrics_system
      WHERE time >= $1 AND time <= $2 AND node_id = $3
      ORDER BY time DESC
      LIMIT 50000
    `;

    const params: any[] = [filters.from, filters.to, filters.nodeId];

    if (format === "csv") {
      await this.streamAsCSV(query, params, replyStream, [
        "time",
        "node_id",
        "cpu_usage",
        "memory_used",
        "memory_total",
        "disk_used",
        "disk_total",
        "network_rx_bytes",
        "network_tx_bytes",
        "load_avg_1m",
      ]);
    } else {
      await this.streamAsJSON(query, params, replyStream);
    }
  }

  /**
   * Export blacklist history as CSV or JSON stream
   */
  async exportBlacklistHistory(filters: ExportFilters, format: "csv" | "json", replyStream: any) {
    const query = `
      SELECT
        time,
        ip_address,
        dnsbl_name,
        is_listed,
        response_code,
        response_time_ms
      FROM blacklist_checks
      WHERE time >= $1 AND time <= $2
      ORDER BY time DESC
      LIMIT 50000
    `;

    const params: any[] = [filters.from, filters.to];

    if (format === "csv") {
      await this.streamAsCSV(query, params, replyStream, [
        "time",
        "ip_address",
        "dnsbl_name",
        "is_listed",
        "response_code",
        "response_time_ms",
      ]);
    } else {
      await this.streamAsJSON(query, params, replyStream);
    }
  }

  /**
   * Export alert history as CSV or JSON stream
   */
  async exportAlertHistory(filters: ExportFilters, format: "csv" | "json", replyStream: any) {
    const query = `
      SELECT
        id,
        rule_id,
        rule_name,
        severity,
        status,
        message,
        value,
        threshold,
        created_at,
        resolved_at
      FROM alert_events
      WHERE created_at >= $1 AND created_at <= $2
        ${filters.severity ? `AND severity = $3` : ""}
      ORDER BY created_at DESC
      LIMIT 50000
    `;

    const params: any[] = [filters.from, filters.to];
    if (filters.severity) params.push(filters.severity);

    if (format === "csv") {
      await this.streamAsCSV(query, params, replyStream, [
        "id",
        "rule_id",
        "rule_name",
        "severity",
        "status",
        "message",
        "value",
        "threshold",
        "created_at",
        "resolved_at",
      ]);
    } else {
      await this.streamAsJSON(query, params, replyStream);
    }
  }

  /**
   * Stream query results as CSV
   */
  private async streamAsCSV(query: string, params: any[], replyStream: any, columns: string[]) {
    const cursor = this.app.sql.unsafe(query, params as any[]).cursor();

    // Write CSV header
    replyStream.raw.write(columns.join(",") + "\n");

    // Transform stream to CSV rows
    const csvTransform = new Transform({
      objectMode: true,
      transform(row: any, _encoding, callback) {
        const values = columns.map((col) => {
          const value = row[col];
          if (value === null || value === undefined) return "";
          if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return String(value);
        });
        callback(null, values.join(",") + "\n");
      },
    });

    try {
      await pipeline(cursor, csvTransform, replyStream.raw);
    } catch (error) {
      this.app.log.error({ error }, "CSV streaming failed");
      throw error;
    }
  }

  /**
   * Stream query results as JSON array
   */
  private async streamAsJSON(query: string, params: any[], replyStream: any) {
    const cursor = this.app.sql.unsafe(query, params as any[]).cursor();

    // Write opening bracket
    replyStream.raw.write("[");

    let isFirst = true;

    // Transform stream to JSON objects
    const jsonTransform = new Transform({
      objectMode: true,
      transform(row: any, _encoding, callback) {
        const prefix = isFirst ? "" : ",";
        isFirst = false;
        callback(null, prefix + JSON.stringify(row));
      },
    });

    try {
      await pipeline(cursor, jsonTransform, replyStream.raw);
      // Write closing bracket
      replyStream.raw.write("]");
    } catch (error) {
      this.app.log.error({ error }, "JSON streaming failed");
      throw error;
    }
  }
}
