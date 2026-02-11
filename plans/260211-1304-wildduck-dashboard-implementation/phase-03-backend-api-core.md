# Phase 03 — Backend API Core

## Context Links
- [Parent Plan](./plan.md)
- [PRD Section 20: API Design](../wildduck-dashboard-requirements.md)
- [Research: Fastify + BullMQ](./research/researcher-01-backend-realtime-pipeline.md)
- Depends on: [Phase 01](./phase-01-project-setup-and-infrastructure.md), [Phase 02](./phase-02-database-schema-and-migrations.md)

## Overview
- **Priority:** P1 (Foundation for all features)
- **Status:** pending
- **Effort:** 4-5 days
- **Description:** Build Fastify API server with plugin architecture, JWT auth + RBAC, node/metrics/IP CRUD endpoints, Socket.IO realtime, BullMQ job infrastructure, Zod request validation, error handling.

## Key Insights
- Fastify plugin encapsulation: each feature is a plugin (auth, nodes, metrics, ips, etc.)
- JWT with refresh tokens: access token 15min, refresh 7d
- RBAC: admin (full), operator (manage nodes/IPs/alerts), viewer (read-only)
- Socket.IO rooms: subscribe by channel (metrics, alerts, email-flow)
- BullMQ: 4 queue types (email-events, metrics-collection, dnsbl-checks, alert-evaluation)
- Zod schemas for all request validation (shared with frontend via @tinomail/shared)

## Requirements

### Functional
- Auth: login, refresh token, JWT middleware
- RBAC: role check decorator/hook for admin/operator/viewer
- Node CRUD: register (from agent), list, get detail, update, decommission, maintenance mode
- Metrics ingestion: POST from agent (system metrics batch insert)
- IP CRUD: list, get detail, update status (pause/resume), bulk actions
- Socket.IO: namespace `/ws`, rooms per channel, auth via JWT
- BullMQ: queue setup, repeatable job stubs
- Error handling: structured JSON errors, request ID tracking
- Rate limiting: 100 req/s per user, 1000 req/s for agent endpoints

### Non-Functional
- API response < 200ms for single-entity queries
- Metrics ingestion handles 15-node concurrent POSTs
- Graceful shutdown (drain connections, close DB pool)

## Architecture

### Fastify Plugin Structure
```
packages/backend/src/
├── index.ts                    # Server entry: register plugins, start
├── config.ts                   # Zod-validated env config
├── app.ts                      # Fastify app factory (for testing)
├── db/                         # (from Phase 02)
├── plugins/
│   ├── database.ts             # Drizzle client plugin (decorates fastify.db)
│   ├── redis.ts                # ioredis client plugin (decorates fastify.redis)
│   ├── socket-io.ts            # Socket.IO init, room management, auth
│   ├── bull-mq.ts              # BullMQ queues + workers init
│   ├── auth.ts                 # JWT sign/verify, refresh token rotation
│   └── rate-limit.ts           # @fastify/rate-limit config
├── hooks/
│   ├── auth-hook.ts            # onRequest: verify JWT, attach user to request
│   ├── rbac-hook.ts            # preHandler: check role permission
│   └── error-handler.ts        # setErrorHandler: structured error responses
├── routes/
│   ├── auth/
│   │   ├── login.ts            # POST /auth/login
│   │   ├── refresh.ts          # POST /auth/refresh
│   │   └── index.ts            # Auth route plugin
│   ├── nodes/
│   │   ├── list-nodes.ts       # GET /nodes
│   │   ├── get-node.ts         # GET /nodes/:id
│   │   ├── register-node.ts    # POST /nodes (agent auth)
│   │   ├── update-node.ts      # PUT /nodes/:id
│   │   ├── delete-node.ts      # DELETE /nodes/:id
│   │   ├── maintenance.ts      # PUT /nodes/:id/maintenance
│   │   ├── node-metrics.ts     # GET /nodes/:id/metrics?range=1h
│   │   └── index.ts
│   ├── metrics/
│   │   ├── ingest-system.ts    # POST /metrics/system (from agent)
│   │   ├── query-system.ts     # GET /metrics/system?node=X&range=1h
│   │   ├── query-mongodb.ts    # GET /metrics/mongodb
│   │   ├── query-redis.ts      # GET /metrics/redis
│   │   ├── query-zonemta.ts    # GET /metrics/zonemta
│   │   ├── query-rspamd.ts     # GET /metrics/rspamd
│   │   └── index.ts
│   ├── ips/
│   │   ├── list-ips.ts         # GET /ips
│   │   ├── get-ip.ts           # GET /ips/:ip
│   │   ├── update-ip-status.ts # PUT /ips/:ip/status
│   │   ├── check-blacklist.ts  # POST /ips/check
│   │   ├── blacklisted.ts      # GET /ips/blacklisted
│   │   ├── ip-history.ts       # GET /ips/:ip/history
│   │   ├── bulk-action.ts      # POST /ips/bulk-action
│   │   └── index.ts
│   ├── overview/
│   │   ├── summary.ts          # GET /overview
│   │   ├── health.ts           # GET /health
│   │   └── index.ts
│   └── index.ts                # Register all route plugins
├── services/
│   ├── auth-service.ts         # Login logic, password verify, token generation
│   ├── node-service.ts         # Node CRUD business logic
│   ├── metrics-service.ts      # Metrics query + aggregation logic
│   ├── ip-service.ts           # IP management logic
│   └── socket-service.ts       # Socket.IO event emitters
├── schemas/
│   ├── auth-schemas.ts         # Zod: LoginRequest, TokenResponse
│   ├── node-schemas.ts         # Zod: CreateNode, UpdateNode, NodeResponse
│   ├── metrics-schemas.ts      # Zod: MetricsQuery, SystemMetricsPayload
│   ├── ip-schemas.ts           # Zod: IpQuery, UpdateIpStatus, BulkAction
│   └── common-schemas.ts       # Zod: PaginationQuery, TimeRangeQuery, ApiError
└── utils/
    ├── time-range.ts           # Parse "1h","6h","24h","7d","30d" to SQL interval
    ├── pagination.ts           # Offset/limit helpers
    └── password.ts             # bcrypt hash/compare
```

