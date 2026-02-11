---
title: "WildDuck Mail Monitoring Dashboard"
description: "Custom monitoring dashboard for WildDuck mail infrastructure with 13 modules"
status: pending
priority: P1
effort: "14-18 weeks"
branch: main
tags: [monitoring, dashboard, wildduck, timescaledb, react, fastify]
created: 2026-02-11
---

# WildDuck Mail Monitoring Dashboard

Custom-built monitoring system for 15+ mail servers (WildDuck, Haraka, ZoneMTA, MongoDB, Redis, Rspamd). No Grafana/Prometheus. Full control over UX.

## Tech Stack
- **Backend:** Fastify + Drizzle ORM + Socket.IO + BullMQ
- **Frontend:** React 18 + shadcn/ui + TanStack Table/Router + ECharts + Zustand + React Query v5
- **Database:** TimescaleDB (PostgreSQL 16) + Redis 7
- **Agent:** Node.js + systeminformation, HTTP POST, 15s heartbeat
- **Ingestion:** ZoneMTA HTTP POST hooks -> BullMQ -> TimescaleDB

## Phases

| # | Phase | Effort | Status | File |
|---|-------|--------|--------|------|
| 01 | Project Setup & Infrastructure | 3-4d | pending | [phase-01](./phase-01-project-setup-and-infrastructure.md) |
| 02 | Database Schema & Migrations | 2-3d | pending | [phase-02](./phase-02-database-schema-and-migrations.md) |
| 03 | Backend API Core | 4-5d | pending | [phase-03](./phase-03-backend-api-core.md) |
| 04 | Agent Development | 3-4d | pending | [phase-04](./phase-04-agent-development.md) |
| 05 | Frontend Foundation | 4-5d | pending | [phase-05](./phase-05-frontend-foundation.md) |
| 06 | Overview Dashboard + Server Monitoring | 5-7d | pending | [phase-06](./phase-06-overview-dashboard-and-server-monitoring.md) |
| 07 | Email Flow + Event Pipeline | 5-7d | pending | [phase-07](./phase-07-email-flow-and-event-pipeline.md) |
| 08 | ZoneMTA Cluster + IP Management | 5-7d | pending | [phase-08](./phase-08-zonemta-ip-management.md) |
| 09 | Domain Quality + User Analytics | 5-7d | pending | [phase-09](./phase-09-domain-quality-and-user-analytics.md) |
| 10 | IP Reputation + Blacklist Monitor | 5-7d | pending | [phase-10](./phase-10-ip-reputation-blacklist-monitor.md) |
| 11 | Spam & Security + Log Viewer | 5-7d | pending | [phase-11](./phase-11-spam-security-and-log-viewer.md) |
| 12 | Alerting System | 5-7d | pending | [phase-12](./phase-12-alerting-system.md) |
| 13 | Reports, Admin & Polish | 5-7d | pending | [phase-13](./phase-13-reports-admin-and-polish.md) |

## Dependencies
- Phase 01-02: No deps (start first)
- Phase 03: Requires 01, 02
- Phase 04: Requires 01, 03
- Phase 05: Requires 01
- Phase 06: Requires 03, 04, 05
- Phase 07-13: Requires 06 (sequential, some parallelizable)

## Research Reports
- [Backend & Realtime Pipeline](./research/researcher-01-backend-realtime-pipeline.md)
- [Frontend, Database & Agent](./research/researcher-02-frontend-database-agent.md)

## Key Risks
1. TimescaleDB performance at scale (1000+ IPs, 10K events/sec) - mitigate with chunking + continuous aggregates
2. ZoneMTA plugin hook reliability - need async queue buffer (BullMQ)
3. Frontend rendering with 1000+ row tables - mitigate with TanStack Virtual

## Validation Summary

**Validated:** 2026-02-11
**Questions asked:** 8

### Confirmed Decisions
- **ORM**: Drizzle + raw SQL hybrid — Drizzle for CRUD tables, raw SQL for TimescaleDB-specific queries
- **Event Ingestion**: ZoneMTA HTTP POST hooks (primary) + MongoDB change streams (backup/audit)
- **DNSBL Auto-pause**: Auto-pause after 2 consecutive checks (not immediate) — prevents false positive disruption
- **Deployment**: Single monitoring server (no HA required)
- **MVP Scope**: Phases 1-10 (Foundation through IP Reputation/Blacklist). Phases 11-13 (Spam/Security, Alerting, Reports) deferred post-MVP
- **UI Language**: English only — no i18n framework needed
- **Agent Auth**: API keys + IP whitelist — defense in depth for internal network
- **Testing**: Integration tests for API endpoints using Docker Compose (TimescaleDB + Redis). Focus on critical paths: auth, metrics ingestion, DNSBL checker
- **Test Infra**: Docker Compose for test environment — `docker-compose.test.yml` spins up isolated TimescaleDB + Redis for CI/local testing

### Action Items (Plan Revisions Needed)
- [ ] Phase 07: Add MongoDB change stream as secondary ingestion path alongside ZoneMTA hooks
- [ ] Phase 10: Update auto-pause logic to require 2 consecutive positive checks before pausing IP
- [ ] Phase 03: Add IP whitelist validation to agent auth middleware
- [ ] All phases: Add integration test tasks to todo lists (test with Docker TimescaleDB)
- [ ] Phase table: Mark Phases 1-10 as MVP, Phases 11-13 as post-MVP
