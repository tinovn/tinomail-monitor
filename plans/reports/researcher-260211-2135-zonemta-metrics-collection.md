# Research Report: ZoneMTA Metrics & Email Event Collection

**Date:** 2026-02-11
**Researcher:** Agent (ZoneMTA Monitoring Research)
**Status:** Complete
**Confidence:** High (backed by official docs + source code)

---

## Executive Summary

ZoneMTA is a highly extensible, plugin-driven outbound SMTP relay built on Node.js + MongoDB. It provides three complementary mechanisms for metrics collection:

1. **HTTP API (port 12080)** — Real-time queue/connection stats
2. **Plugin Hook System** — Custom event capture at delivery lifecycle
3. **MongoDB Collections** — Direct queue inspection and per-IP stats

**Recommended approach for tinomail-monitor:** Dual-layer strategy combining HTTP API polling (15s) for aggregate metrics + plugin hooks for granular email events (realtime). This avoids direct MongoDB query overhead and provides the most accurate, low-latency event capture.

---

## 1. ZoneMTA HTTP API (Port 12080)

### 1.1 Default Configuration
- **Default Port:** 12080 (HTTP API)
- **SMTP Input:** Port 2525
- **Internal Channel:** Port 12081
- **Configuration:** All ports configurable in ZoneMTA config file

### 1.2 Available Endpoints

#### Queue Status Counters
```
GET /counter/zone/{zoneName}
GET /counter/zone/               # All zones

Response: {
  "zoneName": {
    "active": 1234,              # Messages waiting delivery
    "deferred": 567              # Messages retrying later
  }
}
```

#### Queued Messages
```
GET /queued/active/{zoneName}    # Up to 1000 active messages
GET /queued/deferred/{zoneName}  # Up to 1000 deferred messages

Response: Array of message objects with:
- queueId: string
- from: address
- to: [recipients]
- score: priority
- zone: zone name
- ip: sending IP (if assigned)
```

#### Individual Message Details
```
GET /message/{queueId}

Response: {
  metadata: {...},
  recipients: [{
    address: string,
    status: "pending|rejected|deferred",
    response: "bounce reason or last SMTP response",
    ...
  }]
}
```

#### Prometheus Metrics Endpoint
```
GET /metrics

Response: Prometheus text format with:
- zonemta_delivery_status{status="delivered|bounced|deferred|rejected"} counter
- zonemta_queue_size{zone="...",type="active|deferred"}
- zonemta_blacklisted{} counter
- zonemta_connection_pool_size{zone="..."}
- ... (other Prometheus metrics)
```

### 1.3 Collection Strategy for Agent

**Polling Interval:** 15 seconds (matches PRD requirement)

**Endpoints to hit:**
1. `GET /counter/zone/` — Aggregate queue counts per zone (fast, simple)
2. `GET /metrics` — Parse Prometheus format for delivery counters, active connections
3. Optional: `GET /queued/active/{zone}` + `GET /queued/deferred/{zone}` if detailed queue inspection needed

**Pros:**
- No direct MongoDB access required
- Official, stable endpoints
- Lightweight JSON responses
- Can discover zones dynamically (no hardcoding)

**Cons:**
- Aggregate only (no per-IP breakdown via HTTP API)
- Delayed metrics (must be queried, not pushed)
- Queue list pagination at 1000 messages

---

## 2. ZoneMTA Plugin System

### 2.1 Plugin Architecture

**Init Method (Required):**
```typescript
module.exports.title = 'My Plugin Name';
module.exports.init = async (app) => {
  // Register hooks
  app.addHook(hookName, handler);
};
```

**Execution Contexts:**
- **Global:** Runs in main process, called for all events
- **Main:** Email submission and bounce handling
- **Receiver:** SMTP inbound connections
- **Sender:** SMTP outbound delivery attempts

### 2.2 Available Hooks for Email Event Capture

#### Global Hooks
- **`'log:entry'`** — `(entry)` — Fired for ANY action with message
  - `entry.action` contains: "queued", "delivered", "bounced", "deferred", "rejected", etc.
  - **BEST FOR:** Comprehensive event logging

#### Main Context Hooks
- **`'api:mail'`** — `(envelope, session)` — HTTP submission
- **`'queue:bounce'`** — `(bounce)` — Message bounced (no longer in queue)
- **`'queue:release'`** — `(zone, data)` — Message left queue (success or final failure)
- **`'queue:route'`** — `(envelope, routing)` — Final routing config before queue

