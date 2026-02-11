# Phase 07 — Email Flow Dashboard & Event Ingestion Pipeline (PRD Module 3)

## Context Links
- [Parent Plan](./plan.md)
- [PRD Section 9: Email Flow](../wildduck-dashboard-requirements.md)
- [PRD Section 5.8: Email Event Stream](../wildduck-dashboard-requirements.md)
- [Research: Event Ingestion Pipeline](./research/researcher-01-backend-realtime-pipeline.md)
- Depends on: [Phase 06](./phase-06-overview-dashboard-and-server-monitoring.md)

## Overview
- **Priority:** P1 (Core email analytics — reason the dashboard exists)
- **Status:** pending
- **Effort:** 5-7 days
- **Description:** Build the email event ingestion pipeline (ZoneMTA HTTP POST hooks → BullMQ → workers → TimescaleDB) and the Email Flow dashboard showing inbound/outbound throughput, delivery performance, queue analysis, and message size distribution. This is the data backbone for Modules 4-13.

## Key Insights
- ZoneMTA HTTP POST hooks chosen over GELF/MongoDB streams: guaranteed delivery, <10ms latency
- BullMQ queue absorbs 10K event/sec bursts — workers batch-insert into TimescaleDB
- Continuous aggregates (email_stats_5m, email_stats_1h) handle dashboard queries efficiently
- Socket.IO broadcasts email throughput counters every 5s for realtime flow animation
- PRD Section 9.1: animated counters for inbound/outbound (count-up animation)

## Requirements

### Functional
- **Ingestion:** ZoneMTA plugin sends email events via HTTP POST → dashboard ingests into BullMQ → workers write to email_events hypertable
- **Flow counters:** Realtime inbound (received, delivered, rejected, greylisted) and outbound (sent, delivered, bounced, deferred) per hour
- **Throughput charts:** Outbound stacked area (24h), inbound stacked area (24h), emails/sec sparkline (5min), outbound by MTA node (multi-line)
- **Delivery performance:** Avg/P95/P99 delivery time gauges, time distribution histogram, time by destination table, trend line
- **Queue analysis:** Total queue big number + sparkline, queue per node bar, queue age distribution, oldest message, deferred reasons pie
- **Message size distribution:** Histogram (<10KB to >25MB), average size trend

### Non-Functional
- Ingestion: handle 10K events/sec sustained
- Dashboard queries: < 1s for 24h aggregated view
- Realtime counters: < 500ms latency from event to UI update

## Architecture

### Event Ingestion Pipeline
```
ZoneMTA (on each MTA node)
  → ZoneMTA plugin hook: on send/bounce/defer/reject
  → HTTP POST /api/v1/events/ingest { event payload per PRD 5.8 }

Dashboard API
  → Validate with Zod
  → Enqueue to BullMQ "email-events" queue (priority-based)
  → Respond 202 Accepted immediately

BullMQ Worker (email-events)
  → Batch: collect up to 100 events or 1s window
  → Bulk INSERT into email_events hypertable
  → Broadcast via Socket.IO: increment counters
  → On failure: retry 3x with backoff → dead letter queue
```

### Backend New Files
```
packages/backend/src/
├── routes/
│   ├── events/
│   │   ├── ingest.ts                # POST /events/ingest (agent/webhook auth)
│   │   └── index.ts
│   ├── email/
│   │   ├── events.ts               # GET /email/events (search + paginate)
│   │   ├── throughput.ts            # GET /email/throughput?range=1h
│   │   ├── stats.ts                # GET /email/stats?range=24h&by=domain
│   │   ├── queue.ts                # GET /email/queue
│   │   ├── bounce-analysis.ts      # GET /email/bounce-analysis
│   │   └── index.ts
├── workers/
│   ├── email-event-worker.ts       # BullMQ worker: batch insert + broadcast
│   └── index.ts                    # Worker registry
├── services/
│   ├── email-event-service.ts      # Batch insert, query logic
│   ├── throughput-service.ts       # Throughput aggregation queries
│   └── queue-service.ts            # ZoneMTA queue polling
```

