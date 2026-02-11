# Phase 01 — Project Setup & Infrastructure

## Context Links
- [Parent Plan](./plan.md)
- [Research: Backend & Realtime](./research/researcher-01-backend-realtime-pipeline.md)
- [Research: Frontend & Database](./research/researcher-02-frontend-database-agent.md)
- [PRD Section 3: Tech Stack](../wildduck-dashboard-requirements.md)

## Overview
- **Priority:** P1 (Critical path — everything depends on this)
- **Status:** pending
- **Effort:** 3-4 days
- **Description:** Scaffold npm workspaces monorepo with backend (Fastify), frontend (Vite+React), agent (Node.js), shared types. Docker Compose for dev (TimescaleDB + Redis). Shared tooling: ESLint, Prettier, TypeScript.

## Key Insights
- npm workspaces (not Turborepo/Nx) — KISS for 3 packages
- Shared TypeScript types package eliminates API contract drift
- Docker Compose for local dev; production uses native installs (PM2)
- Fastify chosen over NestJS: ~15% fewer deps, lighter for ~50 endpoints

## Requirements

### Functional
- Monorepo with 4 packages: `backend`, `frontend`, `agent`, `shared`
- Each package independently buildable and runnable
- Docker Compose starts TimescaleDB 2.x (PG16) + Redis 7 in one command
- Shared TypeScript types for API request/response, metrics payloads, WebSocket events

### Non-Functional
- TypeScript strict mode across all packages
- ESLint flat config + Prettier shared
- Node.js 20 LTS as minimum
- Hot reload for both backend (tsx watch) and frontend (Vite HMR)

## Architecture

```
tinomail-monitor/
├── package.json              # Root: npm workspaces config
├── tsconfig.base.json        # Shared TS config (strict, paths)
├── eslint.config.mjs         # Flat config, shared rules
├── .prettierrc               # Shared formatting
├── docker-compose.yml        # TimescaleDB + Redis + PgBouncer
├── .env.example              # Template env vars
├── packages/
│   ├── shared/               # @tinomail/shared
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types/
│   │       │   ├── metrics.ts        # System, MongoDB, Redis, ZoneMTA, Rspamd metrics
│   │       │   ├── email-event.ts    # Email event schema
│   │       │   ├── node.ts           # Node registry types
│   │       │   ├── ip.ts             # Sending IP types
│   │       │   ├── alert.ts          # Alert rule/event types
│   │       │   ├── auth.ts           # JWT payload, user roles
│   │       │   └── api.ts            # API request/response wrappers
│   │       ├── constants/
│   │       │   ├── event-types.ts    # 'delivered','bounced','deferred','rejected','received'
│   │       │   ├── node-roles.ts     # 'zonemta-outbound','wildduck','mongodb'
│   │       │   ├── severity.ts       # 'critical','warning','info'
│   │       │   └── ip-status.ts      # 'active','warming','paused','blacklisted','retired'
│   │       └── index.ts
│   ├── backend/              # @tinomail/backend
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts              # Fastify server entry
│   │       ├── config.ts             # Env config with Zod validation
│   │       └── plugins/              # Fastify plugin stubs
│   ├── frontend/             # @tinomail/frontend
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       └── styles/
│   │           └── globals.css       # Tailwind directives + color scheme
│   └── agent/                # @tinomail/agent
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts              # Agent entry
│           └── config.ts             # Agent env config
└── docs/
    ├── development-roadmap.md
    ├── project-changelog.md
    ├── system-architecture.md
    └── code-standards.md
```

## Related Code Files

### Files to Create
- `package.json` — root workspace config
- `tsconfig.base.json` — shared TS strict config
- `eslint.config.mjs` — flat ESLint config
- `.prettierrc` — formatting rules
- `docker-compose.yml` — TimescaleDB + Redis + PgBouncer
- `.env.example` — env template
- `.gitignore` — Node.js + IDE + env
- `packages/shared/` — full shared types package
- `packages/backend/` — Fastify scaffold
- `packages/frontend/` — Vite + React scaffold
- `packages/agent/` — agent scaffold
- `docs/` — initial doc stubs

## Implementation Steps

### Step 1: Root Monorepo Setup
1. Initialize `package.json` with `workspaces: ["packages/*"]`
2. Set `"type": "module"` for ESM
3. Add root dev scripts: `dev:backend`, `dev:frontend`, `dev:agent`, `dev` (concurrently)
4. Install root devDeps: `typescript@5.x`, `eslint@9.x`, `prettier`, `concurrently`

### Step 2: Shared TypeScript Config
1. Create `tsconfig.base.json`: strict, ESNext target, moduleResolution bundler
2. Define path aliases: `@tinomail/shared` maps to `packages/shared/src`
3. Each package extends base with its own `outDir`, `rootDir`

