# Phase 2: Backend Schema Fix & Cluster Status API

## Context Links
- Parent: [plan.md](plan.md)
- Depends on: None (first to implement)
- Research: [researcher-01-agent-backend-patterns.md](research/researcher-01-agent-backend-patterns.md)

## Overview
- **Priority**: P0 (blocker for all other phases)
- **Status**: pending
- **Description**: Fix critical schema mismatch between ingestion service, Zod validation, and Drizzle schema. Add cluster status API endpoint. Add continuous aggregates for MongoDB metrics.

## Key Insights

### Schema Mismatch (Critical)
Three layers are out of sync:

| Layer | Column Names | Fields |
|-------|-------------|--------|
| **Drizzle schema** (correct) | `connections_current`, `connections_available`, `ops_insert`, `ops_query`, `ops_update`, `ops_delete`, `ops_command`, `repl_lag_seconds`, `role`, `data_size_bytes`, `index_size_bytes`, `storage_size_bytes`, `oplog_window_hours`, `wt_cache_used_bytes`, `wt_cache_max_bytes` | 16 cols |
| **Ingestion service** (wrong) | `connections`, `op_insert`, `op_query`, `op_update`, `op_delete`, `op_getmore`, `op_command`, `replication_lag`, `replica_set_status` | 11 cols, wrong names |
| **Zod validation** (wrong) | `connections`, nested `opCounters.{insert,query,...}`, `replicationLag`, `replicaSetStatus` | nested structure, wrong names |
| **Query service** (wrong) | `connections`, `op_insert`, `op_query`, `op_update`, `op_delete`, `replication_lag`, `replica_set_status` | 9 cols, missing many |

### Resolution
Align everything to match the **Drizzle schema** (source of truth, matches PRD).

## Requirements

### Functional
- Fix Zod validation schema to accept flat structure matching Drizzle columns
- Fix ingestion service SQL to use correct column names (all 16 columns)
- Fix query service SQL to use correct column names (all 16 columns)
- Add `GET /api/v1/mongodb/cluster-status` endpoint — latest metrics from all MongoDB nodes
- Add continuous aggregates: `mongodb_stats_5m`, `mongodb_stats_1h`, `mongodb_stats_daily`

### Non-Functional
- Zero downtime: schema changes are additive (fix column names in queries, not in DB)
- Backward compat: existing seed data uses correct Drizzle schema, so data is fine

## Architecture

```
POST /api/v1/metrics  {type:"mongodb", data:{...}}
  → Zod validation (mongodbMetricsSchema) — FIXED flat structure
  → MetricsIngestionService.ingestMongodbMetrics() — FIXED column names
  → INSERT INTO metrics_mongodb (all 16 columns)

GET /api/v1/metrics/mongodb?from=&to=&nodeId=
  → MetricsQueryService.queryMongodbMetrics() — FIXED column names
  → SELECT all 16 columns FROM metrics_mongodb

GET /api/v1/mongodb/cluster-status — NEW
  → MongodbClusterService.getClusterStatus()
  → Latest row per node_id from metrics_mongodb
```

## Related Code Files

### Modify
- `packages/backend/src/schemas/metrics-validation-schemas.ts` — fix mongodbMetricsSchema
- `packages/backend/src/services/metrics-ingestion-service.ts` — fix ingestMongodbMetrics()
- `packages/backend/src/services/metrics-query-service.ts` — fix queryMongodbMetrics()
- `packages/backend/src/db/timescale-setup.sql` — add continuous aggregates
- `packages/backend/src/routes/metrics/metrics-query-routes.ts` — add cluster-status route

### Create
- `packages/backend/src/services/mongodb-cluster-status-service.ts` — cluster status aggregation
- `packages/backend/src/routes/mongodb/mongodb-cluster-routes.ts` — cluster status route

## Implementation Steps

### Step 1: Fix Zod Validation Schema
File: `packages/backend/src/schemas/metrics-validation-schemas.ts`