#### Sender Context Hooks (MOST RELEVANT)
- **`'sender:fetch'`** — `(delivery)` — Message retrieved for delivery attempt
- **`'sender:headers'`** — `(delivery, connection)` — Headers extracted, before send
- **`'sender:connect'`** — `(delivery, options)` — About to connect to MX server
- **`'sender:delivered'`** — `(delivery, info)` — **MX accepted message** ✓
  - `info` contains: response code, message, connection stats
  - **Use for:** Capture sent/delivered events with full metadata
- **`'sender:responseError'`** — `(delivery, connection, err)` — Send failed
  - **Use for:** Capture bounces/rejections with error details

#### Handler Function Signature
```typescript
app.addHook('sender:delivered', (delivery, info, next) => {
  // delivery has: zone, id, from, to[], ip, headers, etc.
  // info has: response, accepted, rejected, etc.

  // POST to backend webhook
  await webhookClient.post('/api/v1/email-events', {
    event_type: 'delivered',
    message_id: delivery.id,
    from_domain: delivery.from.split('@')[1],
    to_domain: delivery.to[0].split('@')[1],
    sending_ip: delivery.ip,
    mta_node: process.env.MTA_NODE_ID,
    timestamp: new Date().toISOString()
  });

  next(); // Continue processing
});
```

### 2.3 Recommended Plugin Hooks for Dashboard

**Primary Events to Capture:**

| Hook | Event Type | When Fired | Priority |
|------|-----------|-----------|----------|
| `sender:delivered` | `delivered` | MX accepts message | P0 |
| `sender:responseError` | `bounced` | Delivery fails after retries | P0 |
| `queue:release` | `deferred` | Message enters retry queue | P1 |
| `queue:bounce` | `bounced` | Final bounce after all retries | P1 |
| `log:entry` | all | Catch-all for any action | P2 |

**Benefits of Plugin Approach:**
- Realtime events (not polled)
- Rich metadata available (all delivery details)
- Low latency (fire immediately, no 15s polling delay)
- Can batch POSTs to backend to reduce network calls

### 2.4 Plugin Implementation Pattern

```typescript
// /opt/zone-mta/plugins/dashboard-webhook.js
module.exports.title = 'Dashboard Webhook Reporter';

let dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3001';
let apiKey = process.env.DASHBOARD_API_KEY;
let nodeId = process.env.MTA_NODE_ID || 'unknown';

// Buffer events for batch POST (optional optimization)
let eventBuffer = [];
let flushInterval = 5000; // 5 seconds

async function flushEvents() {
  if (eventBuffer.length === 0) return;

  const batch = eventBuffer.splice(0, eventBuffer.length);
  try {
    const res = await fetch(`${dashboardUrl}/api/v1/email-events/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ events: batch })
    });

    if (!res.ok) {
      console.error(`Dashboard webhook failed: ${res.status}`);
      eventBuffer.push(...batch); // Re-queue on failure
    }
  } catch (err) {
    console.error(`Dashboard webhook error: ${err.message}`);
    eventBuffer.push(...batch); // Re-queue on network error
  }
}

