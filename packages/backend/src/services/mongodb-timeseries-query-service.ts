import type { FastifyInstance } from "fastify";

export interface ReplEvent {
  time: string;
  nodeId: string;
  eventType: string;
  oldRole: string | null;
  newRole: string | null;
  details: Record<string, unknown> | null;
}

export interface OplogForecast {
  currentWindowHours: number | null;
  consumptionRatePerHour: number | null;
  forecastDays: number | null;
  dataPoints: { time: string; value: number }[];
}

export interface ConnectionBreakdown {
  nodeId: string;
  connAppImap: number | null;
  connAppSmtp: number | null;
  connAppInternal: number | null;
  connAppMonitoring: number | null;
  connAppOther: number | null;
}

export interface GridfsBreakdown {
  nodeId: string;
  gridfsMessagesBytes: number | null;
  gridfsAttachFilesBytes: number | null;
  gridfsAttachChunksBytes: number | null;
  gridfsStorageFilesBytes: number | null;
  gridfsStorageChunksBytes: number | null;
}

export class MongodbTimeseriesQueryService {
  constructor(private app: FastifyInstance) {}

  /** Query replication events within a time range, newest first, limit 100 */
  async getReplEvents(from: string, to: string): Promise<ReplEvent[]> {
    const result = await this.app.sql`
      SELECT time, node_id, event_type, old_role, new_role, details
      FROM mongodb_repl_events
      WHERE time >= ${from}::timestamptz AND time <= ${to}::timestamptz
      ORDER BY time DESC
      LIMIT 100
    `;

    return (result as unknown as any[]).map((row) => ({
      time: row.time instanceof Date ? row.time.toISOString() : row.time,
      nodeId: row.node_id,
      eventType: row.event_type,
      oldRole: row.old_role,
      newRole: row.new_role,
      details: row.details,
    }));
  }

  /** Get last 20 data points of repl_lag_seconds per secondary node */
  async getReplLagSparkline(): Promise<Record<string, number[]>> {
    const result = await this.app.sql`
      SELECT node_id, time, repl_lag_seconds
      FROM metrics_mongodb
      WHERE role != 'primary' AND repl_lag_seconds IS NOT NULL
        AND time >= NOW() - INTERVAL '20 minutes'
      ORDER BY node_id, time ASC
    `;

    const grouped: Record<string, number[]> = {};
    for (const row of result as unknown as any[]) {
      const nodeId: string = row.node_id;
      if (!grouped[nodeId]) grouped[nodeId] = [];
      grouped[nodeId].push(Number(row.repl_lag_seconds));
    }

    // Keep last 20 per node
    for (const nodeId of Object.keys(grouped)) {
      grouped[nodeId] = grouped[nodeId].slice(-20);
    }

    return grouped;
  }

  /** Calculate oplog consumption rate and forecast days remaining */
  async getOplogForecast(): Promise<OplogForecast> {
    const result = await this.app.sql`
      SELECT time, oplog_window_hours
      FROM metrics_mongodb
      WHERE role = 'primary' AND oplog_window_hours IS NOT NULL
        AND time >= NOW() - INTERVAL '24 hours'
      ORDER BY time ASC
    `;

    const rows = result as unknown as any[];
    const dataPoints = rows.map((row) => ({
      time: row.time instanceof Date ? row.time.toISOString() : row.time,
      value: Number(row.oplog_window_hours),
    }));

    if (dataPoints.length < 2) {
      const currentWindowHours = dataPoints.length === 1 ? dataPoints[0].value : null;
      return { currentWindowHours, consumptionRatePerHour: null, forecastDays: null, dataPoints };
    }

    // Linear regression to get hourly consumption rate
    const n = dataPoints.length;
    const first = new Date(dataPoints[0].time).getTime();
    const xVals = dataPoints.map((p) => (new Date(p.time).getTime() - first) / 3_600_000); // hours
    const yVals = dataPoints.map((p) => p.value);

    const sumX = xVals.reduce((a, b) => a + b, 0);
    const sumY = yVals.reduce((a, b) => a + b, 0);
    const sumXY = xVals.reduce((acc, x, i) => acc + x * yVals[i], 0);
    const sumX2 = xVals.reduce((acc, x) => acc + x * x, 0);

    const denom = n * sumX2 - sumX * sumX;
    const consumptionRatePerHour = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : null;

    const currentWindowHours = yVals[yVals.length - 1];
    const forecastDays =
      consumptionRatePerHour !== null && Math.abs(consumptionRatePerHour) > 0
        ? currentWindowHours / Math.abs(consumptionRatePerHour) / 24
        : null;

    return { currentWindowHours, consumptionRatePerHour, forecastDays, dataPoints };
  }

  /** Latest connection app breakdown from PRIMARY node */
  async getConnectionBreakdown(): Promise<ConnectionBreakdown | null> {
    const result = await this.app.sql`
      SELECT DISTINCT ON (node_id)
        node_id, conn_app_imap, conn_app_smtp, conn_app_internal, conn_app_monitoring, conn_app_other
      FROM metrics_mongodb
      WHERE role = 'primary' AND time >= NOW() - INTERVAL '1 hour'
      ORDER BY node_id, time DESC
    `;

    const rows = result as unknown as any[];
    if (rows.length === 0) return null;
    const row = rows[0];

    return {
      nodeId: row.node_id,
      connAppImap: row.conn_app_imap,
      connAppSmtp: row.conn_app_smtp,
      connAppInternal: row.conn_app_internal,
      connAppMonitoring: row.conn_app_monitoring,
      connAppOther: row.conn_app_other,
    };
  }

  /** Latest GridFS storage breakdown from PRIMARY node */
  async getGridfsBreakdown(): Promise<GridfsBreakdown | null> {
    const result = await this.app.sql`
      SELECT DISTINCT ON (node_id)
        node_id, gridfs_messages_bytes, gridfs_attach_files_bytes, gridfs_attach_chunks_bytes,
        gridfs_storage_files_bytes, gridfs_storage_chunks_bytes
      FROM metrics_mongodb
      WHERE role = 'primary' AND time >= NOW() - INTERVAL '1 hour'
      ORDER BY node_id, time DESC
    `;

    const rows = result as unknown as any[];
    if (rows.length === 0) return null;
    const row = rows[0];

    return {
      nodeId: row.node_id,
      gridfsMessagesBytes: row.gridfs_messages_bytes,
      gridfsAttachFilesBytes: row.gridfs_attach_files_bytes,
      gridfsAttachChunksBytes: row.gridfs_attach_chunks_bytes,
      gridfsStorageFilesBytes: row.gridfs_storage_files_bytes,
      gridfsStorageChunksBytes: row.gridfs_storage_chunks_bytes,
    };
  }
}