Replace `mongodbMetricsSchema` with flat structure matching Drizzle:
```typescript
export const mongodbMetricsSchema = z.object({
  nodeId: z.string(),
  timestamp: z.string().datetime().optional(),
  role: z.string().optional(),
  connectionsCurrent: z.number().int().nonnegative().optional(),
  connectionsAvailable: z.number().int().nonnegative().optional(),
  opsInsert: z.number().int().nonnegative().optional(),
  opsQuery: z.number().int().nonnegative().optional(),
  opsUpdate: z.number().int().nonnegative().optional(),
  opsDelete: z.number().int().nonnegative().optional(),
  opsCommand: z.number().int().nonnegative().optional(),
  replLagSeconds: z.number().nonnegative().optional(),
  dataSizeBytes: z.number().int().nonnegative().optional(),
  indexSizeBytes: z.number().int().nonnegative().optional(),
  storageSizeBytes: z.number().int().nonnegative().optional(),
  oplogWindowHours: z.number().nonnegative().optional(),
  wtCacheUsedBytes: z.number().int().nonnegative().optional(),
  wtCacheMaxBytes: z.number().int().nonnegative().optional(),
});
```

### Step 2: Fix Ingestion Service
File: `packages/backend/src/services/metrics-ingestion-service.ts`

Update `ingestMongodbMetrics()` INSERT to use all 16 correct column names:
```sql
INSERT INTO metrics_mongodb (
  time, node_id, role, connections_current, connections_available,
  ops_insert, ops_query, ops_update, ops_delete, ops_command,
  repl_lag_seconds, data_size_bytes, index_size_bytes, storage_size_bytes,
  oplog_window_hours, wt_cache_used_bytes, wt_cache_max_bytes
) VALUES (...)
```

### Step 3: Fix Query Service
File: `packages/backend/src/services/metrics-query-service.ts`

Update `queryMongodbMetrics()` SELECT to read all 16 correct columns. Add resolution logic (same pattern as `querySystemMetrics`).

### Step 4: Add Continuous Aggregates
File: `packages/backend/src/db/timescale-setup.sql`

Add 3 materialized views following existing email_stats pattern:
- `mongodb_stats_5m`: time_bucket('5 minutes'), grouped by node_id
- `mongodb_stats_1h`: time_bucket('1 hour'), grouped by node_id
- `mongodb_stats_daily`: time_bucket('1 day'), grouped by node_id

Aggregations: AVG for connections/lag/cache, MAX for sizes, SUM for ops counters.

### Step 5: Create Cluster Status Service
File: `packages/backend/src/services/mongodb-cluster-status-service.ts`

Query: `DISTINCT ON (node_id)` ordered by `time DESC` — gets latest row per node. Return array of node statuses with role, repl_lag, ops total, connections.

### Step 6: Create Cluster Status Route
File: `packages/backend/src/routes/mongodb/mongodb-cluster-routes.ts`

`GET /api/v1/mongodb/cluster-status` — protected with authHook (JWT). Returns cluster status from service.

### Step 7: Update Seed Data (if needed)
File: `packages/backend/src/db/seed/run-seed-sample-data.ts`

Verify seed data inserts match correct column names. Update if mismatched.

## Todo List
- [ ] Fix Zod mongodbMetricsSchema to flat structure
- [ ] Fix ingestion service column names (all 16)
- [ ] Fix query service column names + add resolution logic
- [ ] Add continuous aggregates to timescale-setup.sql
- [ ] Create mongodb-cluster-status-service.ts
- [ ] Create mongodb-cluster-routes.ts
- [ ] Verify/fix seed data column names
- [ ] Run compile check

## Success Criteria
- Ingestion service INSERT matches all 16 Drizzle schema columns
- Query service SELECT returns all 16 columns with correct names
- `GET /api/v1/mongodb/cluster-status` returns latest metrics per node
- Continuous aggregates created successfully
- Existing seed data still works

## Risk Assessment
- **Data loss**: No risk — fixing SQL column names in code, not altering DB
- **Breaking change**: Zod schema change is breaking for any existing agents sending old format — acceptable since no agent currently sends MongoDB metrics
- **Continuous aggregates**: May fail if table empty — use `WITH NO DATA` flag

## Security Considerations
- Cluster status endpoint requires JWT auth (dashboard users only)
- No sensitive data exposed (metrics only, no credentials)