### Auth Flow
```
Login: POST /auth/login { username, password }
  → Verify bcrypt hash
  → Generate access JWT (15min) + refresh JWT (7d)
  → Return { accessToken, refreshToken, user }

Protected request:
  → Authorization: Bearer <accessToken>
  → onRequest hook: verify JWT, attach user to request
  → preHandler hook: check role for route

Refresh: POST /auth/refresh { refreshToken }
  → Verify refresh token
  → Rotate: new access + new refresh token
  → Return { accessToken, refreshToken }
```

### Agent Auth
- Agents authenticate via API key (not JWT)
- API key stored in `nodes.metadata.api_key` (hashed)
- Agent endpoints: `/nodes` POST (register), `/metrics/system` POST (ingest)
- Rate limit: 1000 req/s for agent endpoints (15 agents x 1 req/15s = trivial)

## Related Code Files

### Files to Create
- `packages/backend/src/app.ts`
- `packages/backend/src/plugins/*.ts` (5 plugins)
- `packages/backend/src/hooks/*.ts` (3 hooks)
- `packages/backend/src/routes/**/*.ts` (~25 route files)
- `packages/backend/src/services/*.ts` (5 services)
- `packages/backend/src/schemas/*.ts` (5 schema files)
- `packages/backend/src/utils/*.ts` (3 utils)

## Implementation Steps

### Step 1: App Factory + Config
1. Create `app.ts`: Fastify factory function, register plugins in order
2. Update `config.ts`: add all env vars (DB_URL, REDIS_URL, JWT_SECRET, JWT_EXPIRES_IN, PORT, AGENT_API_KEYS)
3. Create `index.ts`: call factory, start server, graceful shutdown handlers

### Step 2: Core Plugins
1. `database.ts` — init Drizzle client, decorate `fastify.db`
2. `redis.ts` — init ioredis, decorate `fastify.redis`
3. `rate-limit.ts` — configure @fastify/rate-limit (100/s default, allowlist for agents)
4. `auth.ts` — configure @fastify/jwt with secret, expose sign/verify

### Step 3: Error Handling + Hooks
1. `error-handler.ts` — catch all errors, return `{ error: string, statusCode: number, requestId: string }`
2. `auth-hook.ts` — verify JWT from Bearer header, skip for public routes (/auth/login, /health, agent endpoints)
3. `rbac-hook.ts` — factory function: `requireRole('admin')` returns preHandler hook

### Step 4: Auth Routes
1. `POST /auth/login` — validate Zod schema, verify password, sign JWT pair
2. `POST /auth/refresh` — validate refresh token, rotate tokens

