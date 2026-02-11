# WildDuck Ecosystem Metrics & Email Events Research Report
**Date:** 2026-02-11
**Status:** Complete Research Findings

---

## Executive Summary

Researched 7 core WildDuck ecosystem repositories to understand metrics collection, event hooks, and monitoring integration points. **Key Finding:** Each component exposes monitoring differently—ZoneMTA has Prometheus metrics, WildDuck relies on REST API for data retrieval (no built-in metrics endpoint), and Haraka provides hooks for custom event capture. Building a monitoring agent requires multi-source data collection (HTTP APIs + hook subscriptions + system-level metrics).

---

## 1. Zone-MTA (Outbound SMTP)

**Repository:** https://github.com/zone-eu/zone-mta
**Focus:** HTTP API, plugin system, queue monitoring

### Key Findings

#### HTTP API Endpoints
- `/send` — POST JSON messages for delivery
- `/send-raw` — POST raw RFC822 messages
- `/counter/zone/{zoneName}` — Get active/deferred counts per zone
- `/counter/zone/` — Counters across all zones
- `/queued/active/{zoneName}` — List first 1000 queued messages
- `/queued/deferred/{zoneName}` — List deferred messages
- `/message/{queueId}` — Detailed message status + recipient delivery states

#### Prometheus Metrics Endpoint
- **Endpoint:** `http://localhost:12080/metrics`
- **Metrics Exposed:**
  - `zonemta_delivery_status` — Counter with labels: `result="delivered"` (MX accepted), `result="rejected"` (hard bounce), `result="deferred"` (soft bounce)
  - `zonemta_message_push` — Counter of messages accepted for delivery
  - `zonemta_message_drop` — Counter of rejected messages (spam, plugin rejection, DB failure)
  - `zonemta_queue_size` — Gauge with `type="queued"` label (current queue size)

**⚠️ Known Issue:** Metrics endpoint requires async/await and works poorly with Restify gzip plugin enabled.

#### Plugin System Architecture
- **Hook Model:** Inherited from Nodemailer (not Haraka-style)
- **Key Hooks Available:**
  - `sender:fetch` — Modify delivery properties, zone assignment, HTTP config
  - `sender:connect` — Before MX connection attempt
  - `sender:connected` — After connection established
  - `sender:delivered` — After message accepted by MX
  - `smtp:auth` — Authentication hook
  - `log:entry` — Called for all message events
  - `queue:bounce` — When message bounced and dequeued

**Implication:** Can intercept sender delivery lifecycle but limited post-delivery event hooks.

#### Config Format
- Configuration files in `/config` directory
- Default SMTP port: 2525 (localhost)
- MongoDB & Redis required (specific config via `/config` files)
- Plugin loading via config files (e.g., `config/plugins/example.toml`)

### Monitoring Capability
✅ **Strong** — Prometheus metrics + REST queue API + plugin hooks for custom events

---

## 2. Zone-MTA Template

**Repository:** https://github.com/zone-eu/zone-mta-template
**Focus:** Default configuration, plugin structure, deployment setup

### Key Findings

#### Default Configuration Structure
- All config in `/config` directory
- View merged config: `npm run config`
- Default SMTP: Port 2525 (localhost)
- Prometheus metrics: Port 12080 at `/metrics`

#### Plugin Architecture
- Plugins stored in `/plugins` directory
- Example auth plugin demonstrates custom logic
- Plugins enabled/disabled via config files (`.toml` format)
- Supports SMTP authentication plugins

#### Dependencies
- MongoDB (core)
- Redis (core)
- Config-driven setup (no hardcoded values)

### Monitoring Capability
✅ **Moderate** — Relies on base Zone-MTA metrics + plugin extensibility

---

## 3. ZoneMTA-WildDuck Plugin

**Repository:** https://github.com/zone-eu/zonemta-wildduck
**Focus:** WildDuck integration, authentication, event capture

### Key Findings

#### Integration Points
- Validates SMTP credentials against WildDuck users
- Enforces From: addresses to registered aliases
- Routes sent messages to user mailboxes (Sent folder)
- Rate limiting: recipient counts within 24h
- LMTP delivery for local messages

