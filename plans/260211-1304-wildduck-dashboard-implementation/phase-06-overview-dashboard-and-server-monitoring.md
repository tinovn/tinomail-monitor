# Phase 06 — Overview Dashboard & Server Monitoring (PRD Modules 1+2)

## Context Links
- [Parent Plan](./plan.md)
- [PRD Section 7: Overview Dashboard](../wildduck-dashboard-requirements.md)
- [PRD Section 8: Server & Hardware Monitoring](../wildduck-dashboard-requirements.md)
- Depends on: [Phase 03](./phase-03-backend-api-core.md), [Phase 04](./phase-04-agent-development.md), [Phase 05](./phase-05-frontend-foundation.md)

## Overview
- **Priority:** P1 (First visible feature — proves entire stack works)
- **Status:** pending
- **Effort:** 5-7 days
- **Description:** Build the Overview Dashboard (PRD Module 1) showing cluster health at a glance, and Server Monitoring (PRD Module 2) with server list, detail pages, comparison view, and heatmap. First end-to-end feature: agent → API → DB → frontend → charts.

## Key Insights
- Overview page is the home screen — must load fast (< 2s), show critical status immediately
- Server list uses TanStack Table with sorting/filtering (15-100+ nodes)
- Server detail: 4 chart sections (CPU, RAM, Disk, Network) + process manager
- Comparison view: overlay 2-5 nodes on same chart for debugging
- Heatmap: ECharts native heatmap — rows=nodes, cols=time, color=metric intensity
- Socket.IO `metrics:system` events update overview counters + server detail charts in realtime
- Backend: `GET /overview` aggregates from multiple tables + Redis cache (30s TTL)

## Requirements

### Functional (Overview — PRD 7)
- Status bar: cluster health, active nodes, emails sent 1h, delivered rate, bounce rate, queue size, blacklisted IPs, active alerts
- Charts: email throughput 24h (stacked area), bounce rate trend 24h (line), MTA node health heatmap (grid), top sending domains 24h (horizontal bar)
- Quick panels: MongoDB cluster status, WildDuck nodes status, recent alerts (5), quick action links
- Time range selector applies to all charts
- Auto-refresh updates all widgets

### Functional (Server Monitoring — PRD 8)
- Server list table: status, node ID, role, IP, CPU, RAM, disk, network, load avg, connections, uptime. Sort + filter + click to detail
- Server detail: CPU chart (realtime + historical), RAM chart (used/cached/available), Disk (partitions + IOPS + throughput + growth prediction), Network (bandwidth + packets + errors), Process manager table
- Comparison view: select 2-5 nodes, overlay charts
- Heatmap view: all nodes grid, color by metric, time axis

### Non-Functional
- Overview: all widgets load in < 2s
- Server list: handle 100 nodes at 60fps
- Server detail: charts update in realtime (< 1s latency from agent push)

## Architecture

### Backend Endpoints (new/enhanced)
```
GET  /overview                    → aggregated dashboard summary
GET  /nodes                       → already exists (Phase 03)
GET  /nodes/:id                   → already exists, enhance with latest metrics
GET  /nodes/:id/metrics           → time-series for charts
GET  /nodes/comparison            → multi-node overlay data
GET  /nodes/heatmap               → grid data (all nodes × time buckets)
```

### Frontend Components
```
src/routes/_authenticated/
├── index.tsx                          # Overview page

src/routes/_authenticated/servers/
├── index.tsx                          # Server list page
├── $nodeId.tsx                        # Server detail page
├── comparison.tsx                     # Multi-node comparison
└── heatmap.tsx                        # Cluster heatmap

src/components/overview/
├── status-bar.tsx                     # 8 status widgets row
├── email-throughput-chart.tsx         # Stacked area chart (24h)
├── bounce-rate-trend-chart.tsx        # Line chart with threshold
├── mta-health-heatmap.tsx             # Node grid (xanh/vàng/đỏ)
├── top-domains-chart.tsx              # Horizontal bar chart
├── mongodb-panel.tsx                  # MongoDB cluster quick view
├── wildduck-panel.tsx                 # WildDuck nodes quick view
├── recent-alerts-panel.tsx            # Last 5 alerts
└── quick-actions-panel.tsx            # Action buttons

src/components/servers/
├── server-list-table.tsx              # TanStack Table with role filter
├── server-detail-header.tsx           # Node info + status
├── cpu-chart.tsx                      # CPU line chart (per-core toggle)
├── ram-chart.tsx                      # RAM pie + trend line
├── disk-charts.tsx                    # Usage bars + IOPS + throughput
├── network-chart.tsx                  # Bandwidth + packets + errors
├── process-manager-table.tsx          # Service process list
├── comparison-overlay-chart.tsx       # Multi-node overlay
└── cluster-heatmap.tsx                # Full cluster heatmap (ECharts)
```

