# Phase 09 — Domain Quality, User Analytics & Destination Analysis (PRD Modules 5+6+7)

## Context Links
- [Parent Plan](./plan.md)
- [PRD Section 11: Domain Quality & Reputation](../wildduck-dashboard-requirements.md)
- [PRD Section 12: User Analytics](../wildduck-dashboard-requirements.md)
- [PRD Section 13: Destination Analysis](../wildduck-dashboard-requirements.md)
- Depends on: [Phase 07](./phase-07-email-flow-and-event-pipeline.md) (email events data)

## Overview
- **Priority:** P2 (Valuable analytics, builds on email event data)
- **Status:** pending
- **Effort:** 5-7 days
- **Description:** Build three related modules: sending domain quality dashboard with health score algorithm, user analytics with abuse detection, and destination domain analysis with per-IP per-domain breakdown. All powered by email_events + continuous aggregates.

## Key Insights
- Domain health score: algorithmic (0-100) based on bounce rate, auth pass rates, spam reports, delivery time
- User analytics: pull from WildDuck REST API + email_events aggregation
- Abuse detection: background job checking volume spikes, bounce anomalies, unusual patterns
- Destination analysis: critical for understanding why Gmail/Outlook/Yahoo delivery varies
- All three modules heavily query email_stats_daily and email_stats_1h continuous aggregates

## Requirements

### Functional (Domain Quality — PRD 11)
- Domain list table: domain, status, sent 24h, delivered%, bounce%, hard/soft bounce, spam reports, DKIM/SPF/DMARC pass%, avg delivery time, reputation score, trend arrow
- Domain detail: auth health (DKIM/SPF/DMARC trends + DNS record checker), delivery quality (bounce reasons pie, delivery time P50/P95/P99), per-destination analysis, top senders, sending pattern heatmap, 30d volume trend
- Domain health score algorithm per PRD 11.3

### Functional (User Analytics — PRD 12)
- User list table: user, domain, sent/received 24h, bounce%, spam reports, quota used, last active, risk level
- User detail: send/receive trend, top destinations, bounce rate per dest, login history, quota trend, message size distribution
- Abuse detection rules: volume spike, high bounce, spam complaints, unusual destinations, odd hours
- User groups/labels: create groups, view aggregate stats, set rate limits per group

### Functional (Destination Analysis — PRD 13)
- Destination domain table: domain, sent 24h, delivered%, bounced%, deferred, blocked, avg/P95 delivery time, MX hosts, trend
- Destination detail: delivery quality trend (7d, 30d), per-IP breakdown, bounce reason analysis, SMTP response code breakdown, best sending window heatmap
- MX host health table: response time, success rate, last error

### Non-Functional
- Domain list: handle 1000+ domains
- User list: handle 10K+ users (paginated)
- Destination list: handle 5000+ domains

## Architecture

### Backend New Endpoints
```
# Domains
GET  /domains                         # Sending domain list with stats
GET  /domains/:domain                 # Domain detail + health score
GET  /domains/:domain/destinations    # Per-destination from this domain
GET  /domains/:domain/senders         # Top senders in this domain
GET  /domains/:domain/dns-check       # Check DKIM/SPF/DMARC DNS records

# Users (mail users, not dashboard users)
GET  /users                           # User list with email stats
GET  /users/:address                  # User detail
GET  /users/:address/activity         # Send/receive history
GET  /users/abuse-flags               # Flagged users

# Destinations
GET  /destinations                    # Destination domain stats
GET  /destinations/:domain            # Detail for destination
GET  /destinations/:domain/by-ip      # Per-IP breakdown to this dest
GET  /destinations/:domain/mx         # MX host health
```

### Frontend New Files
```
src/routes/_authenticated/
├── domains/
│   ├── index.tsx                    # Domain list page
│   └── $domain.tsx                  # Domain detail page
├── users/
│   ├── index.tsx                    # User list page
│   └── $address.tsx                 # User detail page

src/components/domains/
├── domain-list-table.tsx            # TanStack Table for domains
├── domain-health-score-badge.tsx    # Score display (0-100 gauge)
├── domain-auth-health.tsx           # DKIM/SPF/DMARC panel with DNS check
├── domain-delivery-quality.tsx      # Bounce reasons, delivery times
├── domain-destinations-table.tsx    # Per-dest breakdown
├── domain-top-senders-table.tsx     # Top users in domain
├── domain-sending-pattern.tsx       # Heatmap: hour × day-of-week
└── domain-volume-trend.tsx          # 30d line chart

src/components/users/
├── user-list-table.tsx
├── user-risk-badge.tsx              # Green/yellow/red risk level
├── user-activity-charts.tsx         # Send/receive trend
├── user-destinations-table.tsx
└── user-abuse-flags-panel.tsx       # Flagged users list

src/components/destinations/
├── destination-list-table.tsx
├── destination-delivery-trend.tsx   # 7d/30d chart
├── destination-per-ip-table.tsx     # Per sending IP breakdown
├── destination-bounce-reasons.tsx   # Breakdown pie
├── destination-smtp-codes.tsx       # Response code bar chart
├── destination-sending-window.tsx   # Heatmap: best hours to send
└── destination-mx-health.tsx        # MX host table
```

