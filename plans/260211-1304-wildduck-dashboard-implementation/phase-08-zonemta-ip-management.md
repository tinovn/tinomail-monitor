# Phase 08 — ZoneMTA Outbound Cluster & IP Management (PRD Module 4)

## Context Links
- [Parent Plan](./plan.md)
- [PRD Section 10: ZoneMTA Outbound Cluster & IP Management](../wildduck-dashboard-requirements.md)
- Depends on: [Phase 06](./phase-06-overview-dashboard-and-server-monitoring.md), [Phase 07](./phase-07-email-flow-and-event-pipeline.md)

## Overview
- **Priority:** P1 (PRD calls this "MODULE QUAN TRONG NHAT" — most important)
- **Status:** pending
- **Effort:** 5-7 days
- **Description:** Build the ZoneMTA cluster overview (MTA node card grid), node detail page (3 tabs: Performance, IP Table, Destinations), IP address management with virtual scroll for 254+ IPs per node, IP warmup manager, and IP pool management. Directly impacts deliverability.

## Key Insights
- Node card grid: responsive auto-wrap, handle 10-100 nodes
- IP table per node: up to 254 IPs (IPv4 /24) + IPv6 — needs virtual scroll
- Warmup manager: daily limit progression (Day 1=50 → Day 90=unlimited)
- IP pools: group IPs by purpose (transactional, marketing, notification)
- Bulk operations critical: pause/resume 50+ IPs at once
- Per-IP per-destination breakdown: key for troubleshooting deliverability

## Requirements

### Functional
- **Cluster overview:** Card grid showing all MTA nodes with status, subnet, IP count, throughput, bounce rate, queue, blacklist count, CPU
- **Node detail — Performance tab:** throughput chart, delivery status pie, queue trend, CPU/RAM/Network
- **Node detail — IP Table tab:** full IP list with status, sent count, bounce rate, blacklists, warmup day, daily limit, reputation score, PTR, last used. Virtual scroll, multi-select, bulk actions, filter, sort, export CSV
- **Node detail — Destinations tab:** per-destination delivery quality from this node
- **IP Warmup Manager:** schedule display, progress tracker, auto-scaling suggestions, warmup groups
- **IP Pool Management:** create pools, assign IPs, add IP ranges (CIDR), emergency disable, PTR display

### Non-Functional
- IP table: 254+ rows smooth scroll at 60fps
- Node card grid: handle 100 nodes without layout issues
- Bulk operations: < 2s for 100 IP status changes

## Architecture

### Backend New Endpoints
```
GET  /zonemta/nodes                      # MTA nodes with aggregated stats
GET  /zonemta/nodes/:id/performance      # Performance metrics for MTA node
GET  /zonemta/nodes/:id/ips              # IPs for a node (paginated + filterable)
GET  /zonemta/nodes/:id/destinations     # Per-destination breakdown for node
PUT  /ips/:ip/warmup                     # Update warmup config
POST /ips/pools                          # Create IP pool
GET  /ips/pools                          # List pools
PUT  /ips/pools/:id                      # Update pool (add/remove IPs)
POST /ips/range                          # Add IP range (CIDR → generate entries)
```

### Frontend New Files
```
src/routes/_authenticated/servers/
├── zonemta/
│   ├── index.tsx                    # ZoneMTA cluster overview (card grid)
│   └── $nodeId.tsx                  # MTA node detail (3 tabs)

src/components/zonemta/
├── mta-node-card-grid.tsx           # Responsive card grid for all MTA nodes
├── mta-node-card.tsx                # Single node card: status, stats, click drill-down
├── node-performance-tab.tsx         # Throughput, delivery pie, queue, resources
├── node-ip-table-tab.tsx            # IP address table with virtual scroll
├── node-destinations-tab.tsx        # Per-destination quality table
├── ip-warmup-manager.tsx            # Warmup schedule + progress + groups
├── ip-pool-manager.tsx              # Pool CRUD + IP assignment
├── ip-bulk-actions-bar.tsx          # Appears on multi-select: pause/resume/check
└── ip-range-form.tsx                # Add CIDR range → generate IP entries
```

## Implementation Steps

### Step 1: Backend — MTA Node Stats
1. `GET /zonemta/nodes`: query nodes where role='zonemta-outbound'
2. Enrich each node with: total IPs, active IPs, throughput 1h (from email_stats_1h), bounce rate, queue size (from ZoneMTA API cache), blacklisted IP count
3. Cache result 30s in Redis

### Step 2: Backend — Node Performance
1. `GET /zonemta/nodes/:id/performance`: query metrics_zonemta + metrics_system for the node
2. Return: throughput time-series, delivery status breakdown (pie data), queue trend, CPU/RAM/Network

