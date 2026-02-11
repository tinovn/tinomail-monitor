# System Architecture

## Overview

WildDuck Mail Monitoring Dashboard — custom monitoring for 15+ mail servers.

## Data Flow

```
Mail Servers (agents) → HTTP POST → Backend API → TimescaleDB (hypertables)
                                                → Redis (cache + pub/sub)
                                                → Socket.IO → Browser
```

## Components

| Component | Tech | Purpose |
|-----------|------|---------|
| Backend | Fastify + Drizzle + BullMQ | API, WebSocket, scheduled jobs |
| Frontend | React + shadcn/ui + ECharts | SPA dashboard |
| Agent | Node.js + systeminformation | Metrics collection on each server |
| Database | TimescaleDB (PG16) | Time-series + relational storage |
| Cache | Redis 7 | Caching, pub/sub, BullMQ queue |

## Package Structure

- `@tinomail/shared` — TypeScript types + constants (no runtime deps)
- `@tinomail/backend` — Fastify API server + WebSocket + BullMQ workers
- `@tinomail/frontend` — React SPA (Vite)
- `@tinomail/agent` — Lightweight metrics collector
