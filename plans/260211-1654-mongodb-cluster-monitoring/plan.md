---
title: "MongoDB Cluster Monitoring"
description: "Full-stack MongoDB replica set monitoring: agent collector, backend fixes, frontend dashboard, alerting"
status: pending
priority: P1
effort: 8h
branch: main
tags: [mongodb, monitoring, agent, frontend, backend, alerting]
created: 2026-02-11
---

# MongoDB Cluster Monitoring

## Overview

Implement end-to-end MongoDB replica set monitoring for the WildDuck Mail Monitoring Dashboard. The DB schema and basic API endpoints exist but have significant bugs. Agent collector, frontend dashboard, and 2 alert rules are missing entirely.

## Key Discovery: Schema Mismatch

The ingestion service, validation schema, and Drizzle schema are **out of sync**:
- Drizzle schema has 16 columns (correct per PRD)
- Ingestion service writes to 11 columns with **wrong names** (`connections` vs `connections_current`, `op_insert` vs `ops_insert`)
- Zod validation schema uses nested `opCounters` object — doesn't map to flat DB columns
- Query service reads wrong column names too

Phase 2 fixes this critical mismatch before any new features.

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | Agent MongoDB Collector | pending | 2h | [phase-01](phase-01-agent-mongodb-collector.md) |
| 2 | Backend Fixes & Enhancements | pending | 2h | [phase-02](phase-02-backend-fixes-enhancements.md) |
| 3 | Frontend MongoDB Dashboard | pending | 3h | [phase-03](phase-03-frontend-mongodb-dashboard.md) |
| 4 | Alert Rules | pending | 0.5h | [phase-04](phase-04-alert-rules.md) |

## Dependencies

- Phase 2 must come first (fix schema mismatch before agent can ingest)
- Phase 1 depends on Phase 2 (agent sends data matching fixed schema)
- Phase 3 depends on Phase 2 (frontend reads from fixed query service)
- Phase 4 is independent

## Implementation Order

1. Phase 2 (backend fixes) -> 2. Phase 1 (agent) -> 3. Phase 3 (frontend) -> 4. Phase 4 (alerts)

## Research

- [Agent & Backend Patterns](research/researcher-01-agent-backend-patterns.md)