### Step 3: Backend — Node IPs + Destinations
1. `GET /zonemta/nodes/:id/ips`: query sending_ips filtered by node_id
2. Enrich with: sent_1h, sent_24h, bounce_rate (from email_stats_1h), blacklist names (latest blacklist_checks where listed=true)
3. Support: sort, filter by status, search by IP, pagination
4. `GET /zonemta/nodes/:id/destinations`: query email_stats_1h grouped by to_domain for this node's IPs

### Step 4: Backend — IP Warmup + Pools
1. `PUT /ips/:ip/warmup`: update warmup_start, warmup_day, daily_limit
2. `POST /ips/pools`: create pool entry (new table `ip_pools`: id, name, type, ips[])
3. `POST /ips/range`: parse CIDR, generate sending_ips entries (e.g., /24 → 254 IPs)

### Step 5: Frontend — Cluster Card Grid
1. `mta-node-card-grid.tsx`: CSS grid, auto-fit minmax(280px, 1fr) for responsive wrapping
2. `mta-node-card.tsx`: card per PRD 10.1 layout — status dot, subnet, IP count, sent/h, bounce%, queue, blacklisted count, CPU%
3. Click card → navigate to `/servers/zonemta/:nodeId`
4. Color coding: node status (green/yellow/red based on combined health)

### Step 6: Frontend — Node Detail (3 Tabs)
1. Tab 1 — Performance: reuse charts from Phase 06 (CPU/RAM/Network), add throughput chart + delivery pie + queue trend specific to this MTA node
2. Tab 2 — IP Table: `node-ip-table-tab.tsx`
   - TanStack Table + react-virtual for 254+ rows
   - Columns per PRD 10.2: IP, version, status badge, sent 1h/24h, bounce%, blacklists, warmup day, daily limit/sent, reputation progress bar, PTR, last used, actions
   - Multi-select checkbox → bulk actions bar appears
   - Filters: status dropdown, search by IP
   - Export CSV button
3. Tab 3 — Destinations: TanStack Table — destination domain, sent, deliver%, bounce%, avg time, deferred count

### Step 7: Frontend — IP Warmup Manager
1. `ip-warmup-manager.tsx`: show warmup schedule (day → daily limit progression)
2. Progress tracker per IP: current day, current limit, daily sent vs limit bar
3. Auto-scaling suggestion: if bounce rate < 2% for 3 consecutive days → suggest increase
4. Warmup group management: batch IPs into groups, start warmup together

### Step 8: Frontend — IP Pool + Range Management
1. `ip-pool-manager.tsx`: list pools, create new (name + type), assign/unassign IPs
2. `ip-range-form.tsx`: input CIDR → preview IPs to be created → confirm → POST /ips/range
3. Emergency disable: one-click button to pause entire node's IPs

## Todo List
- [ ] Backend: GET /zonemta/nodes with enriched stats
- [ ] Backend: GET /zonemta/nodes/:id/performance
- [ ] Backend: GET /zonemta/nodes/:id/ips with enrichment
- [ ] Backend: GET /zonemta/nodes/:id/destinations
- [ ] Backend: IP warmup + pool + range endpoints
- [ ] Add ip_pools table to schema (if not in Phase 02)
- [ ] Frontend: MTA node card grid (responsive)
- [ ] Frontend: MTA node card component
- [ ] Frontend: node detail page with 3 tabs
- [ ] Frontend: IP table with virtual scroll + multi-select
- [ ] Frontend: bulk actions bar (pause/resume/check)
- [ ] Frontend: IP warmup manager
- [ ] Frontend: IP pool manager
- [ ] Frontend: IP range CIDR form
- [ ] Test: 254 IPs render smoothly in virtual table
- [ ] Test: bulk pause 100 IPs completes in < 2s

## Success Criteria
- ZoneMTA cluster overview shows all MTA nodes as responsive card grid
- Node detail Performance tab shows throughput, delivery breakdown, queue, resources
- IP Table tab shows 254+ IPs with smooth virtual scroll
- Multi-select + bulk pause/resume works
- IP warmup manager shows progression and suggestions
- IP pool CRUD works
- CIDR range input generates correct IP entries

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| 254 IPs slow to enrich (join blacklist + email stats) | High | Pre-compute stats in background job, cache 60s |
| Virtual scroll layout issues with variable row height | Med | Fixed row height for IP table |
| CIDR parsing edge cases (IPv6) | Low | Use `ip-cidr` npm package, validate server-side |

## Security Considerations
- IP status changes (pause/resume) require operator or admin role
- Emergency disable requires admin role
- Bulk operations logged in audit trail
- PTR records are read-only display (DNS changes outside dashboard)

## Next Steps
- Phase 10: IP reputation & blacklist monitoring drills deeper into per-IP health
- Phase 12: Alerting triggers on IP blacklist events
