# Monitoring Agent Architecture Summary
**Date:** 2026-02-11
**Research Output:** wildduck-metrics-collection.md

---

## Overview

Comprehensive research on 7 WildDuck ecosystem repositories identifies **multi-source data collection pattern** as necessary architecture. No single component exposes complete metrics; agent must integrate HTTP APIs, plugin hooks, and system utilities.

---

## Core Findings by Component

### Zone-MTA (Outbound Queue)
| Aspect | Status | Details |
|--------|--------|---------|
| **Metrics Endpoint** | ✅ Yes | Prometheus `/metrics` on port 12080 |
| **Queue API** | ✅ Yes | REST endpoints for counters, queue listing, message details |
| **Plugin Hooks** | ✅ Yes | `sender:fetch`, `sender:delivered`, `queue:bounce`, `log:entry` |
| **Data Richness** | High | Delivery status, queue size, bounce types |

**Collection Method:** HTTP scrape `/metrics` + REST API `/counter/zone/` + custom plugin for real-time events

---

### WildDuck (Mailbox Server)
| Aspect | Status | Details |
|--------|--------|---------|
| **Metrics Endpoint** | ❌ No | No `/metrics` or `/stats` endpoint |
| **REST API** | ✅ Yes | User/mailbox/message endpoints but no aggregates |
| **Built-in Stats** | ❌ No | Feature requested (issue #89) but not implemented |
| **Data Richness** | Low | Must query individual resources & aggregate |

**Collection Method:** Custom REST client querying `/users` + per-user stats with TimescaleDB aggregation

---

### Haraka (Inbound SMTP)
| Aspect | Status | Details |
|--------|--------|---------|
| **Plugin System** | ✅ Strong | Extensive hooks at every mail flow stage |
| **Documentation** | 🟡 Sparse | GitHub docs adequate but incomplete |
| **Hook Coverage** | ✅ Complete | SMTP, recipient, queue, delivery hooks available |
| **Data Richness** | High | All inbound message events accessible |

**Collection Method:** Custom Haraka plugin capturing `hook_queue`, `hook_delivered`, spam scores from headers

---

### Rspamd (Spam Detection)
| Aspect | Status | Details |
|--------|--------|---------|
| **Score Exposure** | ✅ Yes | Via Haraka-rspamd plugin headers |
| **Symbol Details** | ✅ Yes | Individual symbol names + scores captured |
| **Direct Access** | TCP | `localhost:11333` (if needed) |

**Collection Method:** Parse Rspamd headers added by Haraka plugin

---

### System Metrics
| Aspect | Status | Details |
|--------|--------|---------|
| **Library** | ✅ `systeminformation` | 50+ functions, zero dependencies |
| **Platforms** | ✅ Linux, macOS, Windows, BSD | Full coverage for deployment targets |
| **Metrics** | ✅ CPU, Memory, Disk, Network | All basic system stats available |

**Collection Method:** Agent-side polling with 15-60s intervals

---

## Integration Pattern

```
┌─────────────────────────────────────┐
│      Monitoring Dashboard API       │
└────────────┬────────────────────────┘
             │
    ┌────────┴─────────┐
    │                  │
┌───▼────┐         ┌───▼─────┐
│  Agent │         │ Backend  │
└───┬────┘         └────┬─────┘
    │                   │
┌───▼──────────────┬────▼───────────┐
│                  │                 │
┌▼──┐   ┌───┐  ┌──▼──┐   ┌────┐  ┌─▼─┐
│CPU│   │RAM│  │Disk │   │Net │  │Sys│
│   │   │   │  │     │   │    │  │   │
└───┘   └───┘  └─────┘   └────┘  └───┘
                │
            System metrics
            (systeminformation)

Zone-MTA              WildDuck            Haraka
┌──────────┐         ┌─────────┐         ┌──────┐
│Prometheus│         │REST API │         │Plugin│
│/metrics  │         │endpoints│         │hooks │
│Port 12080│         │Port 3000│         │      │
└──────────┘         └─────────┘         └──────┘
     │                   │                  │
     ├─ Queue size       ├─ User count      ├─ Inbound events
     ├─ Delivery status  ├─ Mailbox stats   ├─ Spam scores
     ├─ Bounce types    └─ Message counts   └─ Delivery status
     └─ Message push/drop
```

---

## Critical Implementation Details

### Zone-MTA Metrics Scrape
```
GET http://{zonemta}:12080/metrics
Expected metrics:
- zonemta_delivery_status (counter, result label)
- zonemta_message_push (counter)
- zonemta_message_drop (counter)
- zonemta_queue_size (gauge, type label)
```

**⚠️ Known Issue:** Disable Restify gzip plugin; requires async/await handler.

### WildDuck Data Collection
No metrics endpoint exists. Strategy:
1. Query `GET /users?limit=1000` (paginated)
2. For each user: `GET /users/{userId}` (quota info)
3. Aggregate in TimescaleDB with continuous aggregates
4. Recalculate on 5-min schedule

### Haraka Custom Plugin Requirements
```javascript
// Register hooks at module load
exports.register = function() {
  this.register_hook('rcpt', 'wildduck_rcpt_check');
  this.register_hook('queue', 'wildduck_queue_store');
  this.register_hook('delivered', 'wildduck_delivery_capture');
};

// Capture inbound message lifecycle
exports.wildduck_queue_store = function(next, connection) {
  // Push to backend API / Redis
};
```

### Rspamd Score Capture
- Haraka-rspamd plugin adds headers: `X-Spam-Score`, `X-Spam-Report`
- Parse headers in monitoring plugin
- Store spam scores in `email_events.spam_score` column

### System Metrics Collection (Agent)
```javascript
const si = require('systeminformation');

// Every 15 seconds
setInterval(async () => {
  const cpu = await si.currentLoad();
  const mem = await si.mem();
  const disk = await si.fsSize();
  // POST to backend /api/v1/metrics/{nodeId}
}, 15000);
```

---

## Data Schema Requirements

### Time-Series Tables (15s intervals)
```sql
metrics_system: cpu_load, memory_percent, disk_used, network_in/out
metrics_zonemta: queue_size, delivered_total, rejected_total, deferred_total
metrics_haraka: inbound_total, spam_count, delivered_count, bounce_count
```

### Event Tables (immediate)
```sql
email_events: from_user, from_domain, to_domain, mta_node, spam_score, size_bytes, timestamp
delivery_events: message_id, zone, status (delivered/rejected/deferred), timestamp
```

### Continuous Aggregates
```sql
metrics_zonemta_5m: rollup at 5-min from raw metrics
metrics_zonemta_1h: rollup at 1-hour
metrics_zonemta_daily: rollup at daily
```

---

## Plugin Hook Deployment

### Zone-MTA Monitor Plugin
**Path:** `packages/agent/plugins/zone-mta-monitor.js`
- Hooks into: `sender:fetch`, `sender:delivered`, `queue:bounce`
- Output: Redis pub/sub + HTTP POST to backend
- No core modifications needed

### Haraka Monitor Plugin
**Path:** `packages/agent/plugins/haraka-monitor.js`
- Hooks into: `hook_rcpt`, `hook_queue`, `hook_delivered`
- Extracts: Rspamd headers, recipient validation, storage status
- Output: HTTP POST to backend API

---

## Data Flow Timeline

```
Agent Startup
    ↓
1. Detect Zone-MTA (port 12080 /metrics)
2. Detect Haraka (port 25 SMTP detection)
3. Detect WildDuck (port 143 IMAP detection)
4. Auto-register node + load custom plugins
5. Start system metrics polling (15s)
6. Start Zone-MTA metrics scrape (30s)
7. Start WildDuck user stats query (5min)
8. Listen for email events via hooks
    ↓
Event Types:
- Inbound message accepted (Haraka hook)
- Outbound message queued (Zone-MTA hook)
- Outbound message delivered/bounced (Zone-MTA hook)
- System metrics collected (15s interval)
    ↓
Push to Backend
- Real-time events: HTTP POST immediately
- Batch metrics: Every 30-60s
```

---

## Configuration Parameters for Monitoring Agent

```toml
# Auto-detection (enabled by default)
[discovery]
zone_mta_port = 12080
zone_mta_metrics_path = "/metrics"
wildduck_api_port = 3000
haraka_smtp_port = 25
rspamd_tcp_port = 11333

# Collection intervals
[intervals]
system_metrics = 15       # seconds
zone_mta_prometheus = 30  # seconds
wildduck_api_query = 300  # seconds (5 min)
email_events = "immediate" # push on hook

# Reporting
[backend]
api_url = "http://backend:3001"
api_key = "***"
node_id = "auto-generate"
```

---

## Limitations & Trade-offs

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| **WildDuck no metrics** | Must aggregate from API | Time-series aggregation in DB |
| **Zone-MTA /metrics gzip** | Scrape may fail | Disable plugin; use direct metrics |
| **Haraka plugin latency** | May impact mail flow | Async event push; benchmark needed |
| **Real-time vs batch** | Some data delay | Event-driven for critical; batch for stats |
| **Plugin version coupling** | Breaking changes risk | Pin versions; test compatibility matrix |

---

## Next Steps (For Planner)

1. **Phase 1 — Foundation**
   - Zone-MTA metrics scraping (Prometheus parser)
   - System metrics collection (systeminformation wrapper)
   - TimescaleDB hypertable design

2. **Phase 2 — Email Events**
   - Zone-MTA custom plugin development
   - Haraka custom plugin development
   - Email event streaming + storage

3. **Phase 3 — Aggregation**
   - WildDuck REST API querying
   - TimescaleDB continuous aggregates
   - User/mailbox stats computation

4. **Phase 4 — Monitoring**
   - Alert rule evaluation (BullMQ jobs)
   - Dashboard metric queries
   - Real-time WebSocket updates

---

## References

**Full Research Report:** `/Users/binhtino/tinomail-monitor/plans/reports/researcher-260211-2138-wildduck-metrics-collection.md`

**Key Sources:**
- [Zone-MTA Plugins](https://github.com/zone-eu/zone-mta/blob/master/plugins/README.md)
- [Haraka Plugin System](https://haraka.github.io/core/Plugins/)
- [WildDuck API](https://docs.wildduck.email/docs/wildduck-api/wildduck-api)
- [Systeminformation Package](https://systeminformation.io/)