### Data Flow (Realtime)
```
Agent → POST /metrics/system → TimescaleDB + Socket.IO broadcast
  ↓
Socket.IO room "metrics"
  ↓
Frontend use-socket hook → update React Query cache
  ↓
Overview widgets re-render → Server detail charts update
```

## Related Code Files

### Files to Create
- Backend: `routes/overview/summary.ts` (enhance), `routes/nodes/comparison.ts`, `routes/nodes/heatmap.ts`
- Backend: `services/overview-service.ts`, `services/heatmap-service.ts`
- Frontend: all overview components (9 files)
- Frontend: all server components (9 files)
- Frontend: route pages (4 files)

### Files to Modify
- Backend: `routes/nodes/get-node.ts` (add latest metrics)
- Backend: `routes/nodes/node-metrics.ts` (add resolution parameter)
- Frontend: `routes/_authenticated/index.tsx`, `routes/_authenticated/servers/*.tsx`

## Implementation Steps

### Step 1: Backend — Overview Endpoint
1. Create `services/overview-service.ts`:
   - Query nodes table: count active/total, compute cluster health
   - Query email_stats_1h (continuous aggregate): emails sent 1h, delivered rate, bounce rate
   - Query metrics_zonemta: total queue size across all nodes
   - Query sending_ips: count blacklisted
   - Query alert_events: count active alerts
2. Cache result in Redis (key: `overview`, TTL: 30s)
3. Return structured response matching status bar widgets

### Step 2: Backend — Enhanced Node Metrics
1. Add `resolution` query param to `GET /nodes/:id/metrics`: auto/15s/5m/1h/1d
   - Auto resolution: range < 6h → 15s, < 24h → 5m, < 7d → 1h, else → 1d
   - 15s → query raw metrics_system
   - 5m/1h/1d → query continuous aggregates
2. Add `GET /nodes/comparison?nodes=mta-01,mta-02&metric=cpu&range=1h`
3. Add `GET /nodes/heatmap?metric=cpu&range=24h&bucket=1h`
   - Returns: `[{ node_id, time_bucket, value }]` for all nodes

### Step 3: Frontend — Overview Status Bar
1. Build `status-bar.tsx`: 8 Card components in flex row
2. Each card: icon, label, value (big number), sub-value or gauge
3. Color coding: bounce rate > 5% = red gauge, queue > 10K = yellow, blacklisted > 0 = red
4. Use React Query: `useQuery({ queryKey: ['overview'], queryFn: fetchOverview, refetchInterval: timeRange.autoRefresh })`
5. Socket.IO: listen to `overview:update` for realtime counter updates

### Step 4: Frontend — Overview Charts
1. `email-throughput-chart.tsx`: ECharts stacked area (delivered=green, deferred=yellow, bounced=red)
   - X-axis: time (24h), Y-axis: emails/hour
   - Tooltip: show counts per category
2. `bounce-rate-trend-chart.tsx`: ECharts line with markLine at 5% threshold
3. `mta-health-heatmap.tsx`: Grid of small cards per MTA node
   - Status color based on: CPU (>85%=red), queue (>10K=red), blacklist (>0=red)
   - Click → navigate to server detail
4. `top-domains-chart.tsx`: ECharts horizontal bar, top 10 domains by sent count

### Step 5: Frontend — Overview Quick Panels
1. `mongodb-panel.tsx`: 3 rows (mongo-01 to 03), show role, repl lag, disk%, ops/sec
2. `wildduck-panel.tsx`: 2 rows (wd-01, wd-02), show IMAP conns, API req/s, CPU
3. `recent-alerts-panel.tsx`: last 5 alerts with severity badge + message
4. `quick-actions-panel.tsx`: buttons/links to common actions

