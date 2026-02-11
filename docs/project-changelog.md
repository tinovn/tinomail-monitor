# Project Changelog

## [1.0.0] - 2026-02-11

### Added
- Phase 13: Reports — daily/weekly/monthly/IP reputation report data aggregation, BullMQ cron scheduling, report history
- Phase 13: Data Export — CSV/JSON streaming for email events, server metrics, blacklist history, alert history
- Phase 13: Admin Panel — dashboard user CRUD (roles: admin/operator/viewer), password reset, admin auth hook
- Phase 13: System Settings — key-value settings (retention, collection intervals, display, alerts) with validation
- Phase 13: Audit Log — immutable action logging, searchable/filterable query endpoint
- Frontend: Reports page (6 tabs), export form, report history table
- Frontend: Admin page (3 tabs: Users, Settings, Audit Log), user CRUD dialog, settings form, audit table

## [0.5.0] - 2026-02-11

### Added
- Phase 12: Alerting System — alert rule engine (30s evaluation), 5 notification channels (Telegram/Slack/Email/Webhook/InApp), escalation L1→L2→L3
- Active alerts table with ack/snooze, alert history timeline, 30d frequency chart
- Rule CRUD with builder dialog, notification channel config UI, test send
- In-app toast notifications via Socket.IO, bell badge counter in header
- Brute-force detection + alert evaluation + escalation BullMQ workers

## [0.4.0] - 2026-02-11

### Added
- Phase 11: Spam & Security Dashboard — Rspamd stats/trend/actions, auth monitoring with brute-force detection, TLS encryption monitoring
- Phase 11: Log Viewer — advanced search with 15+ filters, cursor-based pagination, message trace timeline, saved searches
- Phase 09 complete: User Analytics (list, detail, abuse flags), Domain DNS check, domain destinations/senders endpoints, destination detail page
- Auth events hypertable + ingestion endpoint for tracking login attempts
- Brute-force detection BullMQ worker (every 30s, Socket.IO alerts)
- Sidebar navigation: added Spam & Security, Logs menu items

## [0.3.0] - 2026-02-11

### Added
- Phase 10: IP Reputation & Blacklist Monitor — DNSBL checker, auto-pause/restore, check history, heatmap
- Phase 08: ZoneMTA Cluster & IP Management — node overview, performance charts, IP table, warmup manager, CIDR range
- Phase 07: Email Flow & Event Pipeline — event ingestion (HTTP->BullMQ->TimescaleDB), throughput charts, delivery gauges, queue analysis
- Phase 06: Overview Dashboard & Server Monitoring — 8-metric status bar, node health grid, server detail pages, cluster heatmap

## [0.2.0] - 2026-02-11

### Added
- Phase 03: Backend API Core — Fastify app factory, JWT auth, agent API key auth, Zod validation, 8 route groups, 5 services
- Phase 04: Agent Development — system metrics collector, process health monitor, HTTP transport with gzip, offline buffer
- Phase 05: Frontend Foundation — API client with auto-refresh, Socket.IO client, Zustand stores (auth, time range, sidebar), TanStack Router layout, shadcn/ui dark theme

## [0.1.0] - 2026-02-11

### Added
- Monorepo scaffolding with npm workspaces (backend, frontend, agent, shared)
- Docker Compose for TimescaleDB + Redis + PgBouncer
- Shared TypeScript types and constants for metrics, email events, nodes, IPs, alerts, auth
- Backend scaffold: Fastify server with health endpoint, Zod config validation
- Frontend scaffold: Vite + React 18 + Tailwind v4 + TanStack Query
- Agent scaffold: placeholder with heartbeat loop
- ESLint flat config + Prettier + TypeScript strict mode