### Step 5: Node Routes
1. `GET /nodes` — list all nodes, optional filter by role/status
2. `GET /nodes/:id` — node detail with latest metrics
3. `POST /nodes` — agent registration (API key auth), upsert node
4. `PUT /nodes/:id` — update node metadata (admin/operator)
5. `DELETE /nodes/:id` — soft delete (set status=retired)
6. `PUT /nodes/:id/maintenance` — toggle maintenance mode
7. `GET /nodes/:id/metrics` — query metrics_system for node in time range

### Step 6: Metrics Ingestion + Query
1. `POST /metrics/system` — batch insert from agent (array of metric points)
   - Validate with Zod, bulk insert via Drizzle
   - Emit Socket.IO event `metrics:system` to subscribers
2. `GET /metrics/system` — query with filters: node, range, resolution
   - Use continuous aggregates for ranges > 1h
   - Return time-series array for chart rendering
3. Implement same pattern for mongodb, redis, zonemta, rspamd metrics

### Step 7: IP Routes
1. `GET /ips` — paginated list with filters (status, node_id, subnet)
2. `GET /ips/:ip` — detail with latest blacklist status + sending stats
3. `PUT /ips/:ip/status` — change status (active/paused/warming)
4. `POST /ips/check` — trigger manual DNSBL check (enqueue BullMQ job)
5. `GET /ips/blacklisted` — filter for blacklisted IPs only
6. `GET /ips/:ip/history` — blacklist check history from blacklist_checks table
7. `POST /ips/bulk-action` — batch status change

### Step 8: Socket.IO Setup
1. Init Socket.IO with Fastify server
2. Auth middleware: verify JWT on connection
3. Rooms: `metrics`, `alerts`, `email-flow`, `ip-reputation`
4. On client `subscribe` event: join requested rooms
5. Broadcast helpers in `socket-service.ts`

### Step 9: BullMQ Infrastructure
1. Create queues: `email-events`, `metrics-collection`, `dnsbl-checks`, `alert-evaluation`, `report-generation`
2. Create repeatable job stubs (actual workers in later phases)
3. Add Bull Board at `/admin/queues` (admin auth required)

### Step 10: Overview Endpoint
1. `GET /overview` — aggregate: cluster health, active nodes count, emails sent 1h, delivered rate, bounce rate, queue size, blacklisted IPs, active alerts
2. Uses continuous aggregates + Redis cache (30s TTL)

## Todo List
- [ ] Create app.ts factory function
- [ ] Implement database plugin (Drizzle)
- [ ] Implement redis plugin (ioredis)
- [ ] Implement rate-limit plugin
- [ ] Implement auth plugin (JWT)
- [ ] Implement error handler hook
- [ ] Implement auth hook (JWT verify)
- [ ] Implement RBAC hook (role check)
- [ ] Implement auth routes (login, refresh)
- [ ] Implement node routes (CRUD + metrics)
- [ ] Implement metrics ingestion (POST from agent)
- [ ] Implement metrics query endpoints
- [ ] Implement IP routes (CRUD + blacklist)
- [ ] Implement overview endpoint
- [ ] Set up Socket.IO with auth + rooms
- [ ] Set up BullMQ queues (stubs)
- [ ] Add Bull Board admin UI
- [ ] Test all endpoints with curl/httpie
- [ ] Verify auth flow end-to-end

## Success Criteria
- Login returns JWT pair, protected routes reject without token
- Agent can register node and push metrics via API key
- `GET /overview` returns aggregated dashboard data
- `GET /nodes` returns node list with latest status
- `GET /metrics/system?node=mta-01&range=1h` returns time-series data
- Socket.IO connects with JWT, receives events in subscribed rooms
- BullMQ queues visible in Bull Board

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| JWT refresh token rotation race condition | Med | Use Redis to track active refresh tokens |
| Metrics ingestion bottleneck | High | Batch insert, connection pooling via PgBouncer |
| Socket.IO memory leak with many rooms | Low | Periodic room cleanup, limit max rooms per client |

## Security Considerations
- Passwords hashed with bcrypt (12 rounds)
- JWT secret from env, min 256-bit
- Agent API keys hashed in DB, compared with constant-time
- Rate limiting prevents brute-force on /auth/login
- CORS restricted to frontend origin
- Request ID in all responses for audit trail

## Next Steps
- Phase 04: Agent uses these endpoints to register + push metrics
- Phase 05: Frontend consumes these APIs
- Phase 06+: Add more route groups as features are built
