---
title: "ZoneMTA Email Event Collector"
description: "Agent collector that watches ZoneMTA MongoDB change streams for delivery events and forwards to backend ingestion API"
status: pending
priority: P1
effort: 6h
branch: main
tags: [agent, zonemta, email-events, mongodb, change-streams]
created: 2026-02-11
---

# ZoneMTA Email Event Collector

## Overview

Add a new collector to the agent that watches ZoneMTA's `zone-queue` MongoDB collection via change streams, maps delivery status transitions (SENT/BOUNCED/DEFERRED) to `EmailEvent` objects, and POSTs batches to the backend `POST /api/v1/events/ingest` endpoint.

## Architecture

```
ZoneMTA MongoDB (zone-mta DB)
  └─ zone-queue collection
       └─ Change Stream (watch status updates)
            └─ ZonemtaEmailEventCollector
                 ├─ Map: SENT→delivered, BOUNCED→bounced, DEFERRED→deferred
                 ├─ Batch: up to 50 events or 5s timeout
                 ├─ Resume token: persist to file for crash recovery
                 └─ HTTP POST → /api/v1/events/ingest (with x-api-key)
```

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | Agent config + MongoDB connection setup | pending | 1h | [phase-01](./phase-01-agent-config-and-mongodb-connection.md) |
| 2 | ZoneMTA email event collector core | pending | 3h | [phase-02](./phase-02-zonemta-email-event-collector.md) |
| 3 | Integrate collector into MonitoringAgent | pending | 1h | [phase-03](./phase-03-integrate-collector-into-monitoring-agent.md) |
| 4 | Build, test, deploy to ZoneMTA nodes | pending | 1h | [phase-04](./phase-04-build-test-and-deploy-to-zonemta-nodes.md) |

## Key Dependencies

- MongoDB replica set (already deployed as 3-node cluster)
- Backend event ingestion endpoint already implemented (`POST /api/v1/events/ingest`)
- Agent already has `mongodb` driver dependency (used by `MongodbMetricsCollector`)
- ZoneMTA uses separate `zone-mta` database (distinct from `wildduck` DB)

## Key Decisions

- **Change streams over polling** — real-time, lower latency, no missed events
- **Separate MongoDB URI** — ZoneMTA DB may differ from WildDuck DB; new `AGENT_ZONEMTA_MONGODB_URI` env var
- **Direct HTTP POST** — events go to `/api/v1/events/ingest`, not through `HttpMetricsTransport` (different endpoint pattern)
- **Resume token persistence** — file-based (`/tmp/tinomail-agent-zonemta-resume.json`) for crash recovery
- **Batch before send** — accumulate up to 50 events or 5s, whichever comes first

## Files to Create

- `packages/agent/src/collectors/zonemta-email-event-collector.ts` (~180 lines)
- `packages/agent/src/transport/event-http-transport.ts` (~60 lines)

## Files to Modify

- `packages/agent/src/agent-config.ts` — add `AGENT_ZONEMTA_MONGODB_URI`
- `packages/agent/src/monitoring-agent.ts` — wire up new collector lifecycle