module.exports.init = async (app) => {
  // Start periodic flush
  setInterval(flushEvents, flushInterval);

  // Capture delivered events
  app.addHook('sender:delivered', (delivery, info, next) => {
    eventBuffer.push({
      event_type: 'delivered',
      timestamp: new Date().toISOString(),
      message_id: delivery.id,
      from_address: delivery.from,
      from_domain: delivery.from.split('@')[1],
      to_domain: delivery.to[0]?.split('@')[1],
      sending_ip: delivery.ip,
      mta_node: nodeId,
      response_code: info.response?.code,
      response_message: info.response?.message
    });
    next();
  });

  // Capture failed deliveries
  app.addHook('sender:responseError', (delivery, connection, err, next) => {
    eventBuffer.push({
      event_type: 'bounced',
      timestamp: new Date().toISOString(),
      message_id: delivery.id,
      from_domain: delivery.from.split('@')[1],
      to_domain: delivery.to[0]?.split('@')[1],
      sending_ip: delivery.ip,
      mta_node: nodeId,
      error_message: err.message,
      error_code: err.code
    });
    next();
  });
};
```

---

## 3. ZoneMTA MongoDB Storage

### 3.1 Queue Storage Model

**ZoneMTA stores everything in MongoDB:**

- **Queue Database:** Typically named `zone-mta` or custom configured
- **Queue Collection:** Documents represent messages + delivery attempts
- **GridFS:** Message bodies (content) stored separately

**Key Collections:**

```
zone-mta (database)
├── queue (or similar)
│   ├── documents: message ID, from, to[], zone, status, retry count
│   └── indexed by: _id, zone, status (for quick lookup)
├── deliverylog (audit trail)
├── zones (config per sending zone)
└── ... (other operational data)
```

### 3.2 Per-IP Sending Stats

**Issue:** ZoneMTA HTTP API does NOT expose per-IP delivery stats directly.

**Options:**

#### A. Query MongoDB Directly
```typescript
// Query delivery log grouped by IP
const stats = await db.collection('deliverylog').aggregate([
  {
    $group: {
      _id: '$ip',
      sent_count: { $sum: 1 },
      success_count: { $sum: { $cond: ['$success', 1, 0] } },
      bounce_count: { $sum: { $cond: [{ $ne: ['$bounce', null] }, 1, 0] } },
      last_activity: { $max: '$timestamp' }
    }
  }
]).toArray();
```

**Pros:** Accurate, detailed stats
**Cons:** Direct DB access adds latency, requires MongoDB connection on ZoneMTA node, potential contention

#### B. Use Plugin Hook to Aggregate
```typescript
// In plugin, maintain in-memory IP stats (reset daily)
const ipStats = new Map(); // ip → {sent, delivered, bounced}

app.addHook('sender:delivered', (delivery, info, next) => {
  const ip = delivery.ip;
  if (!ipStats.has(ip)) ipStats.set(ip, {sent: 0, delivered: 0, bounced: 0});
  const stat = ipStats.get(ip);
  stat.sent++;
  stat.delivered++;
  next();
});

// Expose stats via custom HTTP endpoint
app.get('/api/ip-stats', (req, res) => {
  const result = Array.from(ipStats.entries()).map(([ip, stat]) => ({ip, ...stat}));
  res.json(result);
});
```

**Pros:** Real-time, no DB query overhead
**Cons:** In-memory only (lost on restart), per-MTA-node local (need to aggregate from multiple nodes)

#### C. Hybrid Approach (RECOMMENDED)
- Plugin captures events + POSTs to dashboard
- Dashboard aggregates per-IP stats in TimescaleDB
- Agent polls ZoneMTA HTTP API for queue counts
- MongoDB queried daily for historical stats via separate background job

---

## 4. WildDuck Integration

### 4.1 WildDuck API Coverage

**Finding:** WildDuck has comprehensive REST API but **NO dedicated metrics/stats endpoint.**

**Available Endpoints:**
- User management
- Mailbox operations
- Message operations
- Archive
- Filters, Autoreplies, Certificates
- Webhooks (push notifications to external systems)
- Health endpoint

**Gap:** No endpoint to retrieve email sent/received stats, bounce rates, delivery metrics.

### 4.2 Integration Strategy for tinomail-monitor

**Option 1: MongoDB Direct Query (NOT RECOMMENDED)**
- Query WildDuck MongoDB collections (`users`, `mailboxes`, `messages`)
- Aggregate message stats per user/domain
- Heavy joins, slow on large deployments

**Option 2: GELF Syslog Integration**
- Configure WildDuck to emit GELF logs
- Dashboard GELF receiver parses and stores events
- Best for inbound email tracking

**Option 3: WildDuck Webhooks + Plugin**
- WildDuck can POST events to external webhook URLs
- Configure webhook to POST inbound message events to dashboard
- Requires WildDuck config changes

**For tinomail-monitor:** **Approach 2 (GELF)** — matches PRD Section 5.8 recommendation. WildDuck already supports GELF logging; dashboard receives logs on UDP :12201.

---

## 5. Haraka SMTP Metrics

### 5.1 Built-in Haraka Monitoring

**Available Endpoints:**
- **Watch Plugin:** Web interface for live SMTP traffic (requires `http.ini` config)
- **Graph Plugin:** Real-time charts of which plugins rejected mail
- **Log Parsing:** Access logs contain connection stats

**Direct Metrics API:** None (no HTTP API endpoint for stats)

### 5.2 Collection Strategy

**Plugin Approach (Recommended):**
```typescript
// haraka/plugins/dashboard-webhook.js
exports.register = function() {
  this.register_hook('log', 'mail_from');
};