### Step 3: Docker Compose
1. TimescaleDB service: `timescale/timescaledb:latest-pg16`, port 5432, volume for data persistence
2. Redis service: `redis:7-alpine`, port 6379
3. PgBouncer service: `edoburu/pgbouncer:latest`, port 6432, transaction pooling mode
4. Network: bridge network `tinomail-net`
5. Healthchecks for both DB services

```yaml
# docker-compose.yml key sections:
services:
  timescaledb:
    image: timescale/timescaledb:latest-pg16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: tinomail_monitor
      POSTGRES_USER: tinomail
      POSTGRES_PASSWORD: ${DB_PASSWORD:-devpassword}
    volumes:
      - timescaledb_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tinomail"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  pgbouncer:
    image: edoburu/pgbouncer:latest
    ports: ["6432:6432"]
    environment:
      DATABASE_URL: postgres://tinomail:${DB_PASSWORD:-devpassword}@timescaledb:5432/tinomail_monitor
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 200
      DEFAULT_POOL_SIZE: 25
    depends_on:
      timescaledb:
        condition: service_healthy
```

### Step 4: Shared Package
1. Create `packages/shared/package.json` with name `@tinomail/shared`
2. Define all TypeScript interfaces from PRD Section 6 (DB schema types)
3. Define constants for event types, node roles, severity levels, IP statuses
4. Export everything from `index.ts`
5. Use `tsup` for building (ESM + CJS dual export)

### Step 5: Backend Package Scaffold
1. Create `packages/backend/package.json`
2. Dependencies: `fastify@4`, `@fastify/cors`, `@fastify/jwt`, `@fastify/rate-limit`, `@fastify/websocket`, `drizzle-orm`, `drizzle-kit`, `postgres` (driver), `socket.io`, `bullmq`, `ioredis`, `zod`
3. Create entry `src/index.ts`: basic Fastify server with CORS, health endpoint
4. Create `src/config.ts`: Zod-validated env config (DB_URL, REDIS_URL, JWT_SECRET, PORT)
5. Create plugin stubs: `src/plugins/database.ts`, `src/plugins/redis.ts`, `src/plugins/socket-io.ts`

### Step 6: Frontend Package Scaffold
1. Create via: `npm create vite@latest frontend -- --template react-ts` in packages/
2. Install: `tailwindcss@4`, `@tailwindcss/vite`, shadcn/ui CLI init, `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/react-table`, `@tanstack/react-virtual`, `echarts`, `echarts-for-react`, `zustand`, `socket.io-client`, `date-fns`
3. Configure Tailwind with PRD color scheme (Section 21.4)
4. Create basic App.tsx with TanStack Router provider + React Query provider
5. Proxy API calls to backend via Vite config

### Step 7: Agent Package Scaffold
1. Create `packages/agent/package.json`
2. Dependencies: `systeminformation`, `node-fetch` (or native fetch in Node 20)
3. Create entry `src/index.ts`: placeholder agent class
4. Create `src/config.ts`: env config (SERVER_URL, API_KEY, NODE_ID, HEARTBEAT_INTERVAL)

### Step 8: Env & Git Setup
1. Create `.env.example` with all required vars
2. Create comprehensive `.gitignore`
3. Create initial `docs/` markdown stubs

## Todo List
- [ ] Initialize root package.json with npm workspaces
- [ ] Create tsconfig.base.json (strict mode)
- [ ] Create ESLint flat config + Prettier
- [ ] Create docker-compose.yml (TimescaleDB + Redis + PgBouncer)
- [ ] Create .env.example
- [ ] Scaffold packages/shared with all types + constants
- [ ] Scaffold packages/backend (Fastify + health endpoint)
- [ ] Scaffold packages/frontend (Vite + React + Tailwind + shadcn)
- [ ] Scaffold packages/agent (entry + config)
- [ ] Create .gitignore
- [ ] Create docs/ stubs
- [ ] Verify `docker compose up` starts all services
- [ ] Verify `npm run dev` starts backend + frontend + agent concurrently
- [ ] Verify TypeScript compiles across all packages

## Success Criteria
- `docker compose up -d` starts TimescaleDB + Redis + PgBouncer, all healthy
- `npm run dev` starts all 3 dev servers concurrently
- Backend responds on `GET /health` with `{ status: "ok" }`
- Frontend renders blank page at `http://localhost:5173`
- TypeScript compiles without errors in all packages
- Shared types importable from backend and frontend

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| npm workspaces hoisting issues | Med | Pin versions, use `overrides` if needed |
| TimescaleDB extension not loading | High | Use official timescale Docker image, verify `CREATE EXTENSION timescaledb` |
| Tailwind v4 breaking changes | Low | Pin to stable v4.x, check shadcn compatibility |

## Security Considerations
- `.env` files excluded from git
- Docker volumes for data persistence (not bind mounts)
- PgBouncer restricts direct DB access
- No default passwords in committed code

## Next Steps
- Phase 02: Database schema creation using Drizzle migrations
- Phase 03: Backend API routes using this scaffold