#### Event Capture
- Operates at authentication layer (SMTP interfaces requiring auth)
- Integrates with `sender:fetch` hook for delivery routing
- Appends sent messages to user mailboxes (custom event handling)

#### Configuration
- Config via `.toml` (similar to Zone-MTA template)
- Requires WildDuck MongoDB connection
- Plugin loads as part of Zone-MTA's plugin chain

**⚠️ Limitation:** Limited documentation on specific monitoring hooks beyond authentication.

### Monitoring Capability
🟡 **Weak** — Primarily auth/routing; minimal metrics exposure

---

## 4. Haraka-Plugin-WildDuck (Inbound SMTP)

**Repository:** https://github.com/zone-eu/haraka-plugin-wildduck
**Focus:** Inbound email processing, recipient validation, storage

### Key Findings

#### Inbound Email Processing
- Recipient validation: Normalizes addresses + validates against WildDuck users table
- Quota checking: Rejects if user quota exceeded
- Message storage: Stores in MongoDB
- SPF/DKIM verification: Built-in (Haraka's SPF/DKIM plugins should be disabled)
- Rspamd integration: Routes spam-flagged messages to Junk folder

#### Positioning
- **Must be last plugin in plugins file** — only delivery plugin active
- No other delivery plugins should be enabled
- Acts as sole delivery mechanism for Haraka

#### Hook Integration
- Integrates with Haraka's standard plugin hooks
- Process hooks for message validation/storage
- Uses Haraka's queue mechanism

**⚠️ Limitation:** Public documentation sparse on specific hook names; requires source code review.

### Monitoring Capability
🟡 **Weak** — No built-in metrics; custom hooks needed

---

## 5. Haraka Email Server (Core)

**Repository:** https://github.com/haraka/Haraka
**Focus:** Plugin hooks, mail flow events

### Key Findings

#### Plugin Architecture
- Lightweight SMTP core + plugin-driven functionality
- ~All functionality built as plugins
- Mail cannot be received without 'rcpt' + 'queue' plugins
- Plugins: JS files in `/plugins` (legacy) or npm modules in `node_modules`

#### Available Hooks
- `hook_helo` / `hook_ehlo` — SMTP greeting (ESMTP extensions: STARTTLS, AUTH, SIZE)
- `hook_rcpt` — Recipient validation
- `hook_queue` — Message queueing
- Delivery hooks: `delivered`, `send_email`, `pre_send_trans_email`
- Custom hooks can be registered

#### Hook Ordering
- Determined by SMTP protocol order
- `register()` function (synchronous) enables hooks

#### Documentation
- Comprehensive in `docs/Plugins.md` (GitHub)
- Official docs: https://haraka.github.io/core/Plugins/

### Monitoring Capability
✅ **Strong** — Extensive hook system allows custom event capture at all mail flow stages

---

## 6. WildDuck (Mail Server)

**Repository:** https://github.com/zone-eu/wildduck
**Focus:** IMAP/POP3 server, API, mailbox management

### Key Findings

#### API Capabilities
- **REST API for all functionality** — No config file modifications needed
- **Endpoints Available:**
  - Users management
  - Mailbox operations
  - Message handling
  - Addresses configuration
  - Authentication & security
  - Email filters, autoreplies, archive
  - Domain config (DKIM, aliases)
  - Submission, audit, webhooks, storage

#### Authentication
- Access token via `X-Access-Token` header
- JWT-based auth (inferred from API design)

#### Built-in Metrics
❌ **None** — GitHub issue #89 requested mailbox statistics (hourly/daily/monthly message counts) but not implemented

#### Health Checks
- General endpoints available (Utility category mentions "Health status checks")
- Specific endpoint not detailed in public docs

#### Storage Stats
- API endpoints for Users + Mailboxes exist
- Can query user/mailbox info but no aggregated stats endpoint
- Must aggregate client-side from individual queries

#### Database
- MongoDB backend (distributed, sharded + replicated)
- Production-tested: 100,000+ accounts

**⚠️ Key Finding:** Must build metrics aggregation layer—WildDuck doesn't expose pre-computed stats.

### Monitoring Capability
🟡 **Weak** — Data available via REST API but requires custom aggregation logic

---

## 7. Haraka-Plugin-Rspamd (Spam Detection)

**Repository:** https://github.com/zone-eu/haraka-plugin-rspamd
**Focus:** Spam scanning integration, score capture

### Key Findings

#### Integration
- Connects to Rspamd instance (TCP `localhost:11333` or Unix socket)
- Submits messages for analysis
- Processes spam assessment

#### Captured Metrics
- **Numeric score** — `header.score` config option
- **Visual spam level** — `header.bar` (custom +/- characters)
- **Symbol details** — `header.report` (matched symbols + scores)

#### Filtering Configuration
- `check.authenticated` — Scan authenticated senders?
- `check.relay` — Scan relay messages?
- `check.private_ip` — Scan private IP sources?
- `check.local_ip` — Scan local IP sources?

#### Hook Integration
- Integrates at message handling layer
- Processes Rspamd action recommendations:
  - Reject spam
  - Soft reject (deferred)
  - Header manipulation (add/remove via `rmilter_headers`)
  - DKIM signing
  - Subject rewriting

### Monitoring Capability
✅ **Strong** — Spam scores + symbols available; selective scanning config

---

## 8. WildDuck-ZoneMTA-Zilter (Message Filtering)

**Repository:** https://github.com/zone-eu/wildduck-zonemta-zilter
**Focus:** Message filtering service integration

### Key Findings

#### Purpose
- Third-party filtering service integration
- Operates as receiver plugin (inbound)

#### Configuration
- **Zilter credentials:** username + API key
- **Server identification:** hostname or IP (for intra-domain detection)
- **Logging:** Optional callback logging (`logIncomingData` flag)
- **Log integration:** Gelf (general-purpose logging framework)

#### Known Limitation
- ❌ Rejects intra-domain emails if mail domain == VPS domain
- **Workaround:** Use different domain or configure serverHost as IP

#### Monitoring Hooks
❌ **Minimal** — Only optional logging; no metrics exposure

### Monitoring Capability
🟡 **Weak** — External service; limited built-in monitoring

---

## Systeminformation Node.js Package

**Reference:** https://systeminformation.io/
**Relevance:** Agent-level metrics collection

### Key Capabilities
- **50+ functions** for system info retrieval
- **Supported platforms:** Linux, macOS, Windows (partial), FreeBSD, OpenBSD, NetBSD, SunOS, Android
- **Zero dependencies**
- **Metrics available:**
  - CPU: manufacturer, brand, speed, cores, physical cores, usage
  - Memory: RAM, usage percentage
  - Disk: filesystem info, usage
  - Network: interfaces, I/O
- **API:** Promise-based (v3+) + async/await (Node 7.6+)
- **Maturity:** 19,000+ lines code, 700+ versions, 15M downloads/month

**Implication:** Perfect for agent-side system metrics collection alongside application-level metrics.

---

## Integration Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring Dashboard                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐  ┌─────▼──────┐ ┌────▼─────┐
   │ Zone-MTA│  │  WildDuck  │ │  Haraka  │
   │          │  │   (IMAP)   │ │ (inbound)│
   └────┬────┘  └─────┬──────┘ └────┬─────┘
        │             │              │
        │         REST API       Plugin Hooks
        │             │              │
        └──┬──────────┬──────────────┘
           │          │
      Prometheus   Custom HTTP
      /metrics     aggregation
```

---

## Data Collection Strategy

### Zone-MTA Metrics
1. **Prometheus scrape:** `GET http://{zonemta}:12080/metrics`
2. **Queue API:** `GET http://{zonemta}:3000/counter/zone/` (realtime counts)
3. **Message details:** `GET http://{zonemta}:3000/message/{queueId}` (on demand)
4. **Plugin hooks:** Custom plugin to capture `sender:delivered`, `queue:bounce` events

### WildDuck Metrics (Inbound)
1. **User stats:** `GET http://{wildduck}:3000/users` (paginated, requires aggregation)
2. **Per-user quotas:** `GET http://{wildduck}:3000/users/{userId}` (user storage used)
3. **No built-in stats** — Must calculate from raw API data
4. **Haraka integration:** Custom Haraka plugin hooks for inbound message events
5. **Rspamd scores:** Haraka-rspamd plugin exposes via headers

### System Metrics (All Nodes)
1. **Agent process:** Use `systeminformation` package
   - CPU load, memory %, disk usage
   - Network interface stats
   - Process memory (agent process itself)

### Email Event Stream (Haraka Hooks)
1. **Inbound:** `hook_queue` → message acceptance
2. **Acceptance:** `hook_deliver_* ` → delivery status
3. **Spam:** Rspamd symbols + scores from headers
4. **Bounce:** Custom bounce handling plugin

---

## Challenges & Workarounds

| Challenge | Workaround |
|-----------|-----------|
| **WildDuck no metrics endpoint** | Build aggregation layer querying REST API on schedule |
| **Zone-MTA /metrics gzip issue** | Disable Restify gzip plugin or use separate metrics listener |
| **Haraka sparse docs** | Review source code in `/lib` directory; use plugin registration for custom hooks |
| **Zilter is external** | Monitor via HTTP health checks + log aggregation |
| **Rspamd not direct access** | Capture via Haraka plugin + header manipulation |
| **No real-time mailbox stats** | Implement time-series aggregation in TimescaleDB (continuous aggregates) |

---

## Plugin Hook Deployment Strategy

### Zone-MTA Custom Plugin
```
plugins/zone-mta-monitor.js
├── Register hooks: sender:fetch, sender:delivered, queue:bounce, log:entry
├── Emit events to Redis pub/sub
├── Store metrics to TimescaleDB
└── No core modifications needed
```

### Haraka Custom Plugin
```
plugins/haraka-monitor.js
├── Register hooks: hook_rcpt, hook_queue, hook_delivered
├── Capture spam scores from Rspamd headers
├── Track inbound message lifecycle
└── Push metrics to backend API
```

---

## Key Takeaways

1. **Zone-MTA:** Excellent Prometheus metrics + REST API for queue. Plugin system allows custom event capture. ✅
2. **WildDuck:** REST API available but no metrics endpoint. Must build aggregation layer. 🟡
3. **Haraka:** Rich hook system but sparse documentation. Source code review required. 🟡
4. **Rspamd:** Integrated via Haraka plugin; scores available via headers. ✅
5. **System Level:** `systeminformation` library perfect for agent-side metrics. ✅
6. **Data Model:** Time-series (15s intervals) for system metrics; event-driven for mail events (immediate push).

---

## Unresolved Questions

1. **WildDuck real-time mailbox stats:** Exact REST endpoint for per-user message count (if exists)?
2. **Zone-MTA event broadcasting:** Can custom plugin emit to external systems (Redis, HTTP) without blocking?
3. **Haraka plugin hook execution order:** How to ensure monitoring plugin runs with minimal latency?
4. **Rspamd score distribution:** Are spam scores normally distributed? What thresholds for alerting?
5. **Email event deduplication:** How to prevent double-counting in distributed queue scenarios?

---

## Sources

- [Zone-MTA GitHub](https://github.com/zone-eu/zone-mta)
- [Zone-MTA Plugin Documentation](https://github.com/zone-eu/zone-mta/blob/master/plugins/README.md)
- [Zone-MTA Wiki - Plugins](https://github.com/zone-eu/zone-mta/wiki/Plugins)
- [Zone-MTA Metrics Issue #291](https://github.com/zone-eu/zone-mta/issues/291)
- [Zone-MTA Template](https://github.com/zone-eu/zone-mta-template)
- [ZoneMTA-WildDuck Plugin](https://github.com/zone-eu/zonemta-wildduck)
- [Haraka-Plugin-WildDuck](https://github.com/zone-eu/haraka-plugin-wildduck)
- [WildDuck Mail Server](https://github.com/zone-eu/wildduck)
- [WildDuck API Documentation](https://docs.wildduck.email/docs/wildduck-api/wildduck-api)
- [Haraka Documentation](https://haraka.github.io/core/Plugins/)
- [Haraka GitHub](https://github.com/haraka/Haraka)
- [Haraka-Plugin-Rspamd](https://github.com/zone-eu/haraka-plugin-rspamd)
- [WildDuck-ZoneMTA-Zilter](https://github.com/zone-eu/wildduck-zonemta-zilter)
- [Systeminformation Package](https://systeminformation.io/)
- [Systeminformation NPM](https://www.npmjs.com/package/systeminformation)
