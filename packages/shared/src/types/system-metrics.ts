/** Process health snapshot from agent */
export interface ProcessHealth {
  name: string;
  running: boolean;
  pid: number | null;
  cpuPercent: number;
  memoryMB: number;
}

/** System-level metrics collected every 15s from each node */
export interface SystemMetrics {
  time: Date;
  nodeId: string;
  nodeRole: string;
  cpuPercent: number;
  ramPercent: number;
  ramUsedBytes: number;
  diskPercent: number;
  diskFreeBytes: number;
  diskReadBytesSec: number;
  diskWriteBytesSec: number;
  netRxBytesSec: number;
  netTxBytesSec: number;
  netRxErrors: number;
  netTxErrors: number;
  load1m: number;
  load5m: number;
  load15m: number;
  tcpEstablished: number;
  tcpTimeWait: number;
  openFiles: number;
  /** Real-time process health (not stored in hypertable, stored in node metadata) */
  processes?: ProcessHealth[];
}

/** MongoDB-specific metrics collected every 30s */
export interface MongodbMetrics {
  time: Date;
  nodeId: string;
  role: string | null;
  connectionsCurrent: number;
  connectionsAvailable: number;
  opsInsert: number;
  opsQuery: number;
  opsUpdate: number;
  opsDelete: number;
  opsCommand: number;
  replLagSeconds: number | null;
  dataSizeBytes: number;
  indexSizeBytes: number;
  storageSizeBytes: number;
  oplogWindowHours: number | null;
  wtCacheUsedBytes: number;
  wtCacheMaxBytes: number;
  // WiredTiger cache pressure (#3)
  wtCacheDirtyBytes: number | null;
  wtCacheTimeoutCount: number | null;
  wtEvictionCalls: number | null;
  // Connection source breakdown (#4)
  connAppImap: number | null;
  connAppSmtp: number | null;
  connAppInternal: number | null;
  connAppMonitoring: number | null;
  connAppOther: number | null;
  // GridFS per-collection sizes (#6) — PRIMARY only
  gridfsMessagesBytes: number | null;
  gridfsAttachFilesBytes: number | null;
  gridfsAttachChunksBytes: number | null;
  gridfsStorageFilesBytes: number | null;
  gridfsStorageChunksBytes: number | null;
}

/** Replica set event detected by comparing consecutive collection cycles */
export interface MongodbReplEvent {
  time: Date;
  nodeId: string;
  eventType: "election" | "step_down" | "step_up" | "member_unreachable" | "member_recovered";
  oldRole: string | null;
  newRole: string | null;
  details?: Record<string, unknown>;
}

/** Redis metrics collected every 30s */
export interface RedisMetrics {
  time: Date;
  nodeId: string;
  memoryUsedBytes: number;
  memoryMaxBytes: number;
  connectedClients: number;
  opsPerSec: number;
  hitRate: number;
  evictedKeys: number;
  totalKeys: number;
}

/** ZoneMTA metrics collected every 15s */
export interface ZonemtaMetrics {
  time: Date;
  nodeId: string;
  mtaRole: string | null;
  queueSize: number;
  activeDeliveries: number;
  sentTotal: number;
  deliveredTotal: number;
  bouncedTotal: number;
  deferredTotal: number;
  rejectedTotal: number;
  connectionsActive: number;
  throughputPerSec: number;
}

/** Rspamd metrics collected every 30s */
export interface RspamdMetrics {
  time: Date;
  nodeId: string;
  scanned: number;
  ham: number;
  spam: number;
  greylist: number;
  rejected: number;
  learnedHam: number;
  learnedSpam: number;
}

/** Union type for agent metric payloads */
export type MetricsPayload =
  | { type: "system"; data: SystemMetrics }
  | { type: "mongodb"; data: MongodbMetrics }
  | { type: "mongodb_events"; data: MongodbReplEvent[] }
  | { type: "redis"; data: RedisMetrics }
  | { type: "zonemta"; data: ZonemtaMetrics }
  | { type: "rspamd"; data: RspamdMetrics };
