# Phase 10 — IP Reputation & Blacklist Monitor (PRD Module 10)

## Context Links
- [Parent Plan](./plan.md)
- [PRD Section 16: IP Reputation & Blacklist Monitor](../wildduck-dashboard-requirements.md)
- Depends on: [Phase 08](./phase-08-zonemta-ip-management.md) (IP management foundation)

## Overview
- **Priority:** P1 (Blacklist detection is business-critical for deliverability)
- **Status:** pending
- **Effort:** 5-7 days
- **Description:** Build DNSBL checker engine (DNS lookups against 25+ blacklists), BullMQ scheduled checker with tiered frequency (critical=1min, high=5min, medium=15min), IP reputation overview with heatmap grid for all IPs, blacklisted IPs table, IP detail page with history, bulk operations, DNSBL list management, and auto-response rules (critical BL → auto-pause IP).

## Key Insights
- 2540 IPs × 25 DNSBLs = 63,500 checks per cycle — must be distributed efficiently
- Tiered frequency: critical lists checked every 1min, medium every 15min
- DNS lookups are I/O bound — use `dns.promises.resolve4` with concurrency pool
- Auto-pause on critical blacklist (Spamhaus, Barracuda) prevents cascading reputation damage
- Heatmap grid: visualize 2500+ IPs color-coded for quick anomaly spotting
- Results stored in blacklist_checks hypertable (365d retention)

## Requirements

### Functional
- **DNSBL checker engine:** DNS lookup module supporting 25+ blacklists, reverse IP format, response code parsing
- **Scheduled checks:** BullMQ repeatable jobs with tiered frequency per blacklist tier
- **IP reputation overview:** summary bar (total IPs, clean, blacklisted, critical), heatmap/grid view color-coded (green=clean, yellow=minor BL, red=critical BL, gray=inactive)
- **Blacklisted IPs table:** only listed IPs with BL names, tier, since when, delist links, actions
- **IP detail page:** blacklist history timeline, sending volume trend, bounce rate trend, per-destination delivery, warmup progress, DNSBL check results for all 25+ lists
- **Bulk operations:** check all IPs of a node, pause all blacklisted, resume delisted, export report
- **DNSBL list management:** add/remove DNSBLs, assign tiers, set per-tier check frequency
- **Auto-response rules:** critical BL → auto-pause IP + alert; medium BL → alert only

### Non-Functional
- Check 2500 IPs against 25 BLs within tiered schedule constraints
- DNS lookup timeout: 5s per query, parallel pool of 50 concurrent lookups
- Heatmap renders 2500+ cells at 60fps

## Architecture

### DNSBL Checker Engine
```
packages/backend/src/
├── services/
│   ├── dnsbl-checker-service.ts      # Core DNS lookup logic
│   └── dnsbl-scheduler-service.ts    # Tiered scheduling logic
├── workers/
│   ├── dnsbl-check-worker.ts         # BullMQ worker: execute checks
│   └── dnsbl-auto-response-worker.ts # Auto-pause on critical BL
├── routes/
│   ├── ip-reputation/
│   │   ├── overview.ts               # GET /ip-reputation/overview
│   │   ├── blacklisted.ts            # GET /ip-reputation/blacklisted
│   │   ├── ip-detail.ts              # GET /ip-reputation/:ip
│   │   ├── dnsbl-lists.ts            # GET/POST /ip-reputation/dnsbl-lists
│   │   ├── trigger-check.ts          # POST /ip-reputation/check
│   │   └── index.ts
```

### Check Algorithm
```
For each tier (critical, high, medium):
  1. Get all active sending_ips
  2. Get DNSBLs for this tier
  3. For each IP × DNSBL pair:
     a. Reverse IP: 103.21.58.15 → 15.58.21.103.zen.spamhaus.org
     b. DNS A record lookup (timeout 5s)
     c. If resolves → listed (parse response code for sub-list)
     d. If NXDOMAIN → not listed
  4. Bulk INSERT results into blacklist_checks
  5. If newly listed on critical BL → trigger auto-response
  6. Broadcast changes via Socket.IO
```

### Frontend New Files
```
src/routes/_authenticated/ip-reputation/
├── index.tsx                        # Overview + heatmap
├── blacklisted.tsx                  # Blacklisted IPs table
├── $ip.tsx                          # IP detail page
├── warmup.tsx                       # IP warmup (links to Phase 08)
└── dnsbl-management.tsx             # DNSBL list management

src/components/ip-reputation/
├── ip-summary-bar.tsx               # Total, clean, blacklisted, critical counters
├── ip-heatmap-grid.tsx              # ECharts heatmap: all IPs color-coded
├── blacklisted-table.tsx            # Table of currently listed IPs
├── ip-blacklist-timeline.tsx        # History timeline (listed/delisted events)
├── ip-sending-stats.tsx             # Volume + bounce trend for single IP
├── dnsbl-check-results.tsx          # All 25+ BLs status for single IP
├── dnsbl-list-manager.tsx           # CRUD for DNSBL list + tier assignment
└── auto-response-rules.tsx          # Configure auto-pause rules
```

## Implementation Steps

### Step 1: DNSBL Checker Service
1. `dnsbl-checker-service.ts`: core module
   - `checkIp(ip: string, dnsbl: string): Promise<DnsblResult>`
   - Reverse IP octets, append DNSBL hostname
   - Use `dns.promises.resolve4()` with 5s timeout
   - Parse response: 127.0.0.2 = SBL (Spamhaus), 127.0.0.4 = XBL, etc.
   - Return: `{ ip, dnsbl, listed: boolean, responseCode: string, duration_ms: number }`
