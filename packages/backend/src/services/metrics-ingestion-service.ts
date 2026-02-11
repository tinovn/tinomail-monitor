import type { FastifyInstance } from "fastify";
import type {
  SystemMetricsInput,
  MongodbMetricsInput,
  RedisMetricsInput,
  ZonemtaMetricsInput,
  RspamdMetricsInput,
} from "../schemas/metrics-validation-schemas.js";

export class MetricsIngestionService {
  constructor(private app: FastifyInstance) {}

  async ingestSystemMetrics(metrics: SystemMetricsInput): Promise<void> {
    const timestamp = metrics.timestamp ? new Date(metrics.timestamp) : new Date();

    await this.app.sql`
      INSERT INTO metrics_system (
        time, node_id, node_role, cpu_percent, ram_percent, ram_used_bytes,
        disk_percent, disk_free_bytes, disk_read_bytes_sec, disk_write_bytes_sec,
        net_rx_bytes_sec, net_tx_bytes_sec, net_rx_errors, net_tx_errors,
        load_1m, load_5m, load_15m, tcp_established, tcp_time_wait, open_files
      ) VALUES (
        ${timestamp}, ${metrics.nodeId}, ${metrics.nodeRole}, ${metrics.cpuPercent ?? null},
        ${metrics.ramPercent ?? null}, ${metrics.ramUsedBytes ?? null}, ${metrics.diskPercent ?? null},
        ${metrics.diskFreeBytes ?? null}, ${metrics.diskReadBytesSec ?? null}, ${metrics.diskWriteBytesSec ?? null},
        ${metrics.netRxBytesSec ?? null}, ${metrics.netTxBytesSec ?? null}, ${metrics.netRxErrors ?? null},
        ${metrics.netTxErrors ?? null}, ${metrics.load1m ?? null}, ${metrics.load5m ?? null}, ${metrics.load15m ?? null},
        ${metrics.tcpEstablished ?? null}, ${metrics.tcpTimeWait ?? null}, ${metrics.openFiles ?? null}
      )
    `;

    this.app.log.debug({ nodeId: metrics.nodeId }, "System metrics ingested");
  }

  async ingestMongodbMetrics(metrics: MongodbMetricsInput): Promise<void> {
    const timestamp = metrics.timestamp ? new Date(metrics.timestamp) : new Date();

    await this.app.sql`
      INSERT INTO metrics_mongodb (
        time, node_id, connections, op_insert, op_query, op_update, op_delete,
        op_getmore, op_command, replication_lag, replica_set_status
      ) VALUES (
        ${timestamp}, ${metrics.nodeId}, ${metrics.connections ?? null},
        ${metrics.opCounters?.insert ?? null}, ${metrics.opCounters?.query ?? null},
        ${metrics.opCounters?.update ?? null}, ${metrics.opCounters?.delete ?? null},
        ${metrics.opCounters?.getmore ?? null}, ${metrics.opCounters?.command ?? null},
        ${metrics.replicationLag ?? null}, ${metrics.replicaSetStatus ?? null}
      )
    `;

    this.app.log.debug({ nodeId: metrics.nodeId }, "MongoDB metrics ingested");
  }

  async ingestRedisMetrics(metrics: RedisMetricsInput): Promise<void> {
    const timestamp = metrics.timestamp ? new Date(metrics.timestamp) : new Date();

    await this.app.sql`
      INSERT INTO metrics_redis (
        time, node_id, used_memory, connected_clients, ops_per_sec,
        keyspace_hits, keyspace_misses, evicted_keys
      ) VALUES (
        ${timestamp}, ${metrics.nodeId}, ${metrics.usedMemory ?? null},
        ${metrics.connectedClients ?? null}, ${metrics.opsPerSec ?? null}, ${metrics.keyspaceHits ?? null},
        ${metrics.keyspaceMisses ?? null}, ${metrics.evictedKeys ?? null}
      )
    `;

    this.app.log.debug({ nodeId: metrics.nodeId }, "Redis metrics ingested");
  }

  async ingestZonemtaMetrics(metrics: ZonemtaMetricsInput): Promise<void> {
    const timestamp = metrics.timestamp ? new Date(metrics.timestamp) : new Date();

    await this.app.sql`
      INSERT INTO metrics_zonemta (
        time, node_id, queue_size, deferred, processing, sent_1h,
        bounced_1h, deferred_1h, avg_latency
      ) VALUES (
        ${timestamp}, ${metrics.nodeId}, ${metrics.queueSize ?? null}, ${metrics.deferred ?? null},
        ${metrics.processing ?? null}, ${metrics.sent1h ?? null}, ${metrics.bounced1h ?? null},
        ${metrics.deferred1h ?? null}, ${metrics.avgLatency ?? null}
      )
    `;

    this.app.log.debug({ nodeId: metrics.nodeId }, "ZoneMTA metrics ingested");
  }

  async ingestRspamdMetrics(metrics: RspamdMetricsInput): Promise<void> {
    const timestamp = metrics.timestamp ? new Date(metrics.timestamp) : new Date();

    await this.app.sql`
      INSERT INTO metrics_rspamd (
        time, node_id, scanned, spam, ham, greylist, rejected, soft_reject, avg_score
      ) VALUES (
        ${timestamp}, ${metrics.nodeId}, ${metrics.scanned ?? null}, ${metrics.spam ?? null},
        ${metrics.ham ?? null}, ${metrics.greylist ?? null}, ${metrics.rejected ?? null},
        ${metrics.softReject ?? null}, ${metrics.avgScore ?? null}
      )
    `;

    this.app.log.debug({ nodeId: metrics.nodeId }, "Rspamd metrics ingested");
  }
}
