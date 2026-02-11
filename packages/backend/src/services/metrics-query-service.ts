import type { FastifyInstance } from "fastify";
import type { TimeRangeQuery } from "../schemas/metrics-validation-schemas.js";

interface MetricsQueryResult {
  time: Date;
  nodeId: string;
  [key: string]: unknown;
}

export class MetricsQueryService {
  constructor(private app: FastifyInstance) {}

  /**
   * Automatically select resolution based on time range:
   * - < 6 hours: raw 15s data
   * - 6h-2d: 5m aggregates
   * - 2d-30d: 1h aggregates
   * - > 30d: 1d aggregates
   */
  private selectResolution(from: Date, to: Date): string {
    const durationMs = to.getTime() - from.getTime();
    const hours = durationMs / (1000 * 60 * 60);

    if (hours < 6) return "raw";
    if (hours < 48) return "5m";
    if (hours < 720) return "1h";
    return "1d";
  }

  async querySystemMetrics(query: TimeRangeQuery): Promise<MetricsQueryResult[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const resolution = query.interval || this.selectResolution(from, to);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    let tableName = "metrics_system";
    if (resolution === "5m") tableName = "metrics_system_5m";
    else if (resolution === "1h") tableName = "metrics_system_1h";
    else if (resolution === "1d") tableName = "metrics_system_1d";

    const nodeFilter = query.nodeId ? this.app.sql`AND node_id = ${query.nodeId}` : this.app.sql``;

    const result = await this.app.sql`
      SELECT
        time, node_id, node_role, cpu_percent, ram_percent, ram_used_bytes,
        disk_percent, disk_free_bytes, load_1m, load_5m, load_15m,
        net_rx_bytes_sec, net_tx_bytes_sec
      FROM ${this.app.sql(tableName)}
      WHERE time >= ${fromIso}::timestamptz AND time <= ${toIso}::timestamptz ${nodeFilter}
      ORDER BY time ASC
      LIMIT 10000
    `;

    return result as unknown as MetricsQueryResult[];
  }

  async queryMongodbMetrics(query: TimeRangeQuery): Promise<MetricsQueryResult[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const resolution = query.interval || this.selectResolution(from, to);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const nodeFilter = query.nodeId ? this.app.sql`AND node_id = ${query.nodeId}` : this.app.sql``;

    // Use continuous aggregates for larger time ranges
    if (resolution === "5m") {
      const result = await this.app.sql`
        SELECT bucket AS time, node_id, role, connections_current, connections_available,
          ops_insert, ops_query, ops_update, ops_delete, ops_command,
          repl_lag_seconds, data_size_bytes, index_size_bytes, storage_size_bytes,
          oplog_window_hours, wt_cache_used_bytes, wt_cache_max_bytes
        FROM mongodb_stats_5m
        WHERE bucket >= ${fromIso}::timestamptz AND bucket <= ${toIso}::timestamptz ${nodeFilter}
        ORDER BY bucket ASC LIMIT 10000
      `;
      return result as unknown as MetricsQueryResult[];
    }
    if (resolution === "1h") {
      const result = await this.app.sql`
        SELECT bucket AS time, node_id, role, connections_current, connections_available,
          ops_insert, ops_query, ops_update, ops_delete, ops_command,
          repl_lag_seconds, data_size_bytes, index_size_bytes, storage_size_bytes,
          oplog_window_hours, wt_cache_used_bytes, wt_cache_max_bytes
        FROM mongodb_stats_1h
        WHERE bucket >= ${fromIso}::timestamptz AND bucket <= ${toIso}::timestamptz ${nodeFilter}
        ORDER BY bucket ASC LIMIT 10000
      `;
      return result as unknown as MetricsQueryResult[];
    }
    if (resolution === "1d") {
      const result = await this.app.sql`
        SELECT bucket AS time, node_id, role, connections_current, connections_available,
          ops_insert, ops_query, ops_update, ops_delete, ops_command,
          repl_lag_seconds, data_size_bytes, index_size_bytes, storage_size_bytes,
          oplog_window_hours, wt_cache_used_bytes, wt_cache_max_bytes
        FROM mongodb_stats_daily
        WHERE bucket >= ${fromIso}::timestamptz AND bucket <= ${toIso}::timestamptz ${nodeFilter}
        ORDER BY bucket ASC LIMIT 10000
      `;
      return result as unknown as MetricsQueryResult[];
    }

    // Raw resolution
    const result = await this.app.sql`
      SELECT time, node_id, role, connections_current, connections_available,
        ops_insert, ops_query, ops_update, ops_delete, ops_command,
        repl_lag_seconds, data_size_bytes, index_size_bytes, storage_size_bytes,
        oplog_window_hours, wt_cache_used_bytes, wt_cache_max_bytes
      FROM metrics_mongodb
      WHERE time >= ${fromIso}::timestamptz AND time <= ${toIso}::timestamptz ${nodeFilter}
      ORDER BY time ASC LIMIT 10000
    `;
    return result as unknown as MetricsQueryResult[];
  }

  async queryRedisMetrics(query: TimeRangeQuery): Promise<MetricsQueryResult[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const nodeFilter = query.nodeId ? this.app.sql`AND node_id = ${query.nodeId}` : this.app.sql``;

    const result = await this.app.sql`
      SELECT
        time, node_id, used_memory, connected_clients, ops_per_sec,
        keyspace_hits, keyspace_misses
      FROM metrics_redis
      WHERE time >= ${fromIso}::timestamptz AND time <= ${toIso}::timestamptz ${nodeFilter}
      ORDER BY time ASC
      LIMIT 10000
    `;

    return result as unknown as MetricsQueryResult[];
  }

  async queryZonemtaMetrics(query: TimeRangeQuery): Promise<MetricsQueryResult[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const nodeFilter = query.nodeId ? this.app.sql`AND node_id = ${query.nodeId}` : this.app.sql``;

    const result = await this.app.sql`
      SELECT
        time, node_id, mta_role, queue_size, active_deliveries, sent_total,
        delivered_total, bounced_total, deferred_total, rejected_total,
        connections_active, throughput_per_sec
      FROM metrics_zonemta
      WHERE time >= ${fromIso}::timestamptz AND time <= ${toIso}::timestamptz ${nodeFilter}
      ORDER BY time ASC
      LIMIT 10000
    `;

    return result as unknown as MetricsQueryResult[];
  }

  async queryRspamdMetrics(query: TimeRangeQuery): Promise<MetricsQueryResult[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const nodeFilter = query.nodeId ? this.app.sql`AND node_id = ${query.nodeId}` : this.app.sql``;

    const result = await this.app.sql`
      SELECT
        time, node_id, scanned, spam, ham, greylist, rejected,
        soft_reject, avg_score
      FROM metrics_rspamd
      WHERE time >= ${fromIso}::timestamptz AND time <= ${toIso}::timestamptz ${nodeFilter}
      ORDER BY time ASC
      LIMIT 10000
    `;

    return result as unknown as MetricsQueryResult[];
  }
}
