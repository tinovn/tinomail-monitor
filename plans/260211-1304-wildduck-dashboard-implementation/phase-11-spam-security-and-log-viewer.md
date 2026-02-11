# Phase 11 — Spam & Security Dashboard + Log Viewer & Message Tracing (PRD Modules 8+9)

## Context Links
- [Parent Plan](./plan.md)
- [PRD Section 14: Spam & Security](../wildduck-dashboard-requirements.md)
- [PRD Section 15: Log Viewer & Message Tracing](../wildduck-dashboard-requirements.md)
- Depends on: [Phase 07](./phase-07-email-flow-and-event-pipeline.md) (email events data)

## Overview
- **Priority:** P2
- **Status:** pending
- **Effort:** 5-7 days
- **Description:** Build Rspamd dashboard (scan stats, top symbols, learning), authentication monitoring (failed auth, brute-force detection), TLS monitoring, comprehensive log search with advanced filters, and message tracing (full email lifecycle timeline). Log viewer is the #1 debugging tool for mail admins.

## Key Insights
- Rspamd metrics from HTTP API (:11334/stat) — already collected in metrics_rspamd hypertable
- Auth monitoring: parse from WildDuck/Haraka logs or GELF events
- Log search queries email_events table with full-text filters — needs fast indexed queries
- Message tracing: reconstruct full lifecycle from email_events by message_id or queue_id
- Saved searches: store filter criteria as JSON, option to create alerts from searches

## Requirements

### Functional (Spam & Security — PRD 14)
- **Rspamd dashboard:** scanned count, ham/spam ratio pie, action breakdown bar, spam trend 24h, top spam symbols table, top spam source IPs, learning stats, false positive estimate
- **Auth monitoring:** auth success/fail counters, failed auth by IP (top 20), failed auth by user, brute-force detection (>10 fails from 1 IP in 5min), geo-map optional
- **Outbound spam:** spam score distribution histogram, high-score outbound table, rate-limited users, compromised account indicators
- **TLS monitoring:** TLS connection % (inbound + outbound), cert expiry per domain, cipher suite distribution, TLS version distribution

### Functional (Log Viewer — PRD 15)
- **Log search:** prominent search bar, filters: time range, event type, from/to address, from/to domain, MTA node, sending IP, message ID, queue ID, status code range, bounce type, free text. Result table: time, type, from, to, node, IP, status, delivery time, size, trace action
- **Message tracing:** click Trace → show full email lifecycle: SUBMITTED → QUEUED → DKIM SIGNED → TRANSFERRED → DELIVERY ATTEMPT → DELIVERED/BOUNCED. Visual horizontal timeline.
- **Features:** infinite/virtual scroll, export results (CSV, JSON), saved searches, shareable URL, syntax highlighting for SMTP responses

### Non-Functional
- Log search: < 3s for queries over 1M+ email events
- Message trace: < 1s to reconstruct lifecycle
- Rspamd API polling: every 30s (already in metrics_rspamd)

## Architecture

### Backend New Endpoints
```
# Spam & Security
GET  /spam/rspamd                    # Rspamd dashboard data (from metrics_rspamd)
GET  /spam/auth-events               # Auth success/fail from logs
GET  /spam/outbound-scores           # High spam score outbound emails
GET  /security/tls                   # TLS stats

# Logs
GET  /email/events                   # Enhanced search (from Phase 07, add full filters)
GET  /email/trace/:messageId         # Full message lifecycle trace
POST /logs/saved-searches            # Save search criteria
GET  /logs/saved-searches            # List saved searches
```

### Frontend New Files
```
src/routes/_authenticated/
├── spam-security/
│   ├── index.tsx                    # Rspamd tab
│   ├── authentication.tsx           # Auth monitoring tab
│   └── tls.tsx                      # TLS tab
├── logs/
│   ├── index.tsx                    # Log search page
│   └── trace.$messageId.tsx         # Message trace page

src/components/spam-security/
├── rspamd-stats-cards.tsx           # Scanned, ham, spam counters
├── rspamd-action-breakdown.tsx      # Bar chart: actions
├── rspamd-spam-trend.tsx            # 24h line chart
├── rspamd-top-symbols.tsx           # Table: symbol, count, %
├── rspamd-learning-stats.tsx        # Ham/spam learned counters
├── auth-success-fail-chart.tsx      # Counter + trend
├── auth-failed-by-ip-table.tsx      # Top 20 IPs
├── brute-force-alerts.tsx           # Active brute-force detections
├── tls-connection-gauge.tsx         # % TLS inbound/outbound
├── cert-expiry-table.tsx            # Domain, days until expiry
└── tls-version-chart.tsx            # Pie: TLS 1.2 vs 1.3

src/components/logs/
├── log-search-bar.tsx               # Multi-filter search interface
├── log-filter-panel.tsx             # Expandable filter options
├── log-results-table.tsx            # Virtual scroll results
├── message-trace-timeline.tsx       # Full lifecycle visual timeline
├── message-trace-step.tsx           # Single step in timeline
└── saved-search-manager.tsx         # List + manage saved searches
```

## Implementation Steps

### Step 1: Backend — Rspamd Dashboard
1. Query metrics_rspamd hypertable: aggregate scanned, ham, spam, greylist, rejected for time range
2. Action breakdown: compute from ham/spam/greylist/rejected counts
3. Top spam symbols: query Rspamd HTTP API directly (`GET :11334/stat`) — cache 60s
4. Learning stats: from metrics_rspamd learned_ham/learned_spam columns
5. Spam trend: time-series from metrics_rspamd continuous aggregate

