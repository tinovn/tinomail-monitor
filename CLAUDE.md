# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WildDuck Mail Monitoring Dashboard — custom-built monitoring system for WildDuck Mail Infrastructure (NOT Grafana/Prometheus). Monitors 15+ servers: MongoDB cluster (3 nodes), WildDuck+Haraka (2 nodes), ZoneMTA outbound (10+ nodes). Tracks system health, email flow, IP reputation, blacklists, domain quality, and alerting.

## Tech Stack

- **Backend**: Node.js 20 LTS, Fastify, TypeScript
- **Database**: TimescaleDB (PostgreSQL 16 extension) for time-series metrics + relational config
- **Cache/Queue**: Redis 7, BullMQ for scheduled jobs
- **Frontend**: React 18+, TypeScript, shadcn/ui, TanStack Table, Apache ECharts, Zustand
- **Realtime**: Socket.IO (server + client)
- **Agent**: Lightweight Node.js process on each mail server (~20MB RAM), uses `systeminformation`

## Project Structure

```
tinomail-monitor/
├── packages/
│   ├── backend/          # Fastify API server + WebSocket + BullMQ workers
│   ├── frontend/         # React SPA (Vite)
│   └── agent/            # Lightweight metrics collection agent
├── plans/                # Implementation plans (markdown)
├── docs/                 # Project documentation
└── CLAUDE.md
```

## Build & Development Commands

```bash
# Install dependencies (all packages)
npm install

# Development
npm run dev                    # Start all packages in dev mode
npm run dev:backend            # Backend only (Fastify :3001)
npm run dev:frontend           # Frontend only (Vite :5173)
npm run dev:agent              # Agent in test mode

# Build
npm run build                  # Build all packages
npm run build:backend
npm run build:frontend
npm run build:agent

# Testing
npm run test                   # Run all tests
npm run test:backend           # Backend tests only
npm run test -- path/to/file   # Single test file

# Linting
npm run lint                   # Lint all packages
npm run lint:fix               # Auto-fix lint issues

# Database
npm run db:migrate             # Run TimescaleDB migrations
npm run db:seed                # Seed initial data (alert rules, DNSBL lists)
```

## Architecture

### Data Flow
```
Mail Servers (agents) → HTTP POST → Backend API → TimescaleDB (hypertables)
                                                → Redis (cache + pub/sub)
                                                → Socket.IO → Browser
```

### Key Patterns
- **Hypertables** for time-series: `metrics_system` (15s), `metrics_zonemta` (15s), `email_events`, `blacklist_checks` (5min)
- **Continuous aggregates** auto-rollup: raw → 5min → 1hour → daily
- **Retention policies**: raw 90d, email events 180d, aggregated 2yr
- **BullMQ scheduled jobs**: metrics collection (15s), DNSBL check (5min), alert evaluation (30s), reports (daily)
- **Agent auto-discovery**: agents self-register on startup via POST /api/v1/nodes

### 13 Dashboard Modules
Overview | Server Monitoring | Email Flow | ZoneMTA/IP Management | Domain Quality | User Analytics | Destination Analysis | Spam/Security | Log Viewer | IP Reputation/Blacklist | Alerting | Reports | Admin

## Key Files & References

- **PRD (full spec)**: `plans/wildduck-dashboard-requirements.md`
- **DB Schema**: PRD Section 6 — all hypertables + regular tables + continuous aggregates
- **API Endpoints**: PRD Section 20 — ~50 REST endpoints + WebSocket events
- **UI Navigation**: PRD Section 21.2 — sidebar menu structure

## Important Conventions

- File naming: kebab-case with descriptive names
- Keep files under 200 lines — split into focused modules
- Dark theme default (NOC monitoring screens)
- No email subject/body storage — privacy (hash only)
- Agent API key auth; Dashboard JWT auth with RBAC (admin/operator/viewer)
- All timestamps in UTC (TIMESTAMPTZ), display in user timezone