## Implementation Steps

### Step 1: Backend — Domain Service
1. `GET /domains`: query sending_domains table, enrich each with stats from email_stats_daily (last 24h): sent, delivered%, bounce%, hard/soft bounce, avg delivery time
2. Compute health score per PRD 11.3 algorithm:
   ```
   Score = 100
   - bounce_rate > 5% ? 20 : bounce_rate * 3
   - hard_bounce > 2% ? 15 : 0
   - dkim_pass < 99% ? 10 : 0
   - spf_pass < 99% ? 10 : 0
   - dmarc_pass < 95% ? 10 : 0
   - spam_reports > 0 ? spam_reports * 5 : 0
   - avg_delivery_time > 10s ? 10 : 0
   - any_ip_blacklisted ? 15 : 0
   ```
3. Cache computed scores in Redis (5min TTL)

### Step 2: Backend — Domain Detail
1. `GET /domains/:domain`: full stats + auth pass rates + delivery metrics
2. `GET /domains/:domain/destinations`: query email_stats_1h grouped by to_domain for this from_domain
3. `GET /domains/:domain/senders`: query email_stats_daily grouped by from_user
4. `GET /domains/:domain/dns-check`: perform live DNS lookups for DKIM, SPF, DMARC TXT records, return pass/fail

### Step 3: Backend — User Service
1. `GET /users`: query WildDuck REST API `/users` for user list
2. Enrich with email_stats_daily: sent/received 24h, bounce rate
3. Compute risk level: Low (normal), Medium (elevated bounce), High (abuse flags)
4. `GET /users/abuse-flags`: query users matching abuse rules (volume spike, high bounce, etc.)

### Step 4: Backend — Destination Service
1. `GET /destinations`: aggregate email_stats_1h grouped by to_domain
2. `GET /destinations/:domain/by-ip`: breakdown by sending_ip for this to_domain
3. `GET /destinations/:domain/mx`: query email_events for mx_host field, aggregate response times

### Step 5: Backend — Abuse Detection Job
1. BullMQ repeatable job: every 5 minutes
2. Check rules per PRD 12.3:
   - Volume spike: sent > 10x 7-day average in 1h
   - High bounce: > 10% bounce for 30min
   - Spam complaints: > 3 in 24h
   - Unusual destinations: > 500 unique to_domains in 1h
3. Flag users in Redis set, create alert_events

### Step 6: Frontend — Domain List + Detail
1. Domain list table with health score badge, sortable columns
2. Domain detail page with tabbed sections:
   - Auth Health: DKIM/SPF/DMARC pass rate trends + DNS check results
   - Delivery Quality: bounce reason pie, delivery time P50/P95/P99
   - Destinations: per-destination table
   - Top Senders: user table within domain
   - Sending Pattern: ECharts heatmap (hour × weekday)
   - Volume Trend: 30d line chart

### Step 7: Frontend — User List + Detail
1. User list table with risk badge, quota progress bar
2. User detail: send/receive trend chart, top destinations, abuse indicators

### Step 8: Frontend — Destination List + Detail
1. Destination list table: sortable by delivered%, bounce%, delivery time
2. Destination detail:
   - Delivery trend (7d/30d line)
   - Per-IP table (which IPs send to this dest, what's the quality)
   - Bounce reasons pie
   - SMTP response code bar chart
   - Best sending window heatmap (ECharts)
   - MX host health table

## Todo List
- [ ] Backend: domain list + health score computation
- [ ] Backend: domain detail + DNS check
- [ ] Backend: user list (WildDuck API integration)
- [ ] Backend: abuse detection BullMQ job
- [ ] Backend: destination list + detail endpoints
- [ ] Backend: per-IP per-destination breakdown
- [ ] Frontend: domain list table + health score badge
- [ ] Frontend: domain detail page (6 sections)
- [ ] Frontend: user list + detail pages
- [ ] Frontend: destination list + detail pages
- [ ] Frontend: sending pattern heatmap
- [ ] Frontend: best sending window heatmap
- [ ] Test: domain health score matches PRD algorithm
- [ ] Test: abuse detection flags test user with spike

## Success Criteria
- Domain list shows all sending domains with health scores
- Domain detail shows auth health, bounce breakdown, per-destination stats
- DNS check returns live DKIM/SPF/DMARC verification
- User list shows risk levels, abuse flags work on test data
- Destination list shows delivery quality per destination domain
- Per-IP per-destination breakdown helps identify problematic IP+destination combos
- Heatmaps render correctly (sending patterns, sending windows)

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| WildDuck API rate limiting for user list | Med | Cache user list (5min), paginate requests |
| DNS check slow for many domains | Med | Async DNS, cache results 1h, background refresh |
| Health score too aggressive/lenient | Low | Make thresholds configurable in settings |

## Security Considerations
- User email addresses are PII — restrict to operator+admin roles
- DNS check only reads public DNS records
- Abuse flags visible only to operator+admin

## Next Steps
- Phase 10: IP reputation builds on per-IP stats from this phase
- Phase 12: Alert rules can trigger on domain health score drops