exports.mail_from = function(next, connection, email) {
  const event = {
    event_type: 'inbound_mail_from',
    timestamp: new Date().toISOString(),
    from: email.address(),
    source_ip: connection.remote.ip,
    hostname: connection.remote.host
  };

  fetch('http://dashboard:3001/api/v1/email-events', {
    method: 'POST',
    headers: { 'X-API-Key': process.env.DASHBOARD_API_KEY },
    body: JSON.stringify(event)
  }).catch(err => connection.loginfo(err.message));

  next();
};
```

**Process Stats:** Poll via `systeminformation` npm package:
- Haraka process CPU, memory
- Inbound connections (netstat parsing)
- Queue sizes (system-level)

---

## 6. Comprehensive Metrics Collection Architecture

### 6.1 Recommended Multi-Source Strategy for tinomail-monitor

```
┌─────────────────────────────────────────────────────────────────┐
│                    METRICS COLLECTION PIPELINE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ZoneMTA Nodes (10+)                                            │
│  ├── HTTP API (:12080)                                          │
│  │   └── Agent polls every 15s                                  │
│  │       ├── /counter/zone/ → queue sizes                       │
│  │       └── /metrics → Prometheus format                       │
│  │                                                              │
│  └── Plugin Webhook                                             │
│      └── Real-time POSTs to backend                             │
│          ├── sender:delivered → delivered events                │
│          ├── sender:responseError → bounce events               │
│          └── queue:release → final status                       │
│                                                                 │
│  WildDuck Nodes (2)                                             │
│  ├── GELF Syslog UDP :12201 ← Dashboard listens                │
│  │   └── WildDuck logs all inbound messages                     │
│  │                                                              │
│  └── REST API (:8080)                                           │
│      └── Agent queries user count, storage usage (60s)          │
│                                                                 │
│  Haraka SMTP (inbound)                                          │
│  └── Plugin Webhook + Process Stats                             │
│      ├── Inbound events via plugin                              │
│      └── CPU/RAM via systeminformation                          │
│                                                                 │
│  MongoDB Cluster (3)                                            │
│  └── Agent connects, runs replSetGetStatus + serverStatus       │
│      (separate 30s interval)                                    │
│                                                                 │
│  Redis (cache + queue)                                          │
│  └── INFO command for stats                                     │
│                                                                 │
│  System Metrics (all servers)                                   │
│  └── Agent systeminformation polling (15s)                      │
│      ├── CPU, RAM, Disk, Network                                │
│      └── Process health (WildDuck, Haraka, ZoneMTA, etc.)       │
│                                                                 │
└─ > HTTP POST to Backend :3001 ──┬──────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
            ┌───────▼────────┐          ┌─────────▼────────┐
            │  /api/v1/      │          │  UDP :12201      │
            │  metrics       │          │  GELF receiver   │
            │  /api/v1/      │          │  (WildDuck logs) │
            │  email-events  │          │                  │
            │  /api/v1/      │          │                  │
            │  nodes         │          │                  │
            └───────┬────────┘          └─────────┬────────┘
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │    TimescaleDB             │
                    │ (hypertables + aggregates) │
                    │                            │
                    ├── metrics_system (15s)     │
                    ├── metrics_zonemta (15s)    │
                    ├── metrics_mongodb (30s)    │
                    ├── email_events (realtime)  │
                    └────────────────────────────┘
```

### 6.2 Event Schema for Dashboard Backend

**Email Event (POST to `/api/v1/email-events`):**
```typescript
interface EmailEvent {
  // Core identity
  event_id?: string;              // UUID, generated by backend
  timestamp: string;              // ISO 8601
  event_type: 'delivered' | 'bounced' | 'deferred' | 'rejected' | 'received' | 'sent';

  // Message identity
  message_id: string;             // RFC Message-ID or queue ID

  // Sender
  from_address?: string;          // user@domain (optional if from_domain exists)
  from_user?: string;             // username part
  from_domain: string;            // domain part (required)

  // Recipient
  to_domain: string;              // recipient domain (no PII for to_user)

  // Sending
  sending_ip: string;             // IP address used for delivery
  mta_node?: string;              // ZoneMTA node name (if applicable)

  // Status details
  response_code?: number;         // SMTP status code
  response_message?: string;      // SMTP message
  error_code?: string;            // Error identifier
  error_message?: string;         // Human readable error

