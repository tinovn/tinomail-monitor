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
}

export class MongodbClusterStatusService {
  constructor(private app: FastifyInstance) {}

  /** Get latest metrics row per MongoDB node */
  async getClusterStatus(): Promise<MongodbNodeStatus[]> {
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

    return (result as unknown as any[]).map((row) => ({
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
    }));
  }
}
