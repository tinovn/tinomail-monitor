# Agent & Backend Patterns Research

**Date:** 2026-02-11
**Researcher:** researcher-01
**Task:** MongoDB monitoring implementation patterns

---

## Agent Collector Pattern

### Class Structure
- Located: `packages/agent/src/collectors/`
- Pattern: Single responsibility collectors with caching for rate calculations

**SystemMetricsCollector** (system-metrics-collector.ts):
```typescript
class SystemMetricsCollector {
  private cache: CachedStats | null = null;

  async collect(nodeId: string, nodeRole: string): Promise<SystemMetrics> {
    // Returns object matching SystemMetrics interface from @tinomail/shared
    // Uses systeminformation library (si.*)
    // Caches previous readings for rate calculations (diskIO, network)
    return { time: new Date(), nodeId, nodeRole, ...metrics };
  }
}
```

**Key Patterns:**
- Constructor: No dependencies, simple instantiation
- Method: `async collect(nodeId: string, nodeRole: string)` → returns typed metrics object
- Caching: Instance variable for delta calculations (bytes/sec rates)
- Error handling: Throws errors, caught by orchestrator
- Time: Returns `new Date()` in metrics object (not ISO string)

---

## Agent Orchestrator Pattern

### MonitoringAgent (monitoring-agent.ts)

**Collector Management:**
```typescript
private metricsCollector: SystemMetricsCollector;
private processCollector: ProcessHealthCollector;

constructor(config: AgentConfig) {
  this.metricsCollector = new SystemMetricsCollector();
  this.processCollector = new ProcessHealthCollector();
  // Transport setup...
}
```

**Collection Loop:**
- Interval: `AGENT_HEARTBEAT_INTERVAL` (typically 15s)
- Pattern: `setInterval(() => this.collectAndSend().catch(...), interval)`
- Immediate first collection after start
- Sequential: collect → log → send → buffer on failure

**Error Handling:**
- Collection errors: Log + buffer metrics for later retry
- Transport errors: Buffer metrics, flush on next success
- No crashes: Errors caught in interval callback

**Transport:**
- Uses `HttpMetricsTransport.send(metrics)`
- Endpoint: `POST ${serverUrl}/api/v1/metrics/system`
- Headers: `x-api-key`, `Content-Type: application/json`
- Body: JSON payload matching SystemMetrics interface

---

## Backend Query Service Bugs

### File: packages/backend/src/services/metrics-query-service.ts

**Line 99-100 (queryZonemtaMetrics):**
```sql
SELECT sent_1h, bounced_1h, deferred_1h, avg_latency
FROM metrics_zonemta
```

**BUG:** Column names don't match schema:
- Schema has: `sent_total`, `bounced_total`, `deferred_total` (cumulative counters)
- Query uses: `sent_1h`, `bounced_1h`, `deferred_1h` (non-existent)
- `avg_latency` exists but should be `avg_delivery_ms` for consistency

**Line 63-64 (queryMongodbMetrics):**
```sql
SELECT connections, op_insert, op_query, op_update, op_delete,
       replication_lag, replica_set_status
```

**BUG:** Missing columns from ingestion:
- Schema has: `op_getmore`, `op_command` (lines 41, 46 in ingestion service)
- Query omits these columns

**Fix Required:**
1. ZoneMTA: Rename columns or fix query to match actual schema
2. MongoDB: Add missing `op_getmore`, `op_command` to SELECT

---

## Backend Ingestion Pattern

### File: packages/backend/src/services/metrics-ingestion-service.ts

**MongoDB Metrics Ingestion (lines 35-51):**
```typescript
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
```

**Pattern:**
- Timestamp handling: `metrics.timestamp ? new Date(...) : new Date()`
- Null coalescing: `${metrics.field ?? null}` for optional fields
- Nested objects: `metrics.opCounters?.insert` for sub-objects
- Logging: Debug log with nodeId context
- No transaction: Single INSERT statement
- No error handling: Throws on failure (caught by route handler)

---

## Continuous Aggregates Pattern

### File: packages/backend/src/db/timescale-setup.sql

**No MongoDB Continuous Aggregates Exist**
- Only `email_stats_5m`, `email_stats_1h`, `email_stats_daily` defined
- Metrics tables (system, mongodb, redis, etc.) have NO continuous aggregates
- System metrics query service manually selects resolution using table suffixes