### Step 2: Backend — Auth Monitoring
1. Auth events: add new hypertable `auth_events` (time, node_id, username, source_ip, success, failure_reason)
2. Ingest from: Haraka/WildDuck GELF logs or dedicated auth event hook
3. Brute-force detection: BullMQ job every 30s — query auth_events for IPs with >10 failures in 5min
4. Failed by IP: aggregate auth_events grouped by source_ip, sorted by fail count

### Step 3: Backend — TLS Monitoring
1. TLS stats: aggregate from email_events where relevant TLS fields exist (or separate tls_stats table)
2. Cert expiry: call `openssl s_client` or use `tls.connect()` to check cert dates for each domain's SMTP
3. Cache cert check results (1h TTL)

### Step 4: Backend — Enhanced Log Search
1. Enhance `GET /email/events` from Phase 07 with all PRD 15.1 filters
2. Full-text search on status_message, bounce_message using PostgreSQL `ILIKE` or `tsvector`
3. Performance: ensure all filter columns have indexes (already defined in Phase 02)
4. Cursor-based pagination for infinite scroll (not offset-based — better for large datasets)
5. Return total count estimate using `COUNT(*)` with time-bounded query

### Step 5: Backend — Message Tracing
1. `GET /email/trace/:messageId`: query email_events where message_id matches
2. Return ordered list of events (by timestamp) forming the lifecycle
3. Enrich each step: add context (which node, which IP, TLS info, DKIM result)
4. If message_id not found, try queue_id fallback

### Step 6: Frontend — Rspamd Dashboard
1. `rspamd-stats-cards.tsx`: scanned/h, ham count, spam count, greylist count
2. `rspamd-action-breakdown.tsx`: horizontal bar chart (no action, add header, reject, greylist)
3. `rspamd-spam-trend.tsx`: line chart 24h
4. `rspamd-top-symbols.tsx`: table with symbol name, hit count, percentage
5. `rspamd-learning-stats.tsx`: ham learned / spam learned counters

### Step 7: Frontend — Auth + TLS Monitoring
1. Auth: success/fail counter cards, trend chart, top failed IPs table, brute-force alert panel
2. TLS: gauge (% encrypted), cert expiry table (days, color-coded), TLS version pie chart

### Step 8: Frontend — Log Search
1. `log-search-bar.tsx`: prominent search input with filter icon to expand filter panel
2. `log-filter-panel.tsx`: collapsible panel with all PRD 15.1 filter fields
   - Time range (uses global), event type multi-select, from/to address/domain inputs, MTA node multi-select, sending IP, message ID, queue ID, status code range, bounce type, free text
3. `log-results-table.tsx`: TanStack Table + virtual scroll
   - Columns: time, event type icon, from, to, node, IP, status code, delivery time, size, [Trace] button
   - Infinite scroll (fetch next page on scroll to bottom)
   - Export button (CSV, JSON)
4. Filter state encoded in URL (shareable links per PRD 21.1)

### Step 9: Frontend — Message Tracing
1. `message-trace-timeline.tsx`: vertical timeline showing each step
2. Each step: timestamp, icon (submitted, queued, signed, transferred, delivery attempt, delivered/bounced), details text
3. Highlight: success steps green, failure red, intermediate gray
4. Show total elapsed time from first to last event
5. Horizontal mini-timeline bar at top for visual overview

### Step 10: Saved Searches
1. Save button on log search: stores filter criteria as JSON in saved_views table
2. List saved searches in sidebar or dropdown
3. Option to create alert from saved search (link to Phase 12)

## Todo List
- [ ] Backend: Rspamd dashboard endpoint (aggregate + API)
- [ ] Backend: auth_events table + ingestion
- [ ] Backend: brute-force detection job
- [ ] Backend: TLS monitoring endpoint
- [ ] Backend: enhance email events search (all filters + cursor pagination)
- [ ] Backend: message trace endpoint
- [ ] Backend: saved searches CRUD
- [ ] Frontend: Rspamd stats cards + charts
- [ ] Frontend: auth monitoring panel
- [ ] Frontend: TLS monitoring panel
- [ ] Frontend: log search bar + filter panel
- [ ] Frontend: log results table (virtual scroll + infinite scroll)
- [ ] Frontend: message trace timeline
- [ ] Frontend: saved search manager
- [ ] Test: log search < 3s on 1M+ events
- [ ] Test: message trace reconstructs full lifecycle

## Success Criteria
- Rspamd dashboard shows live scan stats, top symbols, learning progress
- Auth monitoring detects brute-force attempts
- TLS panel shows encryption % and cert expiry warnings
- Log search supports all PRD filters, returns results < 3s
- Message trace shows complete email lifecycle timeline
- Filters encoded in URL (shareable)
- Saved searches persist and reload correctly

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Log search slow on 1M+ rows | High | Cursor pagination, time-bounded queries, proper indexes |
| Auth event ingestion adds complexity | Med | Start with basic Haraka hook, expand later |
| Message trace incomplete (missing steps) | Med | Graceful: show available steps, indicate gaps |

## Security Considerations
- Log search may expose email addresses — restrict to operator+admin
- Brute-force IPs should not be leaked to unauthorized users
- Saved searches may contain PII filters — scope to user who created them

## Next Steps
- Phase 12: Alerting system can create alerts from saved searches
- Phase 13: Reports include security summary