### Frontend New Files
```
src/routes/_authenticated/email-flow/
├── index.tsx                        # Main email flow page (outbound)
├── inbound.tsx                      # Inbound tab
├── queue.tsx                        # Queue analysis tab
└── performance.tsx                  # Delivery performance tab

src/components/email-flow/
├── flow-counters.tsx                # Animated inbound/outbound counters
├── outbound-throughput-chart.tsx    # Stacked area (delivered, bounced, deferred)
├── inbound-throughput-chart.tsx     # Stacked area (delivered, spam, rejected)
├── emails-per-second-sparkline.tsx  # Realtime 5min sparkline
├── outbound-by-node-chart.tsx       # Multi-line per MTA node
├── delivery-time-gauges.tsx         # Avg, P95, P99 gauge set
├── delivery-time-histogram.tsx      # Distribution histogram
├── delivery-time-by-dest.tsx        # Table: domain, avg time, p95
├── delivery-time-trend-chart.tsx    # Line chart 24h
├── queue-overview.tsx               # Big number + sparkline
├── queue-per-node-chart.tsx         # Horizontal bar
├── queue-age-distribution.tsx       # Histogram by age bracket
├── deferred-reasons-chart.tsx       # Pie chart
└── message-size-histogram.tsx       # Size distribution
```

## Implementation Steps

### Step 1: ZoneMTA Plugin Hook
1. Create a simple ZoneMTA plugin that fires HTTP POST on delivery events
2. Events: `delivered`, `bounced`, `deferred`, `rejected`, `received`
3. Payload matches PRD Section 5.8 event schema exactly (24 fields)
4. Plugin config: dashboard URL, API key, batch size (send up to 10 events per POST)
5. Async POST — does not block ZoneMTA delivery
6. Retry on failure: 3 attempts with 1s backoff; drop after max retries (log warning)

### Step 2: Backend — Ingestion Endpoint
1. `POST /api/v1/events/ingest`: accepts single event or array of events
2. Auth: API key (same as agent auth, separate key for webhooks)
3. Validate each event with Zod schema
4. Enqueue to BullMQ `email-events` queue with priority based on event_type (delivered=5, bounced=3, rejected=1)
5. Return 202 Accepted with `{ queued: count }`
6. Rate limit: 10K req/s for this endpoint

### Step 3: BullMQ Email Event Worker
1. Consumer: pulls from `email-events` queue
2. Batch strategy: accumulate up to 100 events or 1s timeout, whichever comes first
3. Bulk INSERT into `email_events` hypertable via Drizzle
4. After insert: broadcast throughput delta to Socket.IO room `email-flow`
5. Error handling: individual event failures logged, batch retried up to 3x
6. Dead letter queue for persistent failures
7. Worker concurrency: 3 (parallel batches)

### Step 4: Backend — Email Query Endpoints
1. `GET /email/throughput?range=1h|6h|24h|7d` — uses continuous aggregates, returns time-series for stacked area chart
2. `GET /email/stats?range=24h&by=domain|node|ip` — aggregated stats groupable by dimension
3. `GET /email/queue` — polls ZoneMTA HTTP API (:12080) for live queue data across all MTA nodes
4. `GET /email/bounce-analysis?range=24h` — bounce type/category breakdown
5. `GET /email/events?from=&to=&type=&...` — paginated search (used by Log Viewer later, basic impl now)

### Step 5: Backend — Throughput Service
1. Query `email_stats_5m` for ranges < 6h, `email_stats_1h` for 6h-7d, `email_stats_daily` for > 7d
2. Return: `[{ time, delivered, bounced, deferred, rejected }]`
3. Per-node throughput: add `mta_node` grouping
4. Delivery time percentiles: use pre-computed p95 from continuous aggregates

### Step 6: Backend — Queue Service
1. Poll all ZoneMTA nodes via HTTP API (`GET :12080/api/queued`)
2. Aggregate: total queue, per-node queue, queue age distribution
3. Cache in Redis (10s TTL) — queue data is semi-realtime
4. Deferred reasons: parse from ZoneMTA bounce categories

### Step 7: Frontend — Flow Counters
1. `flow-counters.tsx`: two columns (Inbound / Outbound), 4 rows each
2. Big numbers with count-up animation (use `react-countup` or custom)
3. Socket.IO: listen to `email:throughput` events → update counters
4. Show rate as /h (emails per hour)