2. Batch checker: `checkIpBatch(ips: string[], dnsbls: string[])` with concurrency pool (p-limit, 50 concurrent)

### Step 2: DNSBL Scheduler + Worker
1. Create `dnsbl_lists` table (or use seed data): name, hostname, tier, check_interval, enabled, delist_url
2. BullMQ repeatable jobs per tier:
   - Critical (zen.spamhaus.org, b.barracudacentral.org, bl.spamcop.net): every 1min
   - High (dnsbl.sorbs.net, cbl.abuseat.org): every 5min
   - Medium (uceprotect, spamrats, etc.): every 15min
3. Worker: fetch IPs + DNSBLs for tier → batch check → bulk insert blacklist_checks
4. Track state changes (newly listed, newly delisted) for alerting

### Step 3: Auto-Response Worker
1. After DNSBL check, if IP is newly listed on critical BL:
   - Update sending_ips.status = 'blacklisted'
   - Increment sending_ips.blacklist_count
   - Create alert_event (severity=critical)
   - Emit Socket.IO event `ip:blacklisted`
2. If IP delisted (was listed, now clean on all critical BLs):
   - Update status back to previous (active/warming)
   - Create alert_event (severity=info, resolved)
   - Emit `ip:delisted`
3. Make auto-pause configurable per BL tier

### Step 4: Backend — Reputation Endpoints
1. `GET /ip-reputation/overview`: aggregate summary (total, clean, listed by tier) + heatmap grid data
2. `GET /ip-reputation/blacklisted`: filter sending_ips where blacklist_count > 0, join latest check results
3. `GET /ip-reputation/:ip`: full detail — latest check results for all 25+ BLs, blacklist history from blacklist_checks, sending stats from email_stats_daily
4. `GET /ip-reputation/dnsbl-lists`: CRUD for DNSBL list management
5. `POST /ip-reputation/check`: manual trigger — enqueue immediate check for specified IP(s)

### Step 5: Frontend — Overview + Heatmap
1. `ip-summary-bar.tsx`: 4 stat cards (total IPs, clean count, blacklisted count, critical count)
2. `ip-heatmap-grid.tsx`: ECharts scatter/heatmap rendering all IPs
   - Group by node (row per node), IPs as cells within node
   - Color: green (clean), yellow (minor BL), red (critical BL), gray (inactive)
   - Hover tooltip: IP, node, BL names, last check time
   - Click → navigate to IP detail
3. Socket.IO: listen to `ip:blacklisted`/`ip:delisted` for realtime heatmap updates

### Step 6: Frontend — Blacklisted Table + IP Detail
1. `blacklisted-table.tsx`: IP, node, blacklist names, tier, since, delist link, actions (pause, view logs)
2. IP detail page (`$ip.tsx`):
   - `dnsbl-check-results.tsx`: table of all 25+ BLs — name, tier, status (green/red), last check, response code
   - `ip-blacklist-timeline.tsx`: visual timeline of listed/delisted events over time
   - `ip-sending-stats.tsx`: volume + bounce rate charts
   - Per-destination delivery table (reuse from Phase 08)

### Step 7: Frontend — DNSBL Management + Auto-Response
1. `dnsbl-list-manager.tsx`: table of all DNSBLs — name, hostname, tier dropdown, frequency, enabled toggle, delist URL
2. Add/remove DNSBL entries
3. `auto-response-rules.tsx`: configure what happens per tier (auto-pause, alert-only, ignore)

## Todo List
- [ ] Backend: DNSBL checker service (DNS lookup + batch)
- [ ] Backend: dnsbl_lists table (or enhance seed data)
- [ ] Backend: BullMQ scheduled checker (tiered frequency)
- [ ] Backend: auto-response worker (auto-pause + alert)
- [ ] Backend: IP reputation endpoints (overview, blacklisted, detail)
- [ ] Backend: DNSBL list management endpoints
- [ ] Backend: manual check trigger endpoint
- [ ] Frontend: IP summary bar
- [ ] Frontend: IP heatmap grid (2500+ cells)
- [ ] Frontend: blacklisted IPs table
- [ ] Frontend: IP detail page (BL results, timeline, sending stats)
- [ ] Frontend: DNSBL list manager
- [ ] Frontend: auto-response rules config
- [ ] Test: DNSBL checker correctly identifies listed IPs
- [ ] Test: auto-pause triggers on critical BL listing
- [ ] Test: heatmap renders 2500 cells at 60fps

## Success Criteria
- DNSBL checker runs on schedule, checks all IPs against all enabled BLs
- Blacklist results stored in blacklist_checks hypertable
- New listings trigger auto-pause (critical tier) + alert
- Heatmap shows all IPs color-coded, updates in realtime on new listing
- IP detail shows full BL check history + timeline
- DNSBL list management: add/remove/re-tier blacklists
- Manual check trigger works for single IP or batch

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| DNS lookup rate limiting by DNSBL providers | High | Distribute checks over time, respect rate limits, use local DNS resolver |
| 63K checks per cycle overloads DNS | High | Stagger by tier, concurrency pool of 50, circuit breaker if >10% timeouts |
| False positive auto-pause | Med | Require 2 consecutive positive checks before auto-pause |

## Security Considerations
- DNSBL check is read-only DNS lookup (no risk to BL providers)
- Auto-pause is reversible (manual resume)
- IP status changes logged in audit trail

## Next Steps
- Phase 12: Alert rules integrate with blacklist events
- Phase 13: Reports include IP reputation summary
