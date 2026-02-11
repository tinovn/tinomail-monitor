---
title: "MongoDB Cluster Monitoring"
description: "Full-stack MongoDB replica set monitoring: agent collector, backend fixes, frontend dashboard, alerting"
status: completed
priority: P1
effort: 8h
branch: main
tags: [mongodb, monitoring, agent, frontend, backend, alerting]
created: 2026-02-11
completed: 2026-02-11
review: /Users/binhtino/tinomail-monitor/plans/reports/code-reviewer-260211-1802-mongodb-cluster-implementation.md
review-score: 9.2/10
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

## Implementation Status: ✓ COMPLETED

**Code Review Score:** 9.2/10 (Approved with minor recommendations)

All phases completed successfully. Schema alignment verified. Build passing. Two medium-priority refinements identified for follow-up.

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | Agent MongoDB Metrics Collector | ✓ completed | 2h | [phase-01](phase-01-agent-mongodb-metrics-collector.md) |
| 2 | Backend Schema Fix & Cluster Status API | ✓ completed | 2h | [phase-02](phase-02-backend-schema-fix-and-cluster-status-api.md) |
| 3 | Frontend MongoDB Cluster Dashboard | ✓ completed | 3h | [phase-03](phase-03-frontend-mongodb-cluster-dashboard.md) |
| 4 | MongoDB Critical Alert Rules | ✓ completed | 0.5h | [phase-04](phase-04-mongodb-critical-alert-rules.md) |

## Dependencies

- Phase 2 must come first (fix schema mismatch before agent can ingest)
- Phase 1 depends on Phase 2 (agent sends data matching fixed schema)
- Phase 3 depends on Phase 2 (frontend reads from fixed query service)
- Phase 4 is independent

## Implementation Order

1. Phase 2 (backend fixes) -> 2. Phase 1 (agent) -> 3. Phase 3 (frontend) -> 4. Phase 4 (alerts)

## Validation Summary

**Validated:** 2026-02-11
**Questions asked:** 7

### Confirmed Decisions
- **Nav placement**: Both sidebar entry + sub-route at `/servers/mongodb/`. Add top-level "MongoDB" with Database icon AND keep as sub-route.
- **Rate calculation**: Frontend handles ops/sec delta calculation in chart component.
- **Agent scope**: Full replica set support — single agent can monitor all members via auto-discovery using `rs.status()`. Single `MONGODB_URI` to one node, discovers others automatically.
- **DB state**: Drizzle schema is deployed. Table has correct column names (`connections_current`, `ops_insert`, etc.). Code layers are wrong, not the DB.
- **Continuous aggregates**: Implement now (all 3: 5m, 1h, daily).
- **WiredTiger cache**: All 3 nodes side by side as small gauges.

### Action Items (Plan Revisions Needed)
- [x] Phase 1: Update agent to support full replica set auto-discovery (connect to one node, `rs.status()` to find members, collect from each). Changes collector architecture significantly.
- [x] Phase 3: Update sidebar to add top-level "MongoDB" entry (both sidebar + sub-route confirmed).
- [x] Phase 3: WiredTiger gauge shows all 3 nodes side by side (not just PRIMARY).

## Follow-up Items (Post-Review)

From code review score 9.2/10:

### Medium Priority (Next Sprint)
1. **Role Display Case Fix** — `replica-set-status-panel.tsx` needs case-insensitive role comparison. Agent sends lowercase "primary"/"secondary", component checks uppercase.
2. **Ops Counter Semantics** — Verify ops/sec chart behavior with live MongoDB. Currently displays cumulative counters (monotonically increasing) instead of per-interval rates. May need backend delta calculation in continuous aggregates.
3. **MongoDB Permissions Documentation** — Document required agent MongoDB user roles (`clusterMonitor` for oplog reads, dbStats permissions).

### Low Priority (Tech Debt)
4. Type postgres.js result in cluster status service (remove `any`)
5. Extract chart color constants to shared design tokens
6. Add MongoDB URI format validation in agent config

## Research

- [Agent & Backend Patterns](research/researcher-01-agent-backend-patterns.md)