**Email Stats Pattern (lines 32-48):**
```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS email_stats_5m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', time) AS bucket,
  from_domain, mta_node, sending_ip, event_type,
  COUNT(*) AS event_count,
  AVG(delivery_time_ms) AS avg_delivery_ms,
  AVG(message_size) AS avg_message_size,
  SUM(CASE WHEN dkim_result = 'pass' THEN 1 ELSE 0 END) AS dkim_pass,
  -- ...
FROM email_events
GROUP BY bucket, from_domain, mta_node, sending_ip, event_type
WITH NO DATA;
```

**Key Patterns:**
- `time_bucket()` for aggregation window
- Group by bucket + dimensions
- `COUNT(*)` → `event_count`
- `AVG(column)` → `avg_column`
- Conditional aggregates: `SUM(CASE WHEN ... THEN 1 ELSE 0 END)`
- `WITH NO DATA` flag on creation
- Refresh policy: `start_offset`, `end_offset`, `schedule_interval`

**Compression:**
- `compress_segmentby = 'node_id'` for metrics tables
- `compress_orderby = 'time DESC'`
- Policy: compress after 7 days
- Retention: 90 days for metrics, 180 days for email_events

---

## System Metrics Resolution Selection

### MetricsQueryService.querySystemMetrics (lines 30-53)

**Auto-Resolution Logic:**
```typescript
private selectResolution(from: Date, to: Date): string {
  const durationMs = to.getTime() - from.getTime();
  const hours = durationMs / (1000 * 60 * 60);

  if (hours < 6) return "raw";      // metrics_system
  if (hours < 48) return "5m";      // metrics_system_5m
  if (hours < 720) return "1h";     // metrics_system_1h
  return "1d";                       // metrics_system_1d
}
```

**Table Naming:**
- Raw: `metrics_system`
- Aggregates: `metrics_system_5m`, `metrics_system_1h`, `metrics_system_1d`
- Query uses: `FROM ${this.app.sql(tableName)}`

**Implication for MongoDB:**
- Need to create continuous aggregates: `metrics_mongodb_5m`, `_1h`, `_1d`
- Follow same resolution selection pattern
- Or query raw data only (simpler, less performant for long ranges)

---

## Transport & HTTP Posting

### HttpMetricsTransport Pattern

**From monitoring-agent.ts usage:**
```typescript
await this.transport.send(metrics);
```

**Expected Implementation:**
- POST to `/api/v1/metrics/{type}` (e.g., `/api/v1/metrics/mongodb`)
- Headers: `x-api-key`, `Content-Type: application/json`
- Body: JSON.stringify(metrics object)
- Timeout: 10s (from transportConfig)
- Retries: Max 3 (from transportConfig)
- Error handling: Throws on failure → triggers buffering

**Node Registration (lines 83-125):**
- POST `/api/v1/nodes` before starting collection
- Payload: `{ nodeId, hostname, ipAddress, role, metadata }`
- Auth: Same `x-api-key` header
- Required before agent can send metrics

---

## Summary

**Agent Collector Requirements:**
1. Class with `async collect(nodeId: string, nodeRole: string)` method
2. Return typed object with `time: Date` + metrics fields
3. Use instance caching for rate calculations (delta metrics)
4. No dependencies in constructor
5. Throw errors for orchestrator to catch

**Backend Ingestion Requirements:**
1. Accept typed input matching shared schema
2. Handle timestamp: `metrics.timestamp ? new Date(...) : new Date()`
3. Use `?? null` for optional fields
4. Single INSERT statement via `this.app.sql` tagged template
5. Debug log with nodeId context

**Backend Query Bugs:**
- ZoneMTA: Wrong column names (`sent_1h` vs `sent_total`)
- MongoDB: Missing `op_getmore`, `op_command` in SELECT

**Continuous Aggregates:**
- Not yet implemented for metrics tables
- Pattern: `time_bucket()`, GROUP BY bucket + dimensions, aggregation functions
- Refresh policy needed for auto-updates
- Compression + retention apply to base tables

---

## Unresolved Questions

1. Should MongoDB metrics use continuous aggregates or raw-only queries?
2. What time range is typical for MongoDB dashboard queries (affects aggregate need)?
3. Are there existing `metrics_mongodb_5m/1h/1d` tables we missed in timescale-setup.sql?
