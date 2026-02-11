# Phase Implementation Report — MongoDB Metrics Collector

## Executed Phase
- Phase: Phase 1 — Agent MongoDB Metrics Collector
- Plan: Manual implementation task
- Status: Completed
- Date: 2026-02-11

## Files Modified

### Modified Files (6)
1. `/packages/agent/package.json` (1 line added)
   - Added `mongodb: ^6.0.0` dependency

2. `/packages/agent/src/agent-config.ts` (2 lines added)
   - Added `AGENT_MONGODB_URI` optional config
   - Added `AGENT_MONGODB_INTERVAL` with 30s default

3. `/packages/agent/src/transport/http-metrics-transport.ts` (changed signature)
   - Changed from `SystemMetrics` to `MetricsPayload` union type
   - Updated endpoint to `/api/v1/metrics/${payload.type}` (dynamic routing)
   - Removed hardcoded payload wrapping

4. `/packages/agent/src/transport/offline-metrics-buffer.ts` (made generic)
   - Changed buffer type from `SystemMetrics[]` to `MetricsPayload[]`
   - Updated method signatures to accept/return `MetricsPayload`

5. `/packages/agent/src/monitoring-agent.ts` (integrated MongoDB collector)
   - Added MongoDB collector import and properties
   - Added initialization in constructor when URI provided
   - Added `connect()` call in `start()` with error handling
   - Added MongoDB interval loop at 30s default
   - Added `collectAndSendMongodb()` method that collects from all replica members
   - Added `disconnect()` call in `stop()`
   - Updated `collectAndSend()` to wrap metrics in `{ type: "system", data }` payload
   - Updated buffer operations to use `MetricsPayload`

### Created Files (1)
6. `/packages/agent/src/collectors/mongodb-metrics-collector.ts` (273 lines)
   - Full replica set auto-discovery via `replSetGetStatus` command
   - Per-member connection with `directConnection: true`
   - Collects 16 metrics per member matching `MongodbMetrics` interface
   - Calculates replication lag from optime differences
   - Calculates oplog window hours (PRIMARY only) from `local.oplog.rs`
   - Aggregates DB sizes across `wildduck` + `wildduck-attachments`
   - Extracts WiredTiger cache metrics from `serverStatus`
   - Derives `nodeId` from hostname (e.g., `mongodb-01.internal:27017` → `mongodb-01`)
   - Graceful per-member error handling (partial results OK)
   - Never logs MongoDB URI (security)

## Tasks Completed
- ✅ Add mongodb dependency to package.json
- ✅ Add MongoDB env vars to agent-config.ts (URI + interval)
- ✅ Create mongodb-metrics-collector.ts with replica set discovery
- ✅ Generalize http-metrics-transport.ts to handle MetricsPayload union
- ✅ Make offline-metrics-buffer.ts generic for MetricsPayload
- ✅ Integrate MongoDB collector into monitoring-agent.ts
- ✅ Run TypeScript compilation check (passes cleanly)

## Tests Status
- Type check: **PASS** (`npx tsc --noEmit -p packages/agent/tsconfig.json`)
- Unit tests: Not applicable (collector requires live MongoDB replica set)
- Integration tests: Pending (requires backend `/api/v1/metrics/mongodb` endpoint)

## Implementation Details

### Replica Set Auto-Discovery Flow
1. Connect to primary via `AGENT_MONGODB_URI`
2. Run `replSetGetStatus` to discover all members + their roles/optimes
3. For each member: create direct connection, run `serverStatus` + `db.stats()`
4. Calculate replication lag: `PRIMARY_optime - member_optime`
5. Calculate oplog window (PRIMARY only): `lastTs - firstTs` in hours
6. Aggregate sizes across `wildduck` + `wildduck-attachments` DBs
7. Return array of `MongodbMetrics` objects (one per member)

### Security
- MongoDB URI never logged (may contain credentials)
- Auth credentials parsed from original URI and reused for member connections
- Connection timeouts: 5s (prevents hanging on unreachable members)

### Error Handling
- Connection failure at startup: logs error, sets `mongodbCollector = null`, continues without MongoDB metrics
- Per-member collection failure: logs warning, skips member, continues with other members
- Collection interval failure: logs error, doesn't crash agent

### Payload Routing
- System metrics: `POST /api/v1/metrics/system` with `{ type: "system", data: SystemMetrics }`
- MongoDB metrics: `POST /api/v1/metrics/mongodb` with `{ type: "mongodb", data: MongodbMetrics }`
- Buffer stores mixed `MetricsPayload[]` for offline queuing

## Issues Encountered
None. Clean implementation with successful TypeScript compilation.

## Next Steps
1. Implement backend endpoint `POST /api/v1/metrics/mongodb` to receive MongoDB metrics
2. Create TimescaleDB hypertable `metrics_mongodb` with 30s chunk interval
3. Test end-to-end flow with real MongoDB replica set
4. Add MongoDB metrics to dashboard UI (Server Monitoring module)

## Configuration Example

```bash
# Enable MongoDB metrics collection (optional)
AGENT_MONGODB_URI="mongodb://user:pass@mongodb-01.internal:27017,mongodb-02.internal:27017,mongodb-03.internal:27017/?replicaSet=rs0"
AGENT_MONGODB_INTERVAL=30000  # 30s (default)
```

If `AGENT_MONGODB_URI` is not set, MongoDB collector is skipped entirely.
