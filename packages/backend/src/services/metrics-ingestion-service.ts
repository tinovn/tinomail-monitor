import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { nodes } from "../db/schema/nodes-table.js";
import type {
  SystemMetricsInput,
  MongodbMetricsInput,
  RedisMetricsInput,
  ZonemtaMetricsInput,
  RspamdMetricsInput,
  MongodbReplEventInput,
} from "../schemas/metrics-validation-schemas.js";

export class MetricsIngestionService {
  constructor(private app: FastifyInstance) {}

  async ingestSystemMetrics(metrics: SystemMetricsInput): Promise<void> {
    const timestamp = metrics.timestamp || new Date().toISOString();
    const { processes, ...systemData } = metrics;

    await this.app.sql`
      INSERT INTO metrics_system (
        time, node_id, node_role, cpu_percent, ram_percent, ram_used_bytes,
        disk_percent, disk_free_bytes, disk_read_bytes_sec, disk_write_bytes_sec,
        net_rx_bytes_sec, net_tx_bytes_sec, net_rx_errors, net_tx_errors,
        load_1m, load_5m, load_15m, tcp_established, tcp_time_wait, open_files
      ) VALUES (
        ${timestamp}, ${systemData.nodeId}, ${systemData.nodeRole}, ${systemData.cpuPercent ?? null},
        ${systemData.ramPercent ?? null}, ${systemData.ramUsedBytes ?? null}, ${systemData.diskPercent ?? null},
        ${systemData.diskFreeBytes ?? null}, ${systemData.diskReadBytesSec ?? null}, ${systemData.diskWriteBytesSec ?? null},
        ${systemData.netRxBytesSec ?? null}, ${systemData.netTxBytesSec ?? null}, ${systemData.netRxErrors ?? null},
        ${systemData.netTxErrors ?? null}, ${systemData.load1m ?? null}, ${systemData.load5m ?? null}, ${systemData.load15m ?? null},
        ${systemData.tcpEstablished ?? null}, ${systemData.tcpTimeWait ?? null}, ${systemData.openFiles ?? null}
      )
    `;

    // Update node metadata with latest process health (non-blocking)
    if (processes && processes.length > 0) {
      this.app.db
        .update(nodes)
        .set({
          metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ processes })}::jsonb`,
          lastSeen: new Date(),
        })
        .where(eq(nodes.id, systemData.nodeId))
        .execute()
        .catch((err) => this.app.log.error(err, "Failed to update node processes"));
    }

    this.app.log.debug({ nodeId: systemData.nodeId }, "System metrics ingested");
  }

  async ingestMongodbMetrics(metrics: MongodbMetricsInput): Promise<void> {
    const timestamp = metrics.timestamp || new Date().toISOString();

    await this.app.sql`
      INSERT INTO metrics_mongodb (
        time, node_id, role, connections_current, connections_available,
        ops_insert, ops_query, ops_update, ops_delete, ops_command,
        repl_lag_seconds, data_size_bytes, index_size_bytes, storage_size_bytes,
        oplog_window_hours, wt_cache_used_bytes, wt_cache_max_bytes,
        wt_cache_dirty_bytes, wt_cache_timeout_count, wt_eviction_calls,
        conn_app_imap, conn_app_smtp, conn_app_internal, conn_app_monitoring, conn_app_other,
        gridfs_messages_bytes, gridfs_attach_files_bytes, gridfs_attach_chunks_bytes,
        gridfs_storage_files_bytes, gridfs_storage_chunks_bytes
      ) VALUES (
        ${timestamp}, ${metrics.nodeId}, ${metrics.role ?? null},
        ${metrics.connectionsCurrent ?? null}, ${metrics.connectionsAvailable ?? null},
        ${metrics.opsInsert ?? null}, ${metrics.opsQuery ?? null},
        ${metrics.opsUpdate ?? null}, ${metrics.opsDelete ?? null}, ${metrics.opsCommand ?? null},
        ${metrics.replLagSeconds ?? null}, ${metrics.dataSizeBytes ?? null},
        ${metrics.indexSizeBytes ?? null}, ${metrics.storageSizeBytes ?? null},
        ${metrics.oplogWindowHours ?? null}, ${metrics.wtCacheUsedBytes ?? null},
        ${metrics.wtCacheMaxBytes ?? null},
        ${metrics.wtCacheDirtyBytes ?? null}, ${metrics.wtCacheTimeoutCount ?? null},
        ${metrics.wtEvictionCalls ?? null},
        ${metrics.connAppImap ?? null}, ${metrics.connAppSmtp ?? null},
        ${metrics.connAppInternal ?? null}, ${metrics.connAppMonitoring ?? null},
        ${metrics.connAppOther ?? null},
        ${metrics.gridfsMessagesBytes ?? null}, ${metrics.gridfsAttachFilesBytes ?? null},
        ${metrics.gridfsAttachChunksBytes ?? null},
        ${metrics.gridfsStorageFilesBytes ?? null}, ${metrics.gridfsStorageChunksBytes ?? null}
      )
    `;

    this.app.log.debug({ nodeId: metrics.nodeId }, "MongoDB metrics ingested");
  }

  async ingestMongodbReplEvents(events: MongodbReplEventInput[]): Promise<void> {
    if (events.length === 0) return;

    for (const event of events) {
      const timestamp = event.timestamp || new Date().toISOString();
      await this.app.sql`
        INSERT INTO mongodb_repl_events (
          time, node_id, event_type, old_role, new_role, details
        ) VALUES (
          ${timestamp}, ${event.nodeId}, ${event.eventType},
          ${event.oldRole ?? null}, ${event.newRole ?? null},
          ${event.details ? JSON.stringify(event.details) : null}
        )
      `;
    }

    this.app.log.debug({ count: events.length }, "MongoDB repl events ingested");
  }

  async ingestRedisMetrics(metrics: RedisMetricsInput): Promise<void> {
    const timestamp = metrics.timestamp || new Date().toISOString();

    await this.app.sql`
      INSERT INTO metrics_redis (
        time, node_id, memory_used_bytes, memory_max_bytes, connected_clients,
        ops_per_sec, hit_rate, evicted_keys, total_keys
      ) VALUES (
        ${timestamp}, ${metrics.nodeId}, ${metrics.memoryUsedBytes ?? null},
        ${metrics.memoryMaxBytes ?? null}, ${metrics.connectedClients ?? null},
        ${metrics.opsPerSec ?? null}, ${metrics.hitRate ?? null},
        ${metrics.evictedKeys ?? null}, ${metrics.totalKeys ?? null}
      )
    `;

    this.app.log.debug({ nodeId: metrics.nodeId }, "Redis metrics ingested");
  }

  async ingestZonemtaMetrics(metrics: ZonemtaMetricsInput): Promise<void> {
    const timestamp = metrics.timestamp || new Date().toISOString();

    await this.app.sql`
      INSERT INTO metrics_zonemta (
        time, node_id, mta_role, queue_size, active_deliveries, sent_total,
        delivered_total, bounced_total, deferred_total, rejected_total,
        connections_active, throughput_per_sec
      ) VALUES (
        ${timestamp}, ${metrics.nodeId}, ${metrics.mtaRole ?? null},
        ${metrics.queueSize ?? null}, ${metrics.activeDeliveries ?? null},
        ${metrics.sentTotal ?? null}, ${metrics.deliveredTotal ?? null},
        ${metrics.bouncedTotal ?? null}, ${metrics.deferredTotal ?? null},
        ${metrics.rejectedTotal ?? null}, ${metrics.connectionsActive ?? null},
        ${metrics.throughputPerSec ?? null}
      )
    `;

    this.app.log.debug({ nodeId: metrics.nodeId }, "ZoneMTA metrics ingested");
  }

  async ingestRspamdMetrics(metrics: RspamdMetricsInput): Promise<void> {
    const timestamp = metrics.timestamp || new Date().toISOString();

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