### Step 6: Frontend — Server List Page
1. `server-list-table.tsx`: TanStack Table
   - Columns: status dot, node ID, role, IP, CPU (progress bar), RAM (progress bar), disk (progress bar), network (up/down Mbps), load avg, TCP connections, uptime
   - Row click → navigate to `/servers/:nodeId`
   - Filter by role dropdown
   - Sort by any column
2. React Query: `useQuery({ queryKey: ['nodes'], refetchInterval })`
3. Socket.IO: update node metrics in cache on `metrics:system` event

### Step 7: Frontend — Server Detail Page
1. Route `$nodeId.tsx`: fetch node info + metrics
2. `server-detail-header.tsx`: node name, role, IP, status badge, uptime, last seen
3. `cpu-chart.tsx`: ECharts line chart, toggle per-core view, time range from global selector
4. `ram-chart.tsx`: ECharts — pie (used/cached/available) + trend line
5. `disk-charts.tsx`: partition usage bars + IOPS line chart + throughput line chart
6. `network-chart.tsx`: rx/tx bandwidth area chart + error rate
7. `process-manager-table.tsx`: table of monitored processes (status, PID, CPU%, RAM, uptime)
8. Socket.IO: subscribe to metrics for this specific node, update charts realtime

### Step 8: Frontend — Comparison View
1. Route `comparison.tsx`: multi-select nodes (2-5), select metric
2. `comparison-overlay-chart.tsx`: ECharts multi-line chart, one line per node, same Y-axis
3. Useful for debugging: "why is mta-03 slower than mta-07?"

### Step 9: Frontend — Cluster Heatmap
1. Route `heatmap.tsx`: select metric (CPU, RAM, network), time range
2. `cluster-heatmap.tsx`: ECharts heatmap
   - Rows: node IDs, Columns: time buckets (hourly for 24h view)
   - Color: metric value intensity (green → yellow → red)
   - Tooltip: node name, time, exact value
   - Click cell → navigate to server detail at that time

## Todo List
- [ ] Backend: enhance overview endpoint with real data
- [ ] Backend: add resolution param to node metrics
- [ ] Backend: add comparison endpoint
- [ ] Backend: add heatmap endpoint
- [ ] Frontend: build status bar (8 widgets)
- [ ] Frontend: build email throughput chart
- [ ] Frontend: build bounce rate trend chart
- [ ] Frontend: build MTA health heatmap grid
- [ ] Frontend: build top domains chart
- [ ] Frontend: build quick panels (MongoDB, WildDuck, alerts, actions)
- [ ] Frontend: build server list table
- [ ] Frontend: build server detail page (CPU, RAM, disk, network, processes)
- [ ] Frontend: build comparison view
- [ ] Frontend: build cluster heatmap
- [ ] Integration: verify agent → API → DB → Socket.IO → frontend pipeline
- [ ] Performance: overview loads in < 2s with 15 nodes

## Success Criteria
- Overview page shows live cluster health with real agent data
- All 8 status bar widgets display correct values
- 4 overview charts render with real data, update on auto-refresh
- Server list shows all registered nodes with sortable metrics
- Server detail shows realtime CPU/RAM/Disk/Network charts
- Socket.IO pushes update charts without page refresh
- Comparison overlay works for 2-5 nodes
- Heatmap displays all nodes with color-coded metric values

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| ECharts initial render slow with many data points | Med | Use `sampling: 'average'` for 24h+ ranges |
| Overview endpoint slow (multiple table joins) | High | Redis cache (30s TTL), pre-compute in background job |
| Socket.IO event flood (15 agents x 15s) | Low | Throttle broadcasts to 5s intervals per room |

## Security Considerations
- All endpoints require JWT auth
- Process restart action (if implemented) requires admin role
- No sensitive server credentials displayed

## Next Steps
- Phase 07: Email Flow dashboard adds email analytics on top of this foundation
- Phase 08: ZoneMTA IP management adds per-node IP drill-down