### Step 8: Frontend — Throughput Charts
1. `outbound-throughput-chart.tsx`: ECharts stacked area, 4 series (delivered green, deferred yellow, bounced red, rejected dark red)
2. `inbound-throughput-chart.tsx`: similar for inbound
3. `emails-per-second-sparkline.tsx`: tiny chart, last 5 min realtime
4. `outbound-by-node-chart.tsx`: multi-line, one line per MTA node, detect anomalies visually
5. All charts use time range from global store

### Step 9: Frontend — Delivery Performance
1. `delivery-time-gauges.tsx`: 3 ECharts gauges (Avg, P95, P99)
   - Green < 3s, Yellow < 10s, Red > 10s
2. `delivery-time-histogram.tsx`: bars for <1s, 1-3s, 3-10s, 10-30s, 30s-1m, 1m-5m, >5m
3. `delivery-time-by-dest.tsx`: TanStack Table — destination domain, avg time, p95
4. `delivery-time-trend-chart.tsx`: line chart showing delivery time over 24h

### Step 10: Frontend — Queue Analysis
1. `queue-overview.tsx`: big number + trend sparkline
2. `queue-per-node-chart.tsx`: horizontal bar (one bar per MTA node)
3. `queue-age-distribution.tsx`: histogram by age brackets per PRD 9.4
4. `deferred-reasons-chart.tsx`: pie (rate-limited, MX unavailable, timeout, policy)
5. Auto-refresh: queue data refreshes every 10s

### Step 11: Frontend — Message Size
1. `message-size-histogram.tsx`: bars for size brackets (<10KB, 10-100KB, 100KB-1MB, etc.)
2. Average message size trend line overlay

## Todo List
- [ ] Create ZoneMTA plugin hook (HTTP POST on delivery events)
- [ ] Backend: POST /events/ingest endpoint
- [ ] Backend: BullMQ email-event-worker (batch insert)
- [ ] Backend: GET /email/throughput endpoint
- [ ] Backend: GET /email/stats endpoint
- [ ] Backend: GET /email/queue endpoint (polls ZoneMTA)
- [ ] Backend: GET /email/bounce-analysis endpoint
- [ ] Backend: throughput-service with aggregate resolution
- [ ] Backend: queue-service (poll + cache)
- [ ] Frontend: flow-counters with animation
- [ ] Frontend: outbound throughput stacked area chart
- [ ] Frontend: inbound throughput stacked area chart
- [ ] Frontend: emails/sec sparkline
- [ ] Frontend: outbound by MTA node multi-line chart
- [ ] Frontend: delivery time gauges (avg, P95, P99)
- [ ] Frontend: delivery time histogram
- [ ] Frontend: delivery time by destination table
- [ ] Frontend: queue overview + per-node + age distribution
- [ ] Frontend: deferred reasons pie
- [ ] Frontend: message size histogram
- [ ] Integration: test ZoneMTA hook → API → DB → charts pipeline
- [ ] Load test: verify 10K events/sec ingestion

## Success Criteria
- ZoneMTA plugin sends events to dashboard on every delivery
- BullMQ processes events in batches, inserts into TimescaleDB
- Email flow page shows live throughput with animated counters
- Throughput charts render stacked area with real data
- Delivery time gauges show correct Avg/P95/P99
- Queue analysis displays per-node queue sizes from ZoneMTA
- All charts respond to global time range + auto-refresh
- Ingestion sustains 10K events/sec without backpressure

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| ZoneMTA plugin blocks mail delivery | Critical | Fully async POST, fire-and-forget with queue |
| BullMQ overwhelmed at 10K/sec | High | Batch insert (100/batch), 3 concurrent workers, Redis memory monitoring |
| Continuous aggregate refresh lag | Med | Refresh policy every 5min for 5m agg; accept slight delay for dashboard |
| ZoneMTA HTTP API unavailable | Med | Cache last known queue state, show "stale" indicator |

## Security Considerations
- Ingest endpoint: separate API key from user JWT (webhook auth)
- Rate limit ingest endpoint per source IP
- No email body/subject stored — only metadata per PRD
- Bounce messages truncated to 500 chars

## Next Steps
- Phase 08: ZoneMTA cluster view uses throughput data per node
- Phase 09: Domain quality uses email_events per from_domain
- Phase 11: Log viewer exposes email events search