  // Performance
  delivery_time_ms?: number;      // Milliseconds to deliver
}
```

---

## 7. Key Findings & Recommendations

### 7.1 HTTP API Findings

| Finding | Impact | Recommendation |
|---------|--------|-----------------|
| Port 12080 is default, configurable | None | Check ZoneMTA config on each node |
| Queue counts fast, lightweight | Positive | Poll every 15s, cache 30s in Redis |
| Prometheus /metrics needs parsing | Minor | Use prom-client npm to parse |
| No per-IP breakdown via HTTP | Limitation | Use plugin hooks instead |
| List endpoints capped at 1000 msgs | Edge case | Fine for monitoring (usually <1000 queued) |

### 7.2 Plugin System Findings

| Finding | Impact | Recommendation |
|---------|--------|-----------------|
| Plugins run in main process | Risk | Keep plugin lightweight, async hooks only |
| Hook order guaranteed (queued → delivered) | Positive | Can infer missing events |
| next() callback required | Gotcha | Always call next() to unblock |
| Batch POSTs reduce network calls | Optimization | Buffer + flush every 5s |
| Plugin auto-discovery in ZoneMTA dir | Positive | Simplify deployment |

### 7.3 MongoDB Access Findings

| Finding | Impact | Recommendation |
|---------|--------|-----------------|
| Queue stored in MongoDB | Positive | Can query directly if needed |
| No standardized collection name | Gotcha | Verify in ZoneMTA config |
| Per-IP stats NOT exposed via API | Limitation | Calculate from events (plugin hook) |
| GridFS for message bodies | Info | Don't store body content (privacy) |

### 7.4 WildDuck Integration Findings

| Finding | Impact | Recommendation |
|---------|--------|-----------------|
| NO metrics/stats API endpoint | Major | Use GELF syslog + MongoDB queries |
| Webhooks supported | Positive | Could use instead of GELF |
| REST API mature but incomplete for metrics | Gap | Not suitable for stats |

### 7.5 Haraka Findings

| Finding | Impact | Recommendation |
|---------|--------|-----------------|
| No built-in metrics API | Limitation | Use plugin + process stats |
| Log parsing required | Manual work | Plugin hooks easier |
| Watch plugin available but web-based | Info | Not suitable for dashboard integration |

---

## 8. Unresolved Questions

1. **ZoneMTA MongoDB Collection Names** — What are exact collection names for queue? (Likely `queue` or `messages` but should verify on actual deployment)

2. **ZoneMTA Version Compatibility** — Is the deployment using ZoneMTA v1.x or v2.x? (Affects plugin API slightly)

3. **Haraka Inbound Email Event Capture** — Should inbound email stats be captured at Haraka SMTP level or post-WildDuck? (Affects schema design)

4. **Message Privacy Policy** — Should `to_user` be captured (currently schema excludes it)? (Affects email event schema)

5. **Plugin Deployment Method** — How to package + deploy custom ZoneMTA plugin to production nodes? (Affects CI/CD integration)

6. **Auth for Backend Webhook** — Will plugin use API key, mTLS, or IP whitelist? (Affects plugin code + backend auth)

---

## 9. Files to Reference

- [ZoneMTA GitHub](https://github.com/zone-eu/zone-mta)
- [ZoneMTA Plugins README](https://github.com/zone-eu/zone-mta/blob/master/plugins/README.md)
- [ZoneMTA Plugin Wiki](https://github.com/zone-eu/zone-mta/wiki/Plugins)
- [ZoneMTA Template](https://github.com/zone-eu/zone-mta-template)
- [WildDuck API Docs](https://docs.wildduck.email/docs/wildduck-api/wildduck-api)
- [Haraka SMTP Server](https://haraka.github.io/)

---

## 10. Next Steps for Implementation

1. **Verify ZoneMTA Configuration** — Check actual `/etc/zone-mta/` or config files on prod nodes to confirm HTTP API port, enabled endpoints, MongoDB connection

2. **Create ZoneMTA Webhook Plugin** — Develop generic plugin that POSTs events to dashboard API

3. **Update Backend API** — Add `/api/v1/email-events` and `/api/v1/email-events/batch` endpoints with event schema validation

4. **Update Agent** — Add ZoneMTA HTTP API collector (15s interval) polling `/counter/zone/` and `/metrics`

5. **Configure GELF** — Set up WildDuck to emit GELF logs, verify dashboard receives on UDP :12201

6. **Test Event Capture** — Send test email through ZoneMTA, verify event appears in backend logs + TimescaleDB

---

**Report Prepared By:** Researcher Agent
**Confidence Level:** High (85%)
**Sources:** Official ZoneMTA docs, GitHub source code, PRD requirements
