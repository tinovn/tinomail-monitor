import type { FastifyInstance } from "fastify";

export interface MongodbNodeStatus {
  nodeId: string;
  time: string;
  role: string | null;
  connectionsCurrent: number | null;
  connectionsAvailable: number | null;
  opsInsert: number | null;
  opsQuery: number | null;
  opsUpdate: number | null;
  opsDelete: number | null;
  opsCommand: number | null;
  replLagSeconds: number | null;
  dataSizeBytes: number | null;
  indexSizeBytes: number | null;
  storageSizeBytes: number | null;
  oplogWindowHours: number | null;
  wtCacheUsedBytes: number | null;
  wtCacheMaxBytes: number | null;
  // v2 agent fields
  wtCacheDirtyBytes: number | null;
  wtCacheTimeoutCount: number | null;
  wtEvictionCalls: number | null;
  connAppImap: number | null;
  connAppSmtp: number | null;
  connAppInternal: number | null;
  connAppMonitoring: number | null;
  connAppOther: number | null;
  gridfsMessagesBytes: number | null;
  gridfsAttachFilesBytes: number | null;
  gridfsAttachChunksBytes: number | null;
  gridfsStorageFilesBytes: number | null;
  gridfsStorageChunksBytes: number | null;
}

export class MongodbClusterStatusService {
  constructor(private app: FastifyInstance) {}

  private mapRow(row: any): MongodbNodeStatus {
    return {
      nodeId: row.node_id,
      time: row.time,
      role: row.role,
      connectionsCurrent: row.connections_current,
      connectionsAvailable: row.connections_available,
      opsInsert: row.ops_insert,
      opsQuery: row.ops_query,
      opsUpdate: row.ops_update,
      opsDelete: row.ops_delete,
      opsCommand: row.ops_command,
      replLagSeconds: row.repl_lag_seconds,
      dataSizeBytes: row.data_size_bytes,
      indexSizeBytes: row.index_size_bytes,
      storageSizeBytes: row.storage_size_bytes,
      oplogWindowHours: row.oplog_window_hours,
      wtCacheUsedBytes: row.wt_cache_used_bytes,
      wtCacheMaxBytes: row.wt_cache_max_bytes,
      wtCacheDirtyBytes: row.wt_cache_dirty_bytes ?? null,
      wtCacheTimeoutCount: row.wt_cache_timeout_count ?? null,
      wtEvictionCalls: row.wt_eviction_calls ?? null,
      connAppImap: row.conn_app_imap ?? null,
      connAppSmtp: row.conn_app_smtp ?? null,
      connAppInternal: row.conn_app_internal ?? null,
      connAppMonitoring: row.conn_app_monitoring ?? null,
      connAppOther: row.conn_app_other ?? null,
      gridfsMessagesBytes: row.gridfs_messages_bytes ?? null,
      gridfsAttachFilesBytes: row.gridfs_attach_files_bytes ?? null,
      gridfsAttachChunksBytes: row.gridfs_attach_chunks_bytes ?? null,
      gridfsStorageFilesBytes: row.gridfs_storage_files_bytes ?? null,
      gridfsStorageChunksBytes: row.gridfs_storage_chunks_bytes ?? null,
    };
  }

  /** Get latest metrics row per MongoDB node */
  async getClusterStatus(): Promise<MongodbNodeStatus[]> {
    try {
      const result = await this.app.sql`
        SELECT DISTINCT ON (node_id)
          node_id, time, role,
          connections_current, connections_available,
          ops_insert, ops_query, ops_update, ops_delete, ops_command,
          repl_lag_seconds, data_size_bytes, index_size_bytes, storage_size_bytes,
          oplog_window_hours, wt_cache_used_bytes, wt_cache_max_bytes,
          wt_cache_dirty_bytes, wt_cache_timeout_count, wt_eviction_calls,
          conn_app_imap, conn_app_smtp, conn_app_internal, conn_app_monitoring, conn_app_other,
          gridfs_messages_bytes, gridfs_attach_files_bytes, gridfs_attach_chunks_bytes,
          gridfs_storage_files_bytes, gridfs_storage_chunks_bytes
        FROM metrics_mongodb
        ORDER BY node_id, time DESC
      `;
      return (result as unknown as any[]).map((row) => this.mapRow(row));
    } catch (err: any) {
      // 42703 = undefined_column — new columns not migrated yet, fall back to base columns
      if (err?.code === "42703") {
        this.app.log.warn("mongodb cluster-status: new columns not yet migrated, using base query");
        const result = await this.app.sql`
          SELECT DISTINCT ON (node_id)
            node_id, time, role,
            connections_current, connections_available,
            ops_insert, ops_query, ops_update, ops_delete, ops_command,
            repl_lag_seconds, data_size_bytes, index_size_bytes, storage_size_bytes,
            oplog_window_hours, wt_cache_used_bytes, wt_cache_max_bytes
          FROM metrics_mongodb
          ORDER BY node_id, time DESC
        `;
        return (result as unknown as any[]).map((row) => this.mapRow(row));
      }
      throw err;
    }
  }
}
