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
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const nodeFilter = query.nodeId ? this.app.sql`AND node_id = ${query.nodeId}` : this.app.sql``;

    const result = await this.app.sql`
      SELECT
        time, node_id, connections, op_insert, op_query, op_update,
        op_delete, replication_lag, replica_set_status
      FROM metrics_mongodb
      WHERE time >= ${fromIso}::timestamptz AND time <= ${toIso}::timestamptz ${nodeFilter}
      ORDER BY time ASC
      LIMIT 10000
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
        time, node_id, queue_size, deferred, processing, sent_1h,
        bounced_1h, deferred_1h, avg_latency
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
