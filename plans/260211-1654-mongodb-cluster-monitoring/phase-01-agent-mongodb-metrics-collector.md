# Phase 1: Agent MongoDB Metrics Collector

## Context Links
- Parent: [plan.md](plan.md)
- Depends on: Phase 2 (backend must accept correct schema first)
- PRD: Section 5.2 (MongoDB Metrics)
- Research: [researcher-01-agent-backend-patterns.md](research/researcher-01-agent-backend-patterns.md)

## Overview
- **Priority**: P1
- **Status**: pending
- **Description**: Create MongoDB metrics collector in agent package using `mongodb` npm driver. Collect replica set status, server stats, DB sizes, oplog window, WiredTiger cache. Integrate into MonitoringAgent on 30s interval.

## Key Insights
- Agent uses class-based collectors with `async collect(nodeId, nodeRole)` pattern
- Transport sends gzipped JSON via `HttpMetricsTransport.send()` to `/api/v1/metrics`
- Current transport is typed to `SystemMetrics` only — needs generalization
- Agent config uses Zod env parsing — add `MONGODB_URI` + `MONGODB_COLLECT_INTERVAL`
- MonitoringAgent has single 15s interval — MongoDB needs separate 30s interval

## Requirements

### Functional
- Connect to local MongoDB via `MONGODB_URI` env var
- Run `replSetGetStatus`, `serverStatus`, `db.stats()` every 30s
- Map results to all 16 columns in `metrics_mongodb` Drizzle schema
- Calculate `repl_lag_seconds` from optime differences (PRIMARY vs self)
- Calculate `oplog_window_hours` from oplog.rs first/last timestamps
- Aggregate `data_size_bytes/index_size_bytes/storage_size_bytes` across wildduck DBs

### Non-Functional
- Lightweight: MongoDB driver adds ~3MB, acceptable for 20MB agent budget
- Graceful failure: if MongoDB unreachable, log error, skip cycle, don't crash
- Connection pooling: single persistent connection, reconnect on failure

## Architecture

```
MonitoringAgent
├── SystemMetricsCollector (15s) → POST /api/v1/metrics  {type:"system"}
├── ProcessHealthCollector (15s) → logged only
└── MongodbMetricsCollector (30s) → POST /api/v1/metrics  {type:"mongodb"}  ← NEW
```

## Related Code Files

### Modify
- `packages/agent/src/monitoring-agent.ts` — add MongoDB collector + 30s interval
- `packages/agent/src/agent-config.ts` — add MONGODB_URI, MONGODB_COLLECT_INTERVAL
- `packages/agent/src/transport/http-metrics-transport.ts` — generalize send() to accept MetricsPayload union
- `packages/agent/package.json` — add `mongodb` dependency

### Create
- `packages/agent/src/collectors/mongodb-metrics-collector.ts` — new collector class

## Implementation Steps

1. **Add `mongodb` dependency** to agent package.json
2. **Update agent-config.ts**: add `MONGODB_URI` (default `mongodb://localhost:27017`), `MONGODB_COLLECT_INTERVAL` (default `30000`), both optional (agent may not run on MongoDB nodes)
3. **Create mongodb-metrics-collector.ts**:
   - Constructor: accept `mongoUri: string`
   - `async connect()`: create MongoClient, connect, cache admin/db references
   - `async collect(nodeId: string)`: returns flat object matching MongodbMetrics interface
     - `admin.command({ replSetGetStatus: 1 })` → role, repl_lag_seconds
     - `admin.command({ serverStatus: 1 })` → connections, opcounters, wiredTiger cache
     - `db.stats()` on "wildduck" + "wildduck-attachments" → sum data/index/storage sizes
     - Oplog window: query `local.oplog.rs` for first+last ts, diff in hours
   - `async disconnect()`: close MongoClient
   - Error handling: catch per-command, return partial data with nulls for failed parts
4. **Generalize HttpMetricsTransport.send()**: accept `MetricsPayload` union type instead of just `SystemMetrics`. The endpoint `/api/v1/metrics` already routes by `type` field.
5. **Update MonitoringAgent**:
   - In constructor: if `config.MONGODB_URI` exists, instantiate `MongodbMetricsCollector`
   - In `start()`: if mongodb collector exists, start separate 30s interval calling `collectAndSendMongodb()`
   - `collectAndSendMongodb()`: collect → log → send via transport with `{type:"mongodb", data}`
   - In `stop()`: disconnect mongodb collector, clear 30s interval

## Todo List
- [ ] Add mongodb dependency
- [ ] Update agent config with MONGODB_URI, MONGODB_COLLECT_INTERVAL
- [ ] Create mongodb-metrics-collector.ts
- [ ] Generalize transport to accept MetricsPayload
- [ ] Integrate collector into MonitoringAgent
- [ ] Test with local MongoDB instance

## Success Criteria
- Agent collects all 16 metrics fields from MongoDB every 30s
- Data successfully ingested into `metrics_mongodb` hypertable
- Agent stays under 25MB RAM with MongoDB driver loaded
- Graceful degradation when MongoDB is unreachable

## Risk Assessment
- **MongoDB auth**: production MongoDB may require auth — collector must support authenticated URI
- **Oplog access**: reading `local.oplog.rs` requires clusterMonitor or similar role
- **Version compat**: MongoDB 4.4+ serverStatus format assumed

## Security Considerations
- MongoDB URI in env var may contain credentials — never log it
- Agent API key auth for metrics ingestion unchanged
