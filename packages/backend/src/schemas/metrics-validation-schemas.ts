import { z } from "zod";

// Time range query schema
export const timeRangeQuerySchema = z.object({
  nodeId: z.string().optional(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  interval: z.enum(["15s", "5m", "1h", "1d"]).optional(),
});

// System metrics ingestion schema
export const systemMetricsSchema = z.object({
  nodeId: z.string(),
  nodeRole: z.string(),
  timestamp: z.string().datetime().optional(),
  cpuPercent: z.number().min(0).max(100).optional(),
  ramPercent: z.number().min(0).max(100).optional(),
  ramUsedBytes: z.number().int().nonnegative().optional(),
  diskPercent: z.number().min(0).max(100).optional(),
  diskFreeBytes: z.number().int().nonnegative().optional(),
  diskReadBytesSec: z.number().int().nonnegative().optional(),
  diskWriteBytesSec: z.number().int().nonnegative().optional(),
  netRxBytesSec: z.number().int().nonnegative().optional(),
  netTxBytesSec: z.number().int().nonnegative().optional(),
  netRxErrors: z.number().int().nonnegative().optional(),
  netTxErrors: z.number().int().nonnegative().optional(),
  load1m: z.number().nonnegative().optional(),
  load5m: z.number().nonnegative().optional(),
  load15m: z.number().nonnegative().optional(),
  tcpEstablished: z.number().int().nonnegative().optional(),
  tcpTimeWait: z.number().int().nonnegative().optional(),
  openFiles: z.number().int().nonnegative().optional(),
});

// MongoDB metrics ingestion schema — flat structure matching Drizzle schema (16 columns)
export const mongodbMetricsSchema = z.object({
  nodeId: z.string(),
  timestamp: z.string().datetime().optional(),
  role: z.string().nullable().optional(),
  connectionsCurrent: z.number().int().nonnegative().nullable().optional(),
  connectionsAvailable: z.number().int().nonnegative().nullable().optional(),
  opsInsert: z.number().int().nonnegative().nullable().optional(),
  opsQuery: z.number().int().nonnegative().nullable().optional(),
  opsUpdate: z.number().int().nonnegative().nullable().optional(),
  opsDelete: z.number().int().nonnegative().nullable().optional(),
  opsCommand: z.number().int().nonnegative().nullable().optional(),
  replLagSeconds: z.number().nonnegative().nullable().optional(),
  dataSizeBytes: z.number().int().nonnegative().nullable().optional(),
  indexSizeBytes: z.number().int().nonnegative().nullable().optional(),
  storageSizeBytes: z.number().int().nonnegative().nullable().optional(),
  oplogWindowHours: z.number().nonnegative().nullable().optional(),
  wtCacheUsedBytes: z.number().int().nonnegative().nullable().optional(),
  wtCacheMaxBytes: z.number().int().nonnegative().nullable().optional(),
});

// Redis metrics ingestion schema — matches metrics_redis hypertable
export const redisMetricsSchema = z.object({
  nodeId: z.string(),
  timestamp: z.string().datetime().optional(),
  memoryUsedBytes: z.number().int().nonnegative().optional(),
  memoryMaxBytes: z.number().int().nonnegative().optional(),
  connectedClients: z.number().int().nonnegative().optional(),
  opsPerSec: z.number().nonnegative().optional(),
  hitRate: z.number().nonnegative().optional(),
  evictedKeys: z.number().int().nonnegative().optional(),
  totalKeys: z.number().int().nonnegative().optional(),
});

// ZoneMTA metrics ingestion schema — matches metrics_zonemta hypertable
export const zonemtaMetricsSchema = z.object({
  nodeId: z.string(),
  timestamp: z.string().datetime().optional(),
  mtaRole: z.string().nullable().optional(),
  queueSize: z.number().int().nonnegative().optional(),
  activeDeliveries: z.number().int().nonnegative().optional(),
  sentTotal: z.number().int().nonnegative().optional(),
  deliveredTotal: z.number().int().nonnegative().optional(),
  bouncedTotal: z.number().int().nonnegative().optional(),
  deferredTotal: z.number().int().nonnegative().optional(),
  rejectedTotal: z.number().int().nonnegative().optional(),
  connectionsActive: z.number().int().nonnegative().optional(),
  throughputPerSec: z.number().nonnegative().optional(),
});

// Rspamd metrics ingestion schema
export const rspamdMetricsSchema = z.object({
  nodeId: z.string(),
  timestamp: z.string().datetime().optional(),
  scanned: z.number().int().nonnegative().optional(),
  spam: z.number().int().nonnegative().optional(),
  ham: z.number().int().nonnegative().optional(),
  greylist: z.number().int().nonnegative().optional(),
  rejected: z.number().int().nonnegative().optional(),
  softReject: z.number().int().nonnegative().optional(),
  avgScore: z.number().optional(),
});

export type TimeRangeQuery = z.infer<typeof timeRangeQuerySchema>;
export type SystemMetricsInput = z.infer<typeof systemMetricsSchema>;
export type MongodbMetricsInput = z.infer<typeof mongodbMetricsSchema>;
export type RedisMetricsInput = z.infer<typeof redisMetricsSchema>;
export type ZonemtaMetricsInput = z.infer<typeof zonemtaMetricsSchema>;
export type RspamdMetricsInput = z.infer<typeof rspamdMetricsSchema>;
