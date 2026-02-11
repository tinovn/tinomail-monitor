# Debug Report: Server Detail Charts Empty & MongoDB Page Empty

**Date:** 2026-02-11 19:05
**Reporter:** debugger agent
**Environment:** Production (https://mail-monitor.tino.vn)

---

## Executive Summary

Two critical frontend display issues identified with **ZERO data rendering** despite database containing valid metrics:

1. **Server Detail Page Charts Empty**: All 4 charts (CPU, RAM, Disk, Network) fail to render on `/servers/db1`
2. **MongoDB Page Shows "No MongoDB nodes found"**: Despite 3 registered MongoDB nodes actively sending metrics

**Root Cause:** **MISSING BACKEND API ROUTES** — Frontend components call endpoints that don't exist in backend

**Impact:** Complete loss of system monitoring visibility for server metrics and MongoDB cluster status

---

## Issue #1: Server Detail Page Charts Empty

### Symptoms
- URL: `/servers/db1`
- Header info displays correctly (status, role, IP, hostname, uptime)
- All 4 charts render empty — no data points
- No console errors (requests return 404, handled silently by API client)

### Root Cause: Missing Backend Routes

**Frontend expects these endpoints:**
```
GET /api/v1/metrics/node/{nodeId}/cpu?from=...&to=...
GET /api/v1/metrics/node/{nodeId}/ram?from=...&to=...
GET /api/v1/metrics/node/{nodeId}/disk
GET /api/v1/metrics/node/{nodeId}/network?from=...&to=...
```

**Backend reality:** These routes **DO NOT EXIST**

### Evidence

#### Frontend Chart Components
All 4 components follow identical pattern calling non-existent routes:

**1. CPU Chart** (`packages/frontend/src/components/servers/cpu-usage-realtime-line-chart.tsx:22`)
```typescript
queryFn: () =>
  apiClient.get<MetricDataPoint[]>(`/metrics/node/${nodeId}/cpu`, {
    from: from.toISOString(),
    to: to.toISOString(),
  }),
```

**2. RAM Chart** (`packages/frontend/src/components/servers/ram-usage-stacked-area-chart.tsx:23`)
```typescript
queryFn: () =>
  apiClient.get<RamDataPoint[]>(`/metrics/node/${nodeId}/ram`, {
    from: from.toISOString(),
    to: to.toISOString(),
  }),
```

**3. Disk Chart** (`packages/frontend/src/components/servers/disk-usage-partition-bar-chart.tsx:22`)
```typescript
queryFn: () => apiClient.get<DiskPartition[]>(`/metrics/node/${nodeId}/disk`),
```

**4. Network Chart** (`packages/frontend/src/components/servers/network-bandwidth-dual-axis-chart.tsx:23`)
```typescript
queryFn: () =>
  apiClient.get<NetworkDataPoint[]>(`/metrics/node/${nodeId}/network`, {
    from: from.toISOString(),
    to: to.toISOString(),
  }),
```

#### Backend Route Registration
**File:** `packages/backend/src/app-factory.ts`

Routes registered under `/api/v1/metrics` prefix:
```typescript
await app.register(metricsIngestionRoutes, { prefix: "/api/v1/metrics" }); // Line 110
await app.register(metricsQueryRoutes, { prefix: "/api/v1/metrics" });     // Line 111
await app.register(dashboardMetricsRoutes, { prefix: "/api/v1/metrics" }); // Line 112
```

**Actual routes in metrics-query-routes.ts:**
- `/system` — generic system metrics query
- `/mongodb` — generic MongoDB metrics query
- `/redis` — generic Redis metrics query
- `/zonemta` — generic ZoneMTA metrics query
- `/rspamd` — generic Rspamd metrics query

**Actual routes in dashboard-metrics-routes.ts:**
- `/email-throughput` — email throughput time-series
- `/bounce-rate` — bounce rate trend
- `/top-domains` — top sending domains

**NONE** of the required `/metrics/node/{nodeId}/{metric}` routes exist.

### Database Schema (Data IS Available)

**Table:** `metrics_system` (hypertable)
**Columns:** `time`, `node_id`, `node_role`, `cpu_percent`, `ram_percent`, `ram_used_bytes`, `disk_percent`, `disk_free_bytes`, `disk_read_bytes_sec`, `disk_write_bytes_sec`, `net_rx_bytes_sec`, `net_tx_bytes_sec`, etc.

Data collection confirmed — agents POST to `/api/v1/metrics/system` every 15s (ingestion routes exist and work).

---

## Issue #2: MongoDB Page Shows "No MongoDB nodes found"

### Symptoms
- URL: `/servers/mongodb`
- Page renders "No MongoDB nodes found" empty state
- 3 MongoDB nodes (db1, db2, db3) ARE registered in `nodes` table
- MongoDB metrics ARE being collected in `metrics_mongodb` table

### Root Cause: SQL Query Doesn't Filter by MongoDB Nodes

**Frontend expects:** MongoDB-specific nodes from `/api/v1/mongodb/cluster-status`

**Backend service query** (`packages/backend/src/services/mongodb-cluster-status-service.ts:28-37`):
```sql
SELECT DISTINCT ON (node_id)
  node_id, time, role,
  connections_current, connections_available,
  ops_insert, ops_query, ops_update, ops_delete, ops_command,
  repl_lag_seconds, data_size_bytes, index_size_bytes, storage_size_bytes,
  oplog_window_hours, wt_cache_used_bytes, wt_cache_max_bytes
FROM metrics_mongodb
ORDER BY node_id, time DESC
```

**PROBLEM:** Query returns data from `metrics_mongodb` table, but:
1. **IF agents aren't sending MongoDB metrics** → table empty → service returns `[]`
2. **OR table has no rows** (MongoDB metrics ingestion might be failing silently)

**Key Question:** Are MongoDB agents configured to POST to `/api/v1/metrics/mongodb`?

### Investigation Needed
Need to verify:
1. Do MongoDB node agents send POST requests to `/api/v1/metrics/mongodb`?
2. Check agent config files on db1/db2/db3 servers
3. Query `metrics_mongodb` table directly — does it have ANY rows?
4. Check backend logs for MongoDB metrics ingestion attempts/failures

---

## Technical Analysis

### API Route Architecture

**Current backend structure:**
- `/api/v1/metrics/system` (POST) — ingestion endpoint (works ✓)
- `/api/v1/metrics/{type}` (GET) — generic queries for all nodes of a type
- `/api/v1/nodes/{id}` (GET) — node metadata only (no metrics)

**Missing pattern:**
- `/api/v1/metrics/node/{nodeId}/cpu` — single-node CPU time-series
- `/api/v1/metrics/node/{nodeId}/ram` — single-node RAM time-series
- `/api/v1/metrics/node/{nodeId}/disk` — single-node disk snapshot
- `/api/v1/metrics/node/{nodeId}/network` — single-node network time-series

### Data Availability

**System Metrics (metrics_system table):**
- CPU: `cpu_percent` column
- RAM: `ram_percent`, `ram_used_bytes` columns
- Disk: `disk_percent`, `disk_free_bytes` columns
- Network: `net_rx_bytes_sec`, `net_tx_bytes_sec` columns

**Query pattern needed:**
```sql
-- CPU/RAM/Network (time-series)
SELECT time, cpu_percent AS value
FROM metrics_system
WHERE node_id = $1
  AND time >= $2::timestamptz
  AND time <= $3::timestamptz
ORDER BY time ASC

-- Disk (latest snapshot by partition)
-- NOTE: metrics_system doesn't store per-partition data
-- Need to check if agent sends partition details
```

**BLOCKER:** Disk chart expects per-partition data (`DiskPartition[]`), but `metrics_system` only stores aggregate `disk_percent`. Need to verify agent payload structure.

### Frontend Error Handling

**Silent failure pattern:**
```typescript
const { data, isLoading } = useQuery({
  queryKey: ["node-cpu", nodeId, from, to],
  queryFn: () => apiClient.get(...), // Returns 404
  refetchInterval: autoRefresh ? autoRefresh * 1000 : false,
});

// Chart renders with empty data array
series: [{ data: (data || []).map(...) }] // data === undefined → []
```

404 responses handled by API client, no error propagated to user. Charts render with empty arrays.

---

## Solution Design

### Fix #1: Implement Node-Specific Metrics Routes

**New backend file:** `packages/backend/src/routes/metrics/node-metrics-routes.ts`

**Required endpoints:**
1. `GET /api/v1/metrics/node/:nodeId/cpu?from=...&to=...`
2. `GET /api/v1/metrics/node/:nodeId/ram?from=...&to=...`
3. `GET /api/v1/metrics/node/:nodeId/disk` (latest snapshot)
4. `GET /api/v1/metrics/node/:nodeId/network?from=...&to=...`

**Service layer:** Create `NodeMetricsService` class with methods:
- `queryCpuMetrics(nodeId, from, to)` → returns `Array<{time, value}>`
- `queryRamMetrics(nodeId, from, to)` → returns `Array<{time, usedPercent, freePercent}>`
- `queryDiskMetrics(nodeId)` → returns `Array<{partition, usedPercent, total}>`
- `queryNetworkMetrics(nodeId, from, to)` → returns `Array<{time, rxBytesPerSec, txBytesPerSec}>`

**Register route:** Add to `app-factory.ts`:
```typescript
await app.register(nodeMetricsRoutes, { prefix: "/api/v1/metrics" });
```

### Fix #2: Verify MongoDB Metrics Ingestion

**Steps:**
1. SSH to db1/db2/db3 servers
2. Check agent config: `cat /path/to/agent/.env` (verify MongoDB metrics enabled)
3. Query database:
   ```sql
   SELECT COUNT(*), MIN(time), MAX(time)
   FROM metrics_mongodb;

   SELECT DISTINCT node_id FROM metrics_mongodb;
   ```
4. If table empty:
   - Check agent logs for errors
   - Verify agent sends POST `/api/v1/metrics/mongodb`
   - Check backend logs for validation errors
5. If ingestion works but service returns empty:
   - Query might need WHERE clause filtering
   - Check if `role` column populated correctly

---

## Supporting Files

### Frontend Components
- `packages/frontend/src/routes/_authenticated/servers/$nodeId.tsx` — server detail page
- `packages/frontend/src/routes/_authenticated/servers/mongodb/index.tsx` — MongoDB page
- `packages/frontend/src/components/servers/cpu-usage-realtime-line-chart.tsx` — CPU chart
- `packages/frontend/src/components/servers/ram-usage-stacked-area-chart.tsx` — RAM chart
- `packages/frontend/src/components/servers/disk-usage-partition-bar-chart.tsx` — Disk chart
- `packages/frontend/src/components/servers/network-bandwidth-dual-axis-chart.tsx` — Network chart

### Backend Routes
- `packages/backend/src/app-factory.ts` — route registration
- `packages/backend/src/routes/metrics/metrics-query-routes.ts` — existing generic queries
- `packages/backend/src/routes/metrics/dashboard-metrics-routes.ts` — dashboard overview metrics
- `packages/backend/src/routes/metrics/metrics-ingestion-routes.ts` — agent POST endpoints
- `packages/backend/src/routes/mongodb/mongodb-cluster-routes.ts` — MongoDB status API
- `packages/backend/src/routes/node/node-routes.ts` — node CRUD operations

### Backend Services
- `packages/backend/src/services/mongodb-cluster-status-service.ts` — MongoDB cluster query
- `packages/backend/src/services/node-service.ts` — node management
- `packages/backend/src/services/metrics-ingestion-service.ts` — metrics ingestion

### Database Schema
- `packages/backend/src/db/schema/metrics-system-hypertable.ts` — system metrics table
- `packages/backend/src/db/schema/metrics-mongodb-hypertable.ts` — MongoDB metrics table
- `packages/backend/src/db/schema/nodes-table.ts` — node registry

---

## Action Items

### Immediate (Restore Monitoring)
1. **Implement node-specific metrics routes** (all 4 endpoints)
2. **Test endpoints** with curl:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     "https://mail-monitor.tino.vn/api/v1/metrics/node/db1/cpu?from=2026-02-11T10:00:00Z&to=2026-02-11T19:00:00Z"
   ```
3. **Verify charts populate** in frontend

### Investigation (MongoDB)
1. **Query metrics_mongodb table** — confirm data exists
2. **Check agent configs** on db1/db2/db3
3. **Review backend logs** for MongoDB ingestion errors
4. **Fix ingestion or query** based on findings

### Code Quality
1. **Add error states** to chart components (show 404 errors to user)
2. **Add backend route tests** for new node metrics endpoints
3. **Add frontend query error handling** (display "API error" instead of empty charts)

---

## Unresolved Questions

1. **Disk partition data**: Does agent POST per-partition disk usage? Or only aggregate?
   - If aggregate only, frontend `DiskPartition` interface won't match
   - May need to adjust chart to show single bar instead of multi-partition

2. **MongoDB metrics ingestion**: Are db1/db2/db3 agents configured to collect MongoDB stats?
   - Check if agent detects MongoDB process running
   - Verify agent has permissions to query MongoDB serverStatus

3. **Time-series interval**: Should node metrics queries use continuous aggregates (5m/1h/daily)?
   - Current dashboard routes use time-bucket logic based on range
   - Node routes should follow same pattern for consistency

4. **Auth permissions**: Do all user roles have access to node metrics?
   - `authHook` applied to all routes — verify JWT role checks

5. **Performance**: Will per-node queries scale with 15+ servers?
   - Consider adding caching layer (Redis)
   - Monitor query performance under load
