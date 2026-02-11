# WILDDUCK MAIL MONITORING DASHBOARD
# Product Requirements Document (PRD)
## Tài liệu yêu cầu phát triển hệ thống giám sát chuyên dụng

**Phiên bản:** 1.0
**Ngày:** 2026-02-11
**Ngôn ngữ tài liệu:** Tiếng Việt

---

## MỤC LỤC

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Hạ tầng hiện tại & Hướng mở rộng](#2-hạ-tầng-hiện-tại)
3. [Tech Stack đề xuất](#3-tech-stack)
4. [Kiến trúc hệ thống Dashboard](#4-kiến-trúc)
5. [Nguồn dữ liệu & Thu thập metrics](#5-nguồn-dữ-liệu)
6. [Database Schema](#6-database-schema)
7. [Module 1 — Overview Dashboard](#7-overview)
8. [Module 2 — Server & Hardware Monitoring](#8-server-hardware)
9. [Module 3 — Email Flow (Inbound/Outbound)](#9-email-flow)
10. [Module 4 — ZoneMTA Outbound Cluster & IP Management](#10-zonemta-outbound)
11. [Module 5 — Domain Quality & Reputation](#11-domain-quality)
12. [Module 6 — User Analytics](#12-user-analytics)
13. [Module 7 — Destination Analysis](#13-destination)
14. [Module 8 — Spam & Security](#14-spam-security)
15. [Module 9 — Log Viewer & Message Tracing](#15-log-viewer)
16. [Module 10 — IP Reputation & Blacklist Monitor](#16-ip-reputation)
17. [Module 11 — Alerting System](#17-alerting)
18. [Module 12 — Reports & Export](#18-reports)
19. [Module 13 — Admin & Configuration](#19-admin)
20. [API Design](#20-api)
21. [UI/UX Requirements](#21-ui-ux)
22. [Non-functional Requirements](#22-non-functional)
23. [Deployment & DevOps](#23-deployment)
24. [Phân pha phát triển](#24-phases)
25. [Glossary](#25-glossary)

---

## 1. TỔNG QUAN DỰ ÁN

### 1.1 Mục tiêu

Xây dựng hệ thống dashboard giám sát **chuyên dụng** (custom-built) cho WildDuck Mail Infrastructure. Dashboard tự build, **KHÔNG dùng** Grafana, Prometheus, hoặc bất kỳ monitoring tool có sẵn nào. Lý do: cần giao diện tối ưu riêng cho mail system, tích hợp sâu với WildDuck API/MongoDB, và kiểm soát hoàn toàn UX.

### 1.2 Phạm vi

Giám sát **TOÀN BỘ** hệ thống email:

- **Phần cứng:** CPU, RAM, Disk, Network của mọi server
- **Phần mềm:** WildDuck, Haraka, ZoneMTA, Rspamd, MongoDB, Redis — process health, performance
- **Email flow:** Inbound/Outbound — số lượng, tốc độ, thời gian gửi, trạng thái delivery
- **Per-dimension analytics:** Theo từng máy chủ, từng user, từng domain gửi, từng domain đích
- **Chất lượng thư:** Bounce rate, spam score, DKIM/SPF/DMARC pass rate, reputation
- **IP management:** Trạng thái hàng trăm IP (IPv4 /24 + IPv6), blacklist check, warmup tracking
- **Log tập trung:** Tìm kiếm, lọc, tracing message flow xuyên suốt hệ thống
- **Alerting:** Cảnh báo realtime qua Telegram/Slack/Email/Webhook

### 1.3 Người dùng

| Vai trò | Nhu cầu chính |
|---------|---------------|
| **SysAdmin / DevOps** | Giám sát server health, xử lý sự cố nhanh |
| **Mail Admin / Postmaster** | Quản lý IP reputation, deliverability, xử lý blacklist |
| **Operations Manager** | Xem tổng quan, báo cáo, xu hướng |
| **Developer** | Truy vấn logs, debug email flow, API integration |

---

## 2. HẠ TẦNG HIỆN TẠI & HƯỚNG MỞ RỘNG

### 2.1 Hạ tầng đang chạy

```
┌─────────────────────────────────────────────────────────────┐
│                    WILDDUCK INFRASTRUCTURE                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─── MongoDB Cluster (3 nodes) ───┐                        │
│  │ mongo-01 (PRIMARY)               │                        │
│  │ mongo-02 (SECONDARY)             │                        │
│  │ mongo-03 (SECONDARY)             │                        │
│  └──────────────────────────────────┘                        │
│                                                              │
│  ┌─── WildDuck Cluster (2 nodes) ──┐                        │
│  │ wd-01: WildDuck + Haraka +       │                        │
│  │        ZoneMTA(local) + Rspamd   │                        │
│  │        + Redis                    │                        │
│  │ wd-02: (mirror)                   │                        │
│  └──────────────────────────────────┘                        │
│                                                              │
│  ┌─── ZoneMTA Outbound (10 nodes) ─┐                        │
│  │ mta-01 → mta-10                   │                        │
│  │ Mỗi node: dedicated sending       │                        │
│  │ IP riêng biệt                     │                        │
│  └──────────────────────────────────┘                        │
│                                                              │
│  Tổng: 15 servers                                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Hướng mở rộng (QUAN TRỌNG — ảnh hưởng thiết kế)

Dashboard PHẢI hỗ trợ mở rộng linh hoạt:

- **Thêm ZoneMTA nodes:** Từ 10 có thể lên 20, 50, 100+ nodes
- **Mỗi node MTA mới có thể có:**
  - 1 dải IPv4 /24 (tối đa 254 IPs usable)
  - 1 hoặc nhiều dải IPv6
- **Tổng IP có thể lên tới hàng nghìn** → dashboard phải handle được
- **Thêm MongoDB shards** khi data lớn
- **Thêm WildDuck instances** cho horizontal scaling

**Yêu cầu thiết kế:**
- Node discovery / registration động (không hardcode danh sách)
- Data model cho IP phải flat, searchable, aggregatable
- UI phải hỗ trợ phân trang, lọc, tìm kiếm khi có 1000+ IPs
- Charts/tables phải performant với N nodes lớn

---

## 3. TECH STACK ĐỀ XUẤT

### 3.1 Backend

| Layer | Công nghệ | Lý do chọn |
|-------|-----------|-------------|
| **Runtime** | Node.js (v20 LTS) | Cùng ecosystem với WildDuck, share code/libs |
| **Web Framework** | Fastify hoặc NestJS | Fastify: nhanh, nhẹ; NestJS: cấu trúc rõ ràng cho team lớn |
| **Database (metrics)** | TimescaleDB (PostgreSQL extension) | Time-series data tối ưu, SQL quen thuộc, compression tốt, retention policies tự động |
| **Database (config/users)** | PostgreSQL (cùng instance TimescaleDB) | Relational data: users, nodes, alerts, settings |
| **Cache / Realtime** | Redis | Caching metrics nóng, pub/sub cho realtime updates |
| **Task Queue** | BullMQ (Redis-based) | Scheduled jobs: health check, blacklist scan, report generation |
| **WebSocket** | Socket.IO hoặc ws | Push realtime metrics/alerts đến browser |

**Tại sao TimescaleDB mà không phải InfluxDB/ClickHouse:**
- TimescaleDB = PostgreSQL + hypertable → dev team chỉ cần biết SQL
- Compression ratio 90-95% cho time-series data
- Continuous aggregates (auto rollup 1m → 5m → 1h → 1d)
- Retention policies tự động xóa data cũ
- JOIN được với bảng relational (nodes, users, domains)
- Mature, production-proven, docs tốt

### 3.2 Frontend

| Layer | Công nghệ | Lý do |
|-------|-----------|-------|
| **Framework** | React 18+ hoặc Vue 3 | Component-based, ecosystem lớn |
| **UI Library** | shadcn/ui hoặc Ant Design | Component sẵn cho dashboard: tables, charts, forms |
| **Charts** | Apache ECharts hoặc Recharts | ECharts mạnh hơn cho heatmap, geo; Recharts đơn giản hơn |
| **State** | Zustand hoặc Pinia (Vue) | Nhẹ, đơn giản |
| **Realtime** | Socket.IO client | Nhận push updates |
| **Data Tables** | TanStack Table (React Table v8) | Virtual scroll cho bảng lớn (1000+ rows IPs) |
| **Date handling** | date-fns hoặc dayjs | Timezone-aware |

### 3.3 Data Collection (Agent)

| Thành phần | Công nghệ | Deploy đâu |
|-----------|-----------|------------|
| **System metrics agent** | Custom Node.js agent (dùng `systeminformation` npm) | Trên MỖI server (15+ nodes) |
| **WildDuck metrics** | Gọi trực tiếp WildDuck REST API | Từ dashboard backend |
| **MongoDB metrics** | Gọi `db.serverStatus()`, `rs.status()` | Từ dashboard backend |
| **Redis metrics** | Gọi `INFO` command | Từ dashboard backend |
| **ZoneMTA metrics** | Gọi ZoneMTA HTTP API (:12080) | Từ dashboard backend |
| **Rspamd metrics** | Gọi Rspamd HTTP API (:11334/stat) | Từ dashboard backend |
| **Email event logs** | Hook vào WildDuck/Haraka/ZoneMTA GELF hoặc đọc từ MongoDB messagelog | Pipeline vào TimescaleDB |
| **DNSBL checker** | Custom DNS lookup module | Chạy trên dashboard server |

### 3.4 Infrastructure cho Dashboard

```
┌────────────────────────────────────┐
│     MONITORING SERVER              │
│     8 vCPU, 32GB RAM, 1TB SSD     │
│                                     │
│  ┌─ Dashboard App ──────────────┐  │
│  │ Node.js Backend (Fastify)     │  │
│  │ React Frontend (Nginx)        │  │
│  │ WebSocket Server              │  │
│  │ BullMQ Workers                │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌─ Data Layer ─────────────────┐  │
│  │ TimescaleDB (PostgreSQL 16)   │  │
│  │ Redis 7                       │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌─ Agents (on each mail node) ─┐  │
│  │ wildduck-monitor-agent        │  │
│  │ (lightweight, ~20MB RAM)      │  │
│  └───────────────────────────────┘  │
└────────────────────────────────────┘
```

---

## 4. KIẾN TRÚC HỆ THỐNG

### 4.1 Data Flow Architecture

```
                    ┌──────────────┐
                    │  Browser UI  │
                    │  (React)     │
                    └──────┬───────┘
                           │ HTTP + WebSocket
                    ┌──────▼───────┐
                    │   API Server │
                    │  (Fastify)   │
                    └──┬───┬───┬───┘
                       │   │   │
          ┌────────────┘   │   └────────────┐
          ▼                ▼                ▼
   ┌─────────────┐ ┌─────────────┐  ┌─────────────┐
   │ TimescaleDB  │ │    Redis    │  │  BullMQ     │
   │ (metrics +   │ │ (cache +    │  │ (scheduled  │
   │  logs +      │ │  realtime   │  │  jobs)      │
   │  config)     │ │  pub/sub)   │  │             │
   └─────────────┘ └─────────────┘  └──────┬──────┘
                                           │
                    ┌──────────────────────┘
                    │ Scheduled Tasks:
                    │ • Collect metrics (15s)
                    │ • DNSBL check (5min)
                    │ • Aggregate rollups (1min)
                    │ • Report generation (daily)
                    │ • Alert evaluation (30s)
                    ▼
   ┌─────────────────────────────────────────────┐
   │              DATA SOURCES                    │
   ├──────────┬──────────┬───────────┬───────────┤
   │ Agents   │ WildDuck │ ZoneMTA   │ MongoDB   │
   │ (on each │ REST API │ HTTP API  │ driver    │
   │ node)    │ (:8080)  │ (:12080)  │ (:27017)  │
   ├──────────┼──────────┼───────────┼───────────┤
   │ Rspamd   │ Redis    │ GELF/Log  │ DNS       │
   │ HTTP API │ INFO     │ stream    │ (DNSBL)   │
   │ (:11334) │ (:6379)  │ (:12201)  │           │
   └──────────┴──────────┴───────────┴───────────┘
```

### 4.2 Agent Architecture

Mỗi mail server cài 1 **lightweight agent** (Node.js process):

```javascript
// Agent gửi metrics về dashboard server mỗi 15 giây
{
  "node_id": "mta-03",
  "timestamp": "2026-02-11T10:30:15Z",
  "system": {
    "cpu_percent": 45.2,
    "ram_used_percent": 62.8,
    "ram_used_bytes": 6742000000,
    "disk_used_percent": 38.5,
    "disk_free_bytes": 320000000000,
    "load_avg": [2.1, 1.8, 1.5],
    "network": {
      "rx_bytes_per_sec": 52400000,
      "tx_bytes_per_sec": 184000000,
      "rx_errors": 0,
      "tx_errors": 0
    },
    "uptime_seconds": 2592000
  },
  "processes": {
    "zonemta": { "status": "running", "pid": 1234, "memory_mb": 180, "cpu_percent": 12.3 },
    "wildduck": { "status": "running", "pid": 5678, "memory_mb": 250, "cpu_percent": 8.1 },
    "haraka": { "status": "running", "pid": 9012, "memory_mb": 120, "cpu_percent": 5.2 },
    "rspamd": { "status": "running", "pid": 3456, "memory_mb": 400, "cpu_percent": 15.7 },
    "redis": { "status": "running", "pid": 7890, "memory_mb": 95, "cpu_percent": 2.1 }
  },
  "services": {
    "smtp_25": true,
    "smtp_587": true,
    "imap_993": true,
    "pop3_995": true
  }
}
```

**Agent communication:**
- Agent push metrics qua HTTP POST đến dashboard API
- Hoặc dùng gRPC stream cho hiệu quả hơn
- Fallback: Dashboard pull metrics từ agent qua HTTP GET
- Agent tự đăng ký khi khởi động (auto-discovery)

---

## 5. NGUỒN DỮ LIỆU & THU THẬP

### 5.1 System Metrics (từ Agent)

Thu thập **mỗi 15 giây** từ tất cả nodes:

| Metric | Nguồn | Cách lấy |
|--------|-------|----------|
| CPU usage (total, per-core) | /proc/stat hoặc `os.cpus()` | Agent |
| RAM (total, used, available, cached) | /proc/meminfo | Agent |
| Disk (usage, I/O read/write, IOPS) | /proc/diskstats, statvfs | Agent |
| Network (rx/tx bytes, packets, errors, per-interface) | /proc/net/dev | Agent |
| Load average (1m, 5m, 15m) | os.loadavg() | Agent |
| Process list (status, PID, CPU, RAM cho mỗi service) | /proc/[pid]/* | Agent |
| Open file descriptors | /proc/sys/fs/file-nr | Agent |
| TCP connections (ESTABLISHED, TIME_WAIT, CLOSE_WAIT) | /proc/net/tcp | Agent |
| Uptime | /proc/uptime | Agent |

### 5.2 MongoDB Metrics

Thu thập **mỗi 30 giây** bằng cách kết nối trực tiếp MongoDB driver:

| Metric | Command |
|--------|---------|
| Replica set status (role, lag, optime) | `rs.status()` |
| Server status (connections, ops/sec, memory) | `db.serverStatus()` |
| Database sizes (data, indexes, storage) | `db.stats()` cho wildduck, wildduck-attachments |
| Collection stats | `db.collection.stats()` cho users, mailboxes, messages |
| Current operations | `db.currentOp()` |
| Replication oplog window | Tính từ oplog.rs timestamps |
| Slow queries | Profile level 1 hoặc đọc slow query log |

### 5.3 Redis Metrics

Thu thập **mỗi 30 giây:**

| Metric | Command |
|--------|---------|
| Memory (used, peak, fragmentation) | `INFO memory` |
| Connected clients | `INFO clients` |
| Keys per database | `INFO keyspace` |
| Hit/miss ratio | `INFO stats` → keyspace_hits / keyspace_misses |
| Commands processed per sec | `INFO stats` → instantaneous_ops_per_sec |
| Evicted keys | `INFO stats` → evicted_keys |

### 5.4 ZoneMTA Metrics

Thu thập **mỗi 15 giây** từ ZoneMTA HTTP API (:12080):

| Metric | Endpoint / Cách lấy |
|--------|---------------------|
| Queue size (total, per-zone) | GET /api/queued |
| Active deliveries | GET /api/active |
| Delivery counters (success, bounce, deferred, rejected) | GET /metrics (Prometheus format) → parse |
| Throughput (messages/sec) | Tính từ counters |
| Connection pool status | GET /api/connections |
| Per-IP sending stats | Từ ZoneMTA MongoDB collection hoặc hook |

### 5.5 WildDuck Metrics

Thu thập **mỗi 60 giây** từ WildDuck REST API (:8080):

| Metric | Endpoint |
|--------|----------|
| Total users | GET /users?limit=1 (đọc total từ response) |
| Total messages, storage used | Aggregate từ MongoDB users collection |
| IMAP connections | Từ agent process stats |
| API request rate | Access log parsing hoặc middleware counter |
| Authentication events | MongoDB audit log hoặc GELF |

### 5.6 Haraka Metrics

| Metric | Nguồn |
|--------|-------|
| Inbound connections/sec | Haraka log parsing hoặc plugin hook |
| Messages received/sec | Haraka plugin counter |
| Rejected (spam, invalid recipient, rate-limit) | Haraka + Rspamd kết hợp |
| Connection sources (top IPs, countries) | Haraka connection log |

### 5.7 Rspamd Metrics

Thu thập **mỗi 30 giây** từ Rspamd HTTP API (:11334):

| Metric | Endpoint |
|--------|----------|
| Messages scanned, ham, spam, greylist | GET /stat |
| Action breakdown (no action, add header, reject, greylist) | GET /stat |
| Top spam symbols/signatures | GET /stat |
| Fuzzy hash stats | GET /stat |
| Learning stats (ham learned, spam learned) | GET /stat |

### 5.8 Email Event Stream

**CỰC KỲ QUAN TRỌNG** — đây là nguồn chính cho email analytics:

Mọi email event (sent, delivered, bounced, deferred, rejected) phải được capture và lưu vào TimescaleDB. Có 3 cách:

**Cách 1 — GELF receiver (Khuyến nghị):**
Dashboard chạy GELF UDP listener (:12201), nhận logs từ WildDuck/Haraka/ZoneMTA → parse → insert TimescaleDB.

**Cách 2 — ZoneMTA plugin hook:**
Viết ZoneMTA plugin custom gửi delivery events qua HTTP POST đến dashboard API.

**Cách 3 — MongoDB change stream:**
Watch MongoDB collections (zone-mta database) cho delivery log changes.

**Event schema cần capture:**

```javascript
{
  "event_id": "uuid",
  "timestamp": "2026-02-11T10:30:15.123Z",
  "event_type": "delivered|bounced|deferred|rejected|received|sent",

  // Message identity
  "message_id": "<abc@domain.com>",       // RFC Message-ID
  "queue_id": "zone-mta-queue-id",

  // Sender info
  "from_address": "user@company.vn",
  "from_user": "user",
  "from_domain": "company.vn",
  "sender_ip": "103.21.58.15",            // IP gửi ra ngoài

  // Recipient info
  "to_address": "recipient@gmail.com",
  "to_domain": "gmail.com",

  // Routing info
  "mta_node": "mta-03",                   // Node ZoneMTA nào xử lý
  "sending_ip": "103.21.58.15",           // IP nào gửi
  "sending_ip_v6": "2001:db8:3::15",      // IPv6 nếu có
  "mx_host": "alt1.gmail-smtp-in.l.google.com",

  // Delivery details
  "status_code": 250,                      // SMTP response code
  "status_message": "2.0.0 OK",
  "delivery_time_ms": 1250,                // Thời gian từ lúc bắt đầu gửi đến nhận response
  "queue_time_ms": 340,                    // Thời gian nằm trong queue
  "total_time_ms": 1590,

  // Bounce details (nếu bounced)
  "bounce_type": "hard|soft",
  "bounce_category": "user_unknown|mailbox_full|policy|spam|other",
  "bounce_message": "550 5.1.1 The email account does not exist",

  // Message metadata
  "message_size_bytes": 15234,
  "has_attachment": true,
  "attachment_count": 2,
  "subject_hash": "sha256-first-8-chars",  // Không lưu subject gốc vì privacy

  // Authentication results
  "dkim_result": "pass|fail|none",
  "spf_result": "pass|fail|softfail|none",
  "dmarc_result": "pass|fail|none",

  // Spam info (inbound)
  "spam_score": 3.2,
  "spam_action": "no_action|add_header|reject|greylist",
  "spam_symbols": ["DKIM_SIGNED", "SPF_ALLOW", "BAYES_HAM"]
}
```

### 5.9 DNSBL Check Data

Thu thập **mỗi 5 phút** cho tất cả sending IPs:

| Data | Chi tiết |
|------|----------|
| IP address | Mỗi IP trong pool |
| DNSBL name | 25+ blacklists (Spamhaus, Barracuda, SpamCop, ...) |
| Listed status | true/false |
| Check timestamp | Khi nào check lần cuối |
| Response code | DNSBL trả về gì (127.0.0.x codes có ý nghĩa khác nhau) |

---

## 6. DATABASE SCHEMA (TimescaleDB)

### 6.1 Hypertables (Time-series, auto-partitioned)

```sql
-- System metrics — 15s interval, retain 90 ngày raw, 1 năm aggregated
CREATE TABLE metrics_system (
  time        TIMESTAMPTZ NOT NULL,
  node_id     TEXT NOT NULL,         -- 'mta-01', 'wd-01', 'mongo-01'
  node_role   TEXT NOT NULL,         -- 'zonemta', 'wildduck', 'mongodb'
  cpu_percent DOUBLE PRECISION,
  ram_percent DOUBLE PRECISION,
  ram_used_bytes BIGINT,
  disk_percent DOUBLE PRECISION,
  disk_free_bytes BIGINT,
  disk_read_bytes_sec BIGINT,
  disk_write_bytes_sec BIGINT,
  net_rx_bytes_sec BIGINT,
  net_tx_bytes_sec BIGINT,
  net_rx_errors BIGINT,
  net_tx_errors BIGINT,
  load_1m     DOUBLE PRECISION,
  load_5m     DOUBLE PRECISION,
  load_15m    DOUBLE PRECISION,
  tcp_established INTEGER,
  tcp_time_wait INTEGER,
  open_files  INTEGER
);
SELECT create_hypertable('metrics_system', 'time');
CREATE INDEX idx_metrics_system_node ON metrics_system (node_id, time DESC);

-- MongoDB metrics — 30s interval
CREATE TABLE metrics_mongodb (
  time        TIMESTAMPTZ NOT NULL,
  node_id     TEXT NOT NULL,
  role        TEXT,                  -- 'PRIMARY', 'SECONDARY'
  connections_current INTEGER,
  connections_available INTEGER,
  ops_insert  BIGINT,
  ops_query   BIGINT,
  ops_update  BIGINT,
  ops_delete  BIGINT,
  ops_command BIGINT,
  repl_lag_seconds DOUBLE PRECISION,
  data_size_bytes BIGINT,
  index_size_bytes BIGINT,
  storage_size_bytes BIGINT,
  oplog_window_hours DOUBLE PRECISION,
  wt_cache_used_bytes BIGINT,
  wt_cache_max_bytes BIGINT
);
SELECT create_hypertable('metrics_mongodb', 'time');

-- Redis metrics — 30s interval
CREATE TABLE metrics_redis (
  time        TIMESTAMPTZ NOT NULL,
  node_id     TEXT NOT NULL,
  memory_used_bytes BIGINT,
  memory_max_bytes BIGINT,
  connected_clients INTEGER,
  ops_per_sec INTEGER,
  hit_rate    DOUBLE PRECISION,
  evicted_keys BIGINT,
  total_keys  INTEGER
);
SELECT create_hypertable('metrics_redis', 'time');

-- ZoneMTA metrics — 15s interval
CREATE TABLE metrics_zonemta (
  time        TIMESTAMPTZ NOT NULL,
  node_id     TEXT NOT NULL,
  mta_role    TEXT,                  -- 'local' | 'outbound'
  queue_size  INTEGER,
  active_deliveries INTEGER,
  sent_total  BIGINT,
  delivered_total BIGINT,
  bounced_total BIGINT,
  deferred_total BIGINT,
  rejected_total BIGINT,
  connections_active INTEGER,
  throughput_per_sec DOUBLE PRECISION
);
SELECT create_hypertable('metrics_zonemta', 'time');

-- ★ EMAIL EVENTS — Core data, mỗi email 1 row
CREATE TABLE email_events (
  time            TIMESTAMPTZ NOT NULL,
  event_type      TEXT NOT NULL,        -- 'delivered','bounced','deferred','rejected','received'
  message_id      TEXT,
  queue_id        TEXT,
  from_address    TEXT,
  from_user       TEXT,
  from_domain     TEXT,
  to_address      TEXT,
  to_domain       TEXT,
  mta_node        TEXT,
  sending_ip      INET,
  sending_ip_v6   INET,
  mx_host         TEXT,
  status_code     SMALLINT,
  status_message  TEXT,
  delivery_time_ms INTEGER,
  queue_time_ms   INTEGER,
  total_time_ms   INTEGER,
  bounce_type     TEXT,                 -- 'hard','soft'
  bounce_category TEXT,
  bounce_message  TEXT,
  message_size    INTEGER,
  dkim_result     TEXT,
  spf_result      TEXT,
  dmarc_result    TEXT,
  spam_score      DOUBLE PRECISION,
  spam_action     TEXT
);
SELECT create_hypertable('email_events', 'time');
CREATE INDEX idx_email_from_domain ON email_events (from_domain, time DESC);
CREATE INDEX idx_email_to_domain ON email_events (to_domain, time DESC);
CREATE INDEX idx_email_mta_node ON email_events (mta_node, time DESC);
CREATE INDEX idx_email_sending_ip ON email_events (sending_ip, time DESC);
CREATE INDEX idx_email_from_user ON email_events (from_user, from_domain, time DESC);
CREATE INDEX idx_email_event_type ON email_events (event_type, time DESC);
CREATE INDEX idx_email_message_id ON email_events (message_id, time DESC);

-- IP Blacklist checks — 5min interval
CREATE TABLE blacklist_checks (
  time        TIMESTAMPTZ NOT NULL,
  ip          INET NOT NULL,
  ip_version  SMALLINT,              -- 4 or 6
  node_id     TEXT,
  blacklist   TEXT NOT NULL,
  tier        TEXT,                  -- 'critical','high','medium'
  listed      BOOLEAN NOT NULL,
  response    TEXT,
  check_duration_ms INTEGER
);
SELECT create_hypertable('blacklist_checks', 'time');
CREATE INDEX idx_bl_ip ON blacklist_checks (ip, time DESC);

-- Rspamd metrics — 30s interval
CREATE TABLE metrics_rspamd (
  time            TIMESTAMPTZ NOT NULL,
  node_id         TEXT NOT NULL,
  scanned         BIGINT,
  ham             BIGINT,
  spam            BIGINT,
  greylist        BIGINT,
  rejected        BIGINT,
  learned_ham     BIGINT,
  learned_spam    BIGINT
);
SELECT create_hypertable('metrics_rspamd', 'time');
```

### 6.2 Regular Tables (config, relational)

```sql
-- Node registry — tự đăng ký khi agent khởi động
CREATE TABLE nodes (
  id          TEXT PRIMARY KEY,       -- 'mta-01'
  hostname    TEXT,
  ip_address  INET,
  role        TEXT NOT NULL,          -- 'zonemta-outbound','wildduck','mongodb'
  status      TEXT DEFAULT 'active',  -- 'active','stopped','maintenance'
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen   TIMESTAMPTZ,
  metadata    JSONB                   -- Thêm info tùy ý: OS version, RAM total, etc.
);

-- Sending IPs registry — mỗi IP 1 row
CREATE TABLE sending_ips (
  ip              INET PRIMARY KEY,
  ip_version      SMALLINT NOT NULL,  -- 4 hoặc 6
  node_id         TEXT REFERENCES nodes(id),
  subnet          CIDR,               -- '103.21.58.0/24'
  ptr_record      TEXT,               -- 'mail-03.example.com'
  status          TEXT DEFAULT 'active', -- 'active','warming','paused','blacklisted','retired'
  warmup_start    DATE,
  warmup_day      INTEGER DEFAULT 0,
  daily_limit     INTEGER,             -- Giới hạn gửi/ngày khi warmup
  current_daily_sent INTEGER DEFAULT 0,
  blacklist_count INTEGER DEFAULT 0,
  reputation_score INTEGER DEFAULT 50, -- 0-100
  last_blacklist_check TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sending_ips_node ON sending_ips (node_id);
CREATE INDEX idx_sending_ips_status ON sending_ips (status);
CREATE INDEX idx_sending_ips_subnet ON sending_ips (subnet);

-- Sending domains
CREATE TABLE sending_domains (
  domain      TEXT PRIMARY KEY,
  dkim_configured BOOLEAN DEFAULT FALSE,
  spf_configured BOOLEAN DEFAULT FALSE,
  dmarc_configured BOOLEAN DEFAULT FALSE,
  dmarc_policy TEXT,                 -- 'none','quarantine','reject'
  status      TEXT DEFAULT 'active',
  daily_limit INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Alert rules
CREATE TABLE alert_rules (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  severity    TEXT NOT NULL,          -- 'critical','warning','info'
  condition   TEXT NOT NULL,          -- SQL condition hoặc expression
  threshold   DOUBLE PRECISION,
  duration    INTERVAL,              -- 'for' duration
  channels    TEXT[],                -- ['telegram','slack','email']
  enabled     BOOLEAN DEFAULT TRUE,
  cooldown    INTERVAL DEFAULT '30 minutes',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Alert history
CREATE TABLE alert_events (
  id          SERIAL PRIMARY KEY,
  rule_id     INTEGER REFERENCES alert_rules(id),
  severity    TEXT,
  status      TEXT,                  -- 'firing','resolved'
  message     TEXT,
  details     JSONB,
  node_id     TEXT,
  fired_at    TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  notified    BOOLEAN DEFAULT FALSE
);

-- Dashboard users & auth
CREATE TABLE dashboard_users (
  id          SERIAL PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT DEFAULT 'viewer',  -- 'admin','operator','viewer'
  telegram_id TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Saved views / custom dashboards
CREATE TABLE saved_views (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES dashboard_users(id),
  name        TEXT NOT NULL,
  config      JSONB NOT NULL,        -- Layout, filters, time range
  is_default  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.3 Continuous Aggregates (auto rollup)

```sql
-- Rollup email events per 5 phút, per domain gửi
CREATE MATERIALIZED VIEW email_stats_5m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', time) AS bucket,
  from_domain,
  mta_node,
  sending_ip,
  event_type,
  COUNT(*) AS event_count,
  AVG(delivery_time_ms) AS avg_delivery_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY delivery_time_ms) AS p95_delivery_ms,
  AVG(message_size) AS avg_message_size,
  SUM(CASE WHEN dkim_result = 'pass' THEN 1 ELSE 0 END) AS dkim_pass,
  SUM(CASE WHEN spf_result = 'pass' THEN 1 ELSE 0 END) AS spf_pass,
  SUM(CASE WHEN dmarc_result = 'pass' THEN 1 ELSE 0 END) AS dmarc_pass
FROM email_events
GROUP BY bucket, from_domain, mta_node, sending_ip, event_type;

-- Rollup per 1 giờ
CREATE MATERIALIZED VIEW email_stats_1h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  from_domain,
  to_domain,
  mta_node,
  event_type,
  COUNT(*) AS event_count,
  AVG(delivery_time_ms) AS avg_delivery_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY delivery_time_ms) AS p95_delivery_ms
FROM email_events
GROUP BY bucket, from_domain, to_domain, mta_node, event_type;

-- Rollup per ngày (cho reports)
CREATE MATERIALIZED VIEW email_stats_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS bucket,
  from_domain,
  from_user,
  to_domain,
  mta_node,
  sending_ip,
  event_type,
  COUNT(*) AS event_count,
  AVG(delivery_time_ms) AS avg_delivery_ms
FROM email_events
GROUP BY bucket, from_domain, from_user, to_domain, mta_node, sending_ip, event_type;

-- Retention policies
SELECT add_retention_policy('metrics_system', INTERVAL '90 days');
SELECT add_retention_policy('metrics_zonemta', INTERVAL '90 days');
SELECT add_retention_policy('email_events', INTERVAL '180 days');
SELECT add_retention_policy('blacklist_checks', INTERVAL '365 days');
-- Aggregated views giữ lâu hơn
SELECT add_retention_policy('email_stats_daily', INTERVAL '730 days');
```

---

## 7. MODULE 1 — OVERVIEW DASHBOARD

### Mục đích
Trang chủ hiển thị sức khỏe toàn bộ hệ thống trong 1 màn hình.

### 7.1 Status Bar (top)

| Widget | Dữ liệu | Visual |
|--------|----------|--------|
| Cluster Health | Tổng hợp: OK / WARNING / CRITICAL | Dot lớn xanh/vàng/đỏ |
| Active Nodes | X/Y nodes online | Badge số |
| Emails Sent (1h) | Tổng sent trong 1 giờ qua | Counter lớn |
| Delivered Rate | % delivered / total sent | Gauge |
| Bounce Rate | % bounced | Gauge (đỏ nếu >5%) |
| Queue Size | Tổng queue trên tất cả MTA | Counter (vàng nếu >10K) |
| Blacklisted IPs | Số IP bị blacklist / tổng IPs | Counter đỏ |
| Active Alerts | Số alerts đang firing | Badge đỏ |

### 7.2 Main Charts

| Chart | Loại | Dữ liệu |
|-------|------|----------|
| Email Throughput (24h) | Area chart | Emails/hour stacked: delivered, bounced, deferred |
| Bounce Rate Trend (24h) | Line chart | Bounce % over time, với threshold line tại 5% |
| MTA Node Health Map | Grid/Heatmap | Mỗi node 1 ô: xanh/vàng/đỏ dựa trên CPU+queue+blacklist |
| Top Sending Domains (24h) | Horizontal bar | Top 10 domains by volume |

### 7.3 Quick Status Panels

| Panel | Nội dung |
|-------|----------|
| MongoDB Cluster | 3 nodes: role, repl lag, disk%, ops/sec |
| WildDuck Nodes | 2 nodes: IMAP conns, API req/s, CPU |
| Recent Alerts | 5 alerts gần nhất, severity + message |
| Quick Actions | Links: "Disable IP", "View Logs", "Generate Report" |

### 7.4 Time Range Selector

Áp dụng toàn bộ dashboard:
- Preset: Last 1h, 6h, 24h, 7d, 30d
- Custom range picker
- Auto-refresh: 15s, 30s, 1m, 5m, off
- Timezone selector

---

## 8. MODULE 2 — SERVER & HARDWARE MONITORING

### Mục đích
Giám sát chi tiết phần cứng & OS của tất cả servers.

### 8.1 Server List View

Table hiển thị tất cả nodes:

| Cột | Dữ liệu |
|-----|----------|
| Status dot | 🟢 active / 🔴 down / 🟡 warning |
| Node ID | mta-01, wd-01, mongo-01 |
| Role | ZoneMTA Outbound, WildDuck, MongoDB |
| IP Address | 103.21.58.x |
| CPU | Progress bar + % |
| RAM | Progress bar + % |
| Disk | Progress bar + % |
| Network ↑↓ | Mbps in/out |
| Load Avg | 1m / 5m / 15m |
| Connections | TCP ESTABLISHED |
| Uptime | Days/hours |

Tính năng:
- Sort theo bất kỳ cột nào
- Filter theo role
- Click vào node → mở detail view
- Bulk select → xem comparison view

### 8.2 Server Detail View

Khi click vào 1 node, hiển thị:

**CPU:**
- Realtime line chart (per-core nếu cần)
- Historical: 1h, 6h, 24h, 7d
- Top processes by CPU

**RAM:**
- Used / Cached / Available pie chart
- Trend line
- Per-process memory table

**Disk:**
- Partition usage bars
- IOPS chart (read/write)
- Throughput chart (MB/s read/write)
- Disk growth prediction (linear extrapolation: bao lâu nữa hết disk?)

**Network:**
- Bandwidth chart (rx/tx Mbps)
- Packet rate
- Error rate
- Per-interface breakdown

**Process Manager:**
- List tất cả monitored processes (WildDuck, ZoneMTA, Haraka, Rspamd, Redis, MongoDB)
- Status, PID, CPU%, RAM MB, Uptime
- Nút restart process (qua agent, cần auth)

### 8.3 Comparison View

Chọn 2-5 nodes để so sánh song song:
- CPU overlay chart
- RAM overlay chart
- Network overlay chart
- Hữu ích khi debug: "tại sao mta-03 chậm hơn mta-07?"

### 8.4 Heatmap View

Grid visualization cho toàn bộ cluster:
- Rows = nodes, Columns = time buckets
- Color = metric intensity (CPU, RAM, hoặc custom)
- Nhanh chóng spot anomaly: "node nào nặng nhất lúc 3AM?"

---

## 9. MODULE 3 — EMAIL FLOW (INBOUND/OUTBOUND)

### Mục đích
Giám sát realtime luồng email vào/ra, bao nhiêu, tốc độ, trạng thái.

### 9.1 Realtime Flow Counter

Hiển thị lớn ở đầu trang:

```
INBOUND                          OUTBOUND
[  2,847/h  ] ← Received         [  12,456/h  ] → Sent
[  2,731/h  ] ← Delivered        [  11,890/h  ] → Delivered
[     84/h  ] ← Rejected (spam)  [     342/h  ] → Bounced
[     32/h  ] ← Greylisted       [     224/h  ] → Deferred
```

Mỗi số animate khi thay đổi (count-up animation).

### 9.2 Throughput Charts

| Chart | Mô tả |
|-------|-------|
| **Outbound throughput** | Stacked area: delivered (xanh), deferred (vàng), bounced (đỏ), rejected (đỏ đậm) — 24h |
| **Inbound throughput** | Stacked area: delivered (xanh), spam (tím), rejected (đỏ), greylisted (xám) — 24h |
| **Emails per second** | Realtime sparkline, last 5 minutes |
| **Outbound by MTA node** | Multi-line chart, mỗi node 1 line — phát hiện node nào bất thường |

### 9.3 Delivery Performance

| Metric | Visual |
|--------|--------|
| **Average delivery time** | Gauge: xanh <3s, vàng <10s, đỏ >10s |
| **P95 delivery time** | Gauge |
| **P99 delivery time** | Gauge |
| **Delivery time distribution** | Histogram: <1s, 1-3s, 3-10s, 10-30s, 30s-1m, 1m-5m, >5m |
| **Delivery time by destination** | Table: gmail.com=2.1s, outlook.com=3.5s, yahoo.com=5.2s |
| **Delivery time trend** | Line chart over 24h |

### 9.4 Queue Analysis

| Widget | Mô tả |
|--------|-------|
| **Total queue** | Big number + trend sparkline |
| **Queue per node** | Bar chart horizontal |
| **Queue age distribution** | <1m, 1-5m, 5-30m, 30m-1h, 1h-4h, 4h-24h, >24h |
| **Oldest message in queue** | Số + alert nếu >1h |
| **Deferred reasons** | Pie chart: rate-limited, MX unavailable, timeout, policy |

### 9.5 Message Size Distribution

- Histogram: <10KB, 10-100KB, 100KB-1MB, 1-5MB, 5-25MB, >25MB
- Average message size trend

---

## 10. MODULE 4 — ZONEMTA OUTBOUND CLUSTER & IP MANAGEMENT

### Mục đích
Quản lý & giám sát cluster gửi mail outbound. **MODULE QUAN TRỌNG NHẤT** vì ảnh hưởng trực tiếp deliverability.

### 10.1 Cluster Overview

**Node Grid:**
Hiển thị tất cả MTA nodes dạng card grid (responsive, auto-wrap khi thêm nodes):

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 🟢 mta-01    │ │ 🟢 mta-02    │ │ 🔴 mta-03    │
│ 103.21.58/24 │ │ 103.21.59/24 │ │ 103.21.60/24 │
│ 234 IPs      │ │ 250 IPs      │ │ 245 IPs      │
│ ────────────── │ │ ────────────── │ │ ────────────── │
│ Sent: 8.2K/h │ │ Sent: 7.8K/h │ │ Sent: 0/h    │
│ Bounce: 2.1% │ │ Bounce: 1.8% │ │ CPU: 0%      │
│ Queue: 234   │ │ Queue: 189   │ │ 🚨 3 BL      │
│ CPU: 45%     │ │ CPU: 42%     │ │ STATUS: DOWN │
└──────────────┘ └──────────────┘ └──────────────┘
                   ... (N nodes) ...
```

Mỗi card có:
- Status indicator (xanh/vàng/đỏ)
- IPv4 subnet + IPv6 subnet
- Active IPs / Total IPs
- Throughput (emails/h)
- Bounce rate
- Queue size
- Blacklisted IP count
- CPU %
- Click → drill down

### 10.2 Node Detail Page

Khi click vào 1 MTA node:

**Tab 1 — Performance:**
- Throughput chart (1h, 6h, 24h)
- Delivery status breakdown (pie)
- Queue trend
- CPU/RAM/Network

**Tab 2 — IP Address Table:**

| Cột | Mô tả |
|-----|-------|
| IP Address | 103.21.58.1 |
| Version | IPv4 / IPv6 |
| Status | 🟢 Active / 🟡 Warming / ⏸️ Paused / 🔴 Blacklisted |
| Sent (1h) | 200 |
| Sent (24h) | 4,500 |
| Bounce Rate | 1.2% |
| Blacklists | 0 hoặc "Spamhaus, SpamCop" |
| Warmup Day | Day 45 / 90 |
| Daily Limit | 5,000 |
| Daily Sent | 3,200 / 5,000 |
| Reputation Score | 85/100 (progress bar) |
| PTR Record | mail-01.example.com |
| Last Used | 2m ago |
| Actions | [Pause] [Check BL] [Details] |

**Tính năng IP table:**
- Virtual scroll (handle 254+ IPs per node)
- Multi-select → bulk pause/resume
- Filter by status
- Sort by any column
- Search by IP
- Export CSV

**Tab 3 — Destination Breakdown:**
Xem chất lượng gửi ĐẾN từng destination domain từ node này:

| Destination | Sent | Deliver % | Bounce % | Avg Time | Deferred |
|-------------|------|-----------|----------|----------|----------|
| gmail.com | 3,500 | 98.2% | 1.2% | 2.1s | 23 |
| outlook.com | 2,100 | 96.5% | 2.8% | 4.5s | 45 |
| yahoo.com | 1,200 | 94.1% | 4.2% | 8.3s | 78 |

### 10.3 IP Warmup Manager

**Khi thêm MTA node mới với /24 subnet, cần warmup dần:**

| Feature | Mô tả |
|---------|-------|
| Warmup schedule | Hiển thị lịch warmup: Day 1=50 emails, Day 7=500, Day 30=5K, Day 60=unlimited |
| Progress tracker | Mỗi IP: đang ở ngày bao nhiêu, daily limit hiện tại |
| Auto-scaling | Dashboard đề xuất tăng limit dựa trên bounce rate |
| Warmup groups | Chia IPs thành groups, warmup theo batch |
| Alerts | Cảnh báo nếu bounce rate cao trong khi warmup → dừng tăng limit |

### 10.4 IP Pool Management

| Feature | Mô tả |
|---------|-------|
| Add new node | Form: hostname, subnet, SSH key → tự đăng ký |
| Add IP range | Nhập subnet CIDR → tự tạo entries |
| Assign IPs to pools | Tạo "pool" (transactional, marketing, notification) → gán IPs vào |
| Round-robin config | Cấu hình cách ZoneMTA chọn IP gửi |
| Emergency disable | 1-click disable IP hoặc cả node |
| PTR management | Hiển thị PTR records, cảnh báo nếu thiếu/sai |

---

## 11. MODULE 5 — DOMAIN QUALITY & REPUTATION

### Mục đích
Đánh giá chất lượng gửi mail của TỪNG DOMAIN gửi.

### 11.1 Domain List

| Cột | Mô tả |
|-----|-------|
| Domain | company.vn |
| Status | Active / Paused / Blocked |
| Sent (24h) | 25,000 |
| Delivered % | 97.2% |
| Bounce % | 2.3% (đỏ nếu >5%) |
| Hard Bounce % | 0.8% |
| Soft Bounce % | 1.5% |
| Spam Reports | 3 |
| DKIM Pass % | 99.8% |
| SPF Pass % | 100% |
| DMARC Pass % | 98.5% |
| Avg Delivery Time | 3.2s |
| Reputation Score | 92/100 |
| Trend | ↑ hoặc ↓ so với hôm qua |

### 11.2 Domain Detail Page

Khi click domain:

**Authentication Health:**
- DKIM: pass rate trend (7d), cảnh báo nếu <99%
- SPF: pass rate, alignment
- DMARC: policy (none/quarantine/reject), pass rate
- DNS record checker: tự kiểm tra TXT records hiện tại, highlight nếu sai

**Delivery Quality:**
- Deliver/Bounce trend (7d)
- Bounce reasons breakdown (pie): user unknown, mailbox full, policy reject, spam reject, other
- Delivery time P50/P95/P99

**Per-destination analysis cho domain này:**
- gmail.com: 98% deliver, 1.5% bounce, avg 2.1s
- outlook.com: 96% deliver, 3.2% bounce, avg 4.5s
- (hiển thị tất cả destinations)

**Top senders trong domain:**
- Các users gửi nhiều nhất từ domain này
- Bounce rate per user

**Sending pattern:**
- Heatmap: thời gian gửi (giờ x ngày trong tuần)
- Volume trend (30 ngày)

### 11.3 Domain Health Score Algorithm

Tự tính điểm cho mỗi domain (0-100):

```
Score = 100
- (bounce_rate_24h > 5% ? 20 : bounce_rate * 3)
- (hard_bounce_rate > 2% ? 15 : 0)
- (dkim_pass < 99% ? 10 : 0)
- (spf_pass < 99% ? 10 : 0)
- (dmarc_pass < 95% ? 10 : 0)
- (spam_reports > 0 ? spam_reports * 5 : 0)
- (avg_delivery_time > 10s ? 10 : 0)
- (any_ip_blacklisted ? 15 : 0)
```

---

## 12. MODULE 6 — USER ANALYTICS

### Mục đích
Giám sát hoạt động gửi mail của TỪNG USER.

### 12.1 User List

| Cột | Mô tả |
|-----|-------|
| User | admin@company.vn |
| Domain | company.vn |
| Sent (24h) | 1,200 |
| Received (24h) | 340 |
| Bounce % | 3.1% |
| Spam Reports | 0 |
| Quota Used | 45% (2.3GB / 5GB) |
| Last Active | 5m ago |
| Risk Level | 🟢 Low / 🟡 Medium / 🔴 High |
| Actions | [View] [Limit] [Block] |

### 12.2 User Detail

- Send/receive trend (7d)
- Top destinations (domains đích user gửi đến nhiều nhất)
- Bounce rate per destination
- Login history (IPs, devices, timestamps)
- Quota usage trend
- Message size distribution

### 12.3 Abuse Detection

Tự động flag users có hành vi bất thường:

| Rule | Condition | Action |
|------|-----------|--------|
| Sudden volume spike | Gửi >10x so với 7-day average trong 1 giờ | Alert + optional auto-throttle |
| High bounce rate | >10% bounce liên tục trong 30 phút | Alert |
| Spam complaints | >3 spam reports trong 24h | Alert + flag user |
| Unusual destinations | Gửi đến >500 unique domains trong 1h | Alert (có thể account bị hack) |
| Sending at odd hours | Volume đột biến ngoài giờ làm việc | Info alert |

### 12.4 User Groups / Labels

- Tạo nhóm: "Marketing Team", "Transactional", "Newsletter"
- Xem aggregate stats per group
- Set rate limits per group

---

## 13. MODULE 7 — DESTINATION ANALYSIS

### Mục đích
Phân tích chất lượng gửi ĐẾN từng domain đích (Gmail, Outlook, Yahoo, ...).

### 13.1 Destination Domain Table

| Cột | Mô tả |
|-----|-------|
| Domain | gmail.com |
| Sent (24h) | 45,000 |
| Delivered % | 98.5% |
| Bounced % | 1.2% |
| Deferred | 145 |
| Blocked / Rejected | 12 |
| Avg Delivery Time | 2.1s |
| P95 Time | 4.5s |
| MX Hosts | alt1.gmail-smtp-in.l.google.com, ... |
| Trend | ↑ deliver rate improving |

### 13.2 Destination Detail

Khi click gmail.com:

**Delivery quality over time:**
- Deliver/bounce rate trend (7d, 30d)
- Delivery time trend
- Phát hiện: "Gmail bắt đầu defer nhiều từ 3PM hôm qua" → có thể bị rate limit

**Per-IP breakdown:**
- Xem chất lượng gửi đến gmail.com từ TỪNG sending IP
- Phát hiện IP nào bị Gmail reject

**Bounce reason analysis:**
- 550 User unknown: 45%
- 421 Try again later: 30%
- 550 Spam detected: 15%
- Other: 10%

**SMTP response code breakdown:**
- 250 (success), 421 (try later), 450 (mailbox busy), 550 (not found), 554 (spam)

**Best sending window:**
- Heatmap: giờ nào gửi đến Gmail tốt nhất (deliver rate cao, delay thấp)

### 13.3 MX Host Health

Theo dõi sức khỏe của MX servers đích:

| MX Host | Response Time | Success Rate | Last Error |
|---------|--------------|--------------|------------|
| alt1.gmail-smtp-in... | 1.2s | 99.1% | — |
| alt2.gmail-smtp-in... | 1.8s | 98.7% | 421 at 14:30 |

---

## 14. MODULE 8 — SPAM & SECURITY

### Mục đích
Giám sát Rspamd, authentication, brute-force, security events.

### 14.1 Rspamd Dashboard

| Widget | Dữ liệu |
|--------|----------|
| Messages scanned (1h) | Counter |
| Ham / Spam ratio | Pie chart |
| Action breakdown | Bar: no_action, add_header, reject, greylist |
| Spam trend (24h) | Line chart |
| Top spam symbols | Table: BAYES_SPAM (45%), DKIM_FAIL (20%), ... |
| Top spam sources (IP) | Table: source IPs gửi spam nhiều nhất |
| Learning stats | Ham learned vs Spam learned |
| False positive rate | Estimate dựa trên "not junk" actions |

### 14.2 Authentication Monitoring

| Widget | Dữ liệu |
|--------|----------|
| Auth success/fail (1h) | Counter + trend |
| Failed auth by IP | Top 20 IPs with most failures |
| Failed auth by user | Top accounts targeted |
| Fail2ban status | Banned IPs count, recent bans |
| Brute-force detection | Alert khi >10 failed auth từ 1 IP trong 5 phút |
| Geo-map | Bản đồ thế giới highlight nơi có auth attempts |

### 14.3 Outbound Spam Prevention

| Widget | Dữ liệu |
|--------|----------|
| Outbound spam score distribution | Histogram |
| High-score outbound emails | Table: user + subject_hash + score |
| Rate-limited users | Users đang bị throttle |
| Accounts with compromised indicators | Auto-detect: sending to many unique domains, high bounce, unusual patterns |

### 14.4 TLS & Certificate

| Widget | Dữ liệu |
|--------|----------|
| TLS connections % | Inbound + Outbound |
| Certificate expiry | Days until expiry, per domain |
| Cipher suites used | Distribution |
| TLS version distribution | TLS 1.2 vs 1.3 |

---

## 15. MODULE 9 — LOG VIEWER & MESSAGE TRACING

### Mục đích
Tìm kiếm, lọc logs, và trace 1 email xuyên suốt hệ thống.

### 15.1 Log Search

**Search bar nổi bật ở đầu trang** với các filter options:

| Filter | Loại | Ví dụ |
|--------|------|-------|
| Time range | Date picker | Last 1h, 6h, 24h, custom |
| Event type | Multi-select | delivered, bounced, deferred, rejected, received |
| From address | Text input | user@company.vn hoặc *@company.vn |
| To address | Text input | *@gmail.com |
| From domain | Dropdown | company.vn |
| To domain | Text input | gmail.com |
| MTA node | Multi-select | mta-01, mta-03 |
| Sending IP | Text input | 103.21.58.* |
| Message ID | Text input | <abc@domain.com> |
| Queue ID | Text input | zone-mta-id |
| Status code | Range | 400-599 |
| Bounce type | Select | hard, soft |
| Free text search | Text | "mailbox full" |

**Result table:**

| Time | Type | From | To | Node | IP | Status | Time | Size | Actions |
|------|------|------|----|------|----|--------|------|------|---------|
| 10:30:15 | ✅ delivered | user@co.vn | a@gmail.com | mta-03 | 103.21.60.15 | 250 OK | 1.2s | 15KB | [Trace] |
| 10:30:14 | ❌ bounced | news@co.vn | b@yahoo.com | mta-07 | 103.21.64.22 | 550 | 0.8s | 8KB | [Trace] |

**Tính năng:**
- Infinite scroll / virtual scroll (handle millions of rows)
- Export results (CSV, JSON)
- Save search as bookmark
- Share search URL
- Syntax highlighting cho SMTP responses

### 15.2 Message Tracing

Click [Trace] trên 1 email → hiển thị **toàn bộ lifecycle** của email đó:

```
Message-ID: <abc123@company.vn>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[10:30:10.123] 📤 SUBMITTED
  User: marketing@company.vn
  Client IP: 192.168.1.100
  Via: SMTP submission (wd-01:587)
  Size: 15,234 bytes
  Subject hash: a1b2c3d4

[10:30:10.234] ⚙️ QUEUED
  Queue ID: q-abc123
  Node: wd-01 (local ZoneMTA)
  → Routed to: mta-03 (outbound pool)

[10:30:10.456] 📝 DKIM SIGNED
  Selector: default._domainkey.company.vn
  Result: signed successfully

[10:30:10.567] 🔄 TRANSFERRED
  From: wd-01 → mta-03
  Sending IP selected: 103.21.60.15

[10:30:11.234] 📡 DELIVERY ATTEMPT #1
  Target MX: alt1.gmail-smtp-in.l.google.com
  Connection time: 0.3s
  TLS: TLS 1.3

[10:30:12.456] ✅ DELIVERED
  Response: 250 2.0.0 OK 1234567890 - gsmtp
  Total delivery time: 1.2s
  Queue time: 0.3s
```

**Timeline visual:** horizontal timeline bar với mỗi step là 1 dot + tooltip.

### 15.3 Saved Searches & Alerts

- Lưu search criteria thành "saved search"
- Tạo alert từ saved search: "Nếu có >100 bounces from promo.company.vn trong 10 phút → alert"

---

## 16. MODULE 10 — IP REPUTATION & BLACKLIST MONITOR

### Mục đích
Monitor toàn bộ sending IPs (có thể hàng nghìn) against 25+ DNSBLs.

### 16.1 IP Reputation Overview

**Summary bar:**
- Total IPs: 2,540 (10 nodes × ~254 IPs)
- Clean: 2,535 (99.8%)
- Blacklisted: 5 (0.2%)
- Critical (Spamhaus/Barracuda): 1

**Heatmap/Grid View:**
Hiển thị tất cả IPs dạng grid, color-coded:
- 🟢 Clean (xanh)
- 🟡 Listed on 1 minor BL (vàng)
- 🔴 Listed on critical BL (đỏ)
- ⚫ Inactive (xám)

Hover → tooltip: IP, node, blacklist names, last check time.
Click → detail.

### 16.2 Blacklisted IPs Table

Chỉ hiển thị IPs đang bị list:

| IP | Node | Blacklists | Tier | Since | Delist Link | Actions |
|----|------|-----------|------|-------|-------------|---------|
| 103.21.60.15 | mta-03 | zen.spamhaus.org | CRITICAL | 2h ago | [Delist] | [Pause IP] [View Logs] |
| 103.21.62.44 | mta-05 | dnsbl.sorbs.net | Medium | 1d ago | [Delist] | [Pause IP] |

### 16.3 IP Detail Page

- Blacklist history (timeline: khi bị list, khi được delist)
- Sending volume trend
- Bounce rate trend
- Per-destination delivery rate from this IP
- Warmup progress (nếu đang warmup)
- Associated PTR record
- DNSBL check results (25+ lists: last check time, status)

### 16.4 Bulk Operations

- Check tất cả IPs of 1 node
- Pause tất cả blacklisted IPs
- Resume IPs đã được delist
- Export blacklist report

### 16.5 DNSBL List Management

| Feature | Mô tả |
|---------|-------|
| Managed DNSBL list | Thêm/xóa DNSBLs để check |
| Tier assignment | Classify mỗi DNSBL: Critical (Spamhaus), High, Medium, Low |
| Check frequency | Per-tier: Critical=1min, High=5min, Medium=15min |
| Auto-response rules | Critical BL → auto-pause IP; Medium BL → alert only |

---

## 17. MODULE 11 — ALERTING SYSTEM

### 17.1 Alert Rule Builder

UI dạng form builder cho phép tạo alert rules:

**Template alerts có sẵn:**

| # | Alert | Condition | Severity |
|---|-------|-----------|----------|
| 1 | Node Down | Agent không gửi metrics >2 phút | Critical |
| 2 | MongoDB No Primary | rs.status() không có PRIMARY | Critical |
| 3 | MongoDB Repl Lag | Lag >30s | Critical |
| 4 | IP Blacklisted (Critical) | Spamhaus/Barracuda/SpamCop | Critical |
| 5 | Multiple IPs Blacklisted | >5 IPs trên cùng 1 node | Critical |
| 6 | High Bounce Rate | >10% liên tục 15 phút | Critical |
| 7 | Very High Bounce Rate | >25% liên tục 5 phút | Critical |
| 8 | Queue Backlog | Queue >20K trên 1 node | Critical |
| 9 | Disk Full | <5% free | Critical |
| 10 | All WildDuck Down | Cả 2 WD nodes unavailable | Critical |
| 11 | IP Blacklisted (Any) | Bất kỳ DNSBL nào | Warning |
| 12 | Bounce Rate Elevated | >5% liên tục 30 phút | Warning |
| 13 | CPU High | >85% liên tục 10 phút | Warning |
| 14 | RAM High | >90% liên tục 5 phút | Warning |
| 15 | Disk Low | <15% free | Warning |
| 16 | SMTP Port Down | Port 25 không respond | Warning |
| 17 | IMAP Down | Port 993 không respond | Warning |
| 18 | Redis Memory High | >80% maxmemory | Warning |
| 19 | User Abuse Detected | Volume spike / high bounce / spam reports | Warning |
| 20 | Cert Expiring | TLS cert <7 ngày | Warning |
| 21 | Disk Growth Fast | Dự đoán hết disk trong <30 ngày | Info |
| 22 | MongoDB Disk Growing | >70% used | Info |
| 23 | Warmup IP High Bounce | IP đang warmup có bounce >5% | Info |

**Custom rule builder:**
- Metric selector (dropdown tất cả metrics)
- Operator: >, <, ==, !=
- Threshold value
- Duration (for how long)
- Severity: Critical / Warning / Info
- Notification channels: checkboxes

### 17.2 Notification Channels

| Channel | Config | Dùng cho |
|---------|--------|----------|
| **Telegram** | Bot token + Chat/Group ID | Critical alerts (response nhanh nhất) |
| **Slack** | Webhook URL | Warning + Critical |
| **Email** | SMTP config (dùng chính WildDuck) | Daily reports, Info alerts |
| **Webhook** | Custom URL + headers | Tích hợp PagerDuty, Opsgenie, custom |
| **In-app** | WebSocket push | Tất cả alerts hiển thị trong dashboard |
| **SMS** | Twilio/Vonage config | Critical only (optional) |

### 17.3 Alert Dashboard

- **Active alerts** — Table các alert đang firing, sorted by severity
- **Alert history** — Timeline tất cả alerts (firing + resolved)
- **Alert frequency** — Chart: số alerts per day over 30 ngày
- **Acknowledge** — Nút ack (tôi đã thấy, đang xử lý)
- **Snooze** — Tắt 1 alert tạm thời (1h, 4h, 24h)
- **Mute** — Disable 1 rule hoàn toàn

### 17.4 Escalation

- Level 1: Alert → Telegram group
- Level 2: Nếu không ack sau 15 phút → gọi Telegram trực tiếp + Slack
- Level 3: Nếu không ack sau 30 phút → Email manager + SMS

---

## 18. MODULE 12 — REPORTS & EXPORT

### 18.1 Scheduled Reports

| Report | Tần suất | Nội dung |
|--------|----------|----------|
| **Daily Summary** | 8:00 AM daily | Tổng email sent/received, bounce rate, top issues, cluster health |
| **Weekly Report** | Monday 9:00 AM | Trends, domain reputation changes, IP blacklist incidents, capacity forecast |
| **Monthly Report** | 1st of month | Full statistics, growth trends, incidents recap, recommendations |
| **IP Reputation Report** | Daily | Tất cả IPs: status, blacklist history, warmup progress |

Format: PDF + Email tự động gửi đến admin team.

### 18.2 On-demand Export

| Data | Formats |
|------|---------|
| Email events (filtered) | CSV, JSON, XLSX |
| Server metrics | CSV |
| Blacklist history | CSV |
| Alert history | CSV |
| Domain statistics | CSV, PDF report |
| User statistics | CSV, PDF report |

### 18.3 API Export

REST API cho phép external tools pull data:
- `GET /api/v1/reports/daily?date=2026-02-10`
- `GET /api/v1/export/email-events?from=...&to=...&format=csv`

---

## 19. MODULE 13 — ADMIN & CONFIGURATION

### 19.1 Node Management

| Feature | Mô tả |
|---------|-------|
| Register node | Tự động (agent) hoặc thủ công |
| Edit node info | Hostname, IP, role, metadata |
| Decommission node | Đánh dấu retired, ngừng collect metrics |
| Maintenance mode | Tạm thời suppress alerts cho 1 node |

### 19.2 IP Management

| Feature | Mô tả |
|---------|-------|
| Add IP range | Nhập CIDR, auto-create entries |
| Bulk status change | Select nhiều IPs → Pause/Resume |
| Set warmup schedule | Template: conservative (90 ngày), moderate (60), aggressive (30) |
| Import/Export IP list | CSV |

### 19.3 User Management (Dashboard users)

| Feature | Mô tả |
|---------|-------|
| Roles | Admin (full), Operator (manage nodes/IPs, ack alerts), Viewer (read-only) |
| Login | Username + Password + optional 2FA (TOTP) |
| Audit log | Ai làm gì lúc nào |
| API tokens | Tạo API key cho automation |

### 19.4 Settings

| Setting | Mô tả |
|---------|-------|
| Data retention | Bao lâu giữ raw metrics, email events, aggregated data |
| Collection intervals | Customize scrape intervals per metric type |
| DNSBL list | Add/remove blacklists to check |
| Timezone | Default timezone cho dashboard |
| Theme | Dark / Light mode |
| Alert defaults | Default cooldown, escalation rules |

---

## 20. API DESIGN

### 20.1 RESTful API Endpoints

**Base URL:** `https://monitor.example.com/api/v1`
**Auth:** Bearer token (JWT)

```
# Overview
GET  /overview                    — Dashboard summary data
GET  /health                      — System health check

# Nodes
GET  /nodes                       — List all nodes
GET  /nodes/:id                   — Node detail
POST /nodes                       — Register node (from agent)
PUT  /nodes/:id                   — Update node
DELETE /nodes/:id                 — Decommission
PUT  /nodes/:id/maintenance       — Toggle maintenance mode
GET  /nodes/:id/metrics?range=1h  — Node metrics time-series

# Metrics
GET  /metrics/system?node=X&range=1h     — System metrics
GET  /metrics/mongodb?range=1h           — MongoDB metrics
GET  /metrics/redis?range=1h             — Redis metrics
GET  /metrics/zonemta?node=X&range=1h    — ZoneMTA metrics
GET  /metrics/rspamd?range=1h            — Rspamd metrics

# Email
GET  /email/events?from=&to=&type=&...   — Search email events (paginated)
GET  /email/events/:id                   — Event detail
GET  /email/trace/:message_id            — Full message trace
GET  /email/stats?range=24h&by=domain    — Aggregated stats
GET  /email/throughput?range=1h          — Throughput data for charts
GET  /email/queue                        — Current queue status
GET  /email/bounce-analysis?range=24h    — Bounce breakdown

# IPs
GET  /ips                          — List all sending IPs
GET  /ips/:ip                      — IP detail
PUT  /ips/:ip/status               — Change status (pause/resume)
POST /ips/check                    — Trigger manual blacklist check
GET  /ips/blacklisted              — List blacklisted IPs only
GET  /ips/:ip/history              — Blacklist history
POST /ips/bulk-action              — Bulk pause/resume

# Domains
GET  /domains                      — Sending domain list
GET  /domains/:domain              — Domain detail + stats
GET  /domains/:domain/destinations — Per-destination breakdown

# Users
GET  /users                        — User list with stats
GET  /users/:id                    — User detail
GET  /users/:id/activity           — Send/receive history
GET  /users/abuse-flags            — Users flagged for abuse

# Destinations
GET  /destinations                 — Destination domain stats
GET  /destinations/:domain         — Detail for 1 destination

# Alerts
GET  /alerts                       — Active alerts
GET  /alerts/history               — Alert history
GET  /alerts/rules                 — Alert rules
POST /alerts/rules                 — Create rule
PUT  /alerts/rules/:id             — Update rule
POST /alerts/:id/ack               — Acknowledge
POST /alerts/:id/snooze            — Snooze

# Reports
GET  /reports/daily?date=          — Daily report data
GET  /reports/weekly?week=         — Weekly report
POST /reports/generate             — Trigger report generation
GET  /reports/export?type=csv&...  — Export data

# Admin
POST /auth/login                   — Login
POST /auth/refresh                 — Refresh token
GET  /settings                     — All settings
PUT  /settings                     — Update settings
GET  /audit-log                    — Audit log
```

### 20.2 WebSocket Events

```javascript
// Client subscribes:
socket.emit('subscribe', {
  channels: ['metrics', 'alerts', 'email-flow']
});

// Server pushes:
// Mỗi 15s: system metrics update
{ event: 'metrics:system', data: { node_id: 'mta-01', cpu: 45, ram: 62, ... } }

// Mỗi 5s: email throughput counter
{ event: 'email:throughput', data: { sent: 15, delivered: 14, bounced: 1 } }

// Realtime: new alert fired
{ event: 'alert:fired', data: { id: 123, severity: 'critical', message: '...' } }

// Realtime: alert resolved
{ event: 'alert:resolved', data: { id: 123 } }

// Realtime: IP blacklisted
{ event: 'ip:blacklisted', data: { ip: '103.21.60.15', blacklist: 'spamhaus' } }
```

---

## 21. UI/UX REQUIREMENTS

### 21.1 General

- **Dark theme mặc định** (phù hợp NOC/monitoring screen), có option Light theme
- **Responsive** nhưng optimize cho desktop (1920x1080+), minimum 1366x768
- **Realtime updates** — data tự refresh, không cần F5
- **Fast navigation** — sidebar menu, breadcrumb
- **Keyboard shortcuts** — / = search, ? = help, R = refresh
- **Persistent filters** — lưu filter state vào URL (shareable links)
- **Toast notifications** — cho alerts xuất hiện ở góc phải
- **Full-screen mode** — cho NOC wall display

### 21.2 Navigation Structure

```
Sidebar:
├── 📊 Overview
├── 🖥️ Servers
│   ├── All Servers
│   ├── MongoDB Cluster
│   ├── WildDuck Nodes
│   └── ZoneMTA Outbound
├── 📤 Email Flow
│   ├── Outbound
│   ├── Inbound
│   ├── Queue
│   └── Performance
├── 🌐 Domains
│   ├── Sending Domains
│   └── Destination Analysis
├── 👤 Users
├── 🛡️ IP Reputation
│   ├── IP Overview
│   ├── Blacklist Monitor
│   └── IP Warmup
├── 🔒 Spam & Security
│   ├── Rspamd
│   ├── Authentication
│   └── TLS
├── 📋 Logs
│   ├── Email Events
│   └── Message Trace
├── 🔔 Alerts
│   ├── Active
│   ├── History
│   └── Rules
├── 📈 Reports
└── ⚙️ Settings
    ├── Nodes
    ├── IP Management
    ├── Users
    └── Configuration
```

### 21.3 Chart Standards

| Loại data | Chart type |
|-----------|-----------|
| Time-series single metric | Line chart |
| Time-series multi metric | Multi-line hoặc stacked area |
| Distribution | Histogram hoặc pie |
| Comparison | Bar chart (horizontal hoặc vertical) |
| Status over time | State timeline (Gantt-like) |
| Cluster overview | Heatmap grid |
| Realtime counter | Big number + sparkline |
| Progress | Progress bar hoặc gauge |

### 21.4 Color Scheme

```
OK / Healthy:     #22c55e (green-500)
Warning:          #eab308 (yellow-500)
Critical / Error: #ef4444 (red-500)
Info:             #3b82f6 (blue-500)
Muted / Inactive: #6b7280 (gray-500)
Background:       #0f172a (slate-900)
Surface:          #1e293b (slate-800)
Text primary:     #e2e8f0 (slate-200)
Text secondary:   #94a3b8 (slate-400)
```

---

## 22. NON-FUNCTIONAL REQUIREMENTS

### 22.1 Performance

| Metric | Target |
|--------|--------|
| Dashboard page load | <2 seconds |
| API response (single metric) | <200ms |
| API response (aggregated query) | <1 second |
| WebSocket latency (metrics push) | <500ms |
| Search (email events, 1M+ rows) | <3 seconds |
| Concurrent dashboard users | 20+ |
| Metrics ingestion rate | 10,000 data points/second |

### 22.2 Data Retention

| Data type | Raw retention | Aggregated retention |
|-----------|--------------|---------------------|
| System metrics (15s) | 90 ngày | 2 năm (5m rollup) |
| Email events | 180 ngày | 2 năm (hourly rollup) |
| Blacklist checks | 365 ngày | Permanent (daily rollup) |
| Alert history | 365 ngày | Permanent |
| MongoDB/Redis metrics | 90 ngày | 1 năm |

### 22.3 Availability

- Dashboard uptime target: 99.5%
- Graceful degradation khi 1 data source unavailable
- Health check endpoint cho uptime monitoring

### 22.4 Security

| Requirement | Mô tả |
|-------------|-------|
| Authentication | JWT with refresh tokens |
| Authorization | Role-based (Admin/Operator/Viewer) |
| HTTPS | Bắt buộc |
| API rate limiting | 100 req/s per user |
| CSRF protection | SameSite cookies hoặc CSRF token |
| Audit logging | Mọi action ghi log |
| Agent authentication | API key per agent |
| Sensitive data | Không lưu email subject/body, chỉ hash |

---

## 23. DEPLOYMENT

### 23.1 Tech Requirements

```
Monitoring Server:
  CPU: 8 vCPU
  RAM: 32 GB
  Disk: 1 TB SSD (TimescaleDB + app)
  OS: Ubuntu 22.04 LTS
  Network: Cho phép kết nối đến tất cả mail nodes

Software:
  Node.js 20 LTS
  PostgreSQL 16 + TimescaleDB extension
  Redis 7
  Nginx (reverse proxy + serve React build)
  PM2 hoặc systemd (process manager)
  Certbot (HTTPS)
```

### 23.2 Deployment Architecture

```
[Nginx :443]
  ├── /          → React SPA (static files)
  ├── /api/*     → Node.js API server (:3001)
  └── /ws        → WebSocket server (:3001)

[PM2]
  ├── api-server       (main API + WebSocket)
  ├── metrics-collector (scheduled jobs: collect from all nodes)
  ├── dnsbl-checker    (scheduled: check IPs against blacklists)
  ├── alert-evaluator  (scheduled: evaluate alert rules)
  └── report-generator (scheduled: create daily/weekly reports)

[TimescaleDB :5432]
[Redis :6379]
```

### 23.3 Agent Deployment

Trên mỗi mail server:

```bash
# Agent là 1 Node.js script nhỏ, chạy bằng PM2
npm install -g wildduck-monitor-agent
wildduck-monitor-agent --server=https://monitor.example.com --key=agent-api-key
```

Agent tự đăng ký node, gửi metrics mỗi 15 giây.

---

## 24. PHÂN PHA PHÁT TRIỂN

### Phase 1 — Foundation (3-4 tuần)

**Deliverables:**
- Backend API skeleton (Fastify + TimescaleDB + Redis)
- Agent: system metrics collection + push API
- Database schema (tất cả tables + hypertables)
- Authentication (JWT)
- Frontend skeleton (React + routing + layout)
- Overview dashboard (basic stats + charts)
- Server list + detail view (CPU/RAM/Disk/Network)

**Ưu tiên:** Có thể xem được health của tất cả 15 servers.

### Phase 2 — Email Analytics (3-4 tuần)

**Deliverables:**
- Email event ingestion pipeline (GELF receiver hoặc MongoDB change stream)
- Email flow dashboard (inbound/outbound throughput)
- Delivery performance (time, queue)
- Log search + filtering
- Message tracing
- ZoneMTA metrics collection
- Queue monitoring

**Ưu tiên:** Xem được email flow realtime, tìm kiếm được logs.

### Phase 3 — IP & Domain Management (3-4 tuần)

**Deliverables:**
- DNSBL checker engine
- IP reputation dashboard + detail
- IP warmup manager
- Sending domain quality dashboard
- Destination analysis
- Per-IP per-domain breakdown

**Ưu tiên:** Quản lý được hàng nghìn IPs, phát hiện blacklist nhanh.

### Phase 4 — Alerting & Users (2-3 tuần)

**Deliverables:**
- Alert rule engine
- Notification channels (Telegram, Slack, Email, Webhook)
- Alert dashboard + history
- User analytics
- Abuse detection
- Escalation system

**Ưu tiên:** Tự động cảnh báo khi có vấn đề.

### Phase 5 — Reports & Polish (2-3 tuần)

**Deliverables:**
- Scheduled report generation (daily/weekly/monthly)
- PDF export
- Data export (CSV/JSON)
- Admin panel (settings, user management)
- Performance optimization
- Mobile responsive improvements
- Documentation

**Ưu tiên:** Tự động hóa, polish UI.

### Tổng timeline ước tính: 14-18 tuần (3.5-4.5 tháng)

**Team size đề xuất:**
- 1 Senior Backend Developer (Node.js + PostgreSQL)
- 1 Senior Frontend Developer (React)
- 1 DevOps / Fullstack (Agent development, deployment)
- 0.5 Designer (UI/UX review, chart design)

---

## 25. GLOSSARY

| Thuật ngữ | Giải thích |
|-----------|------------|
| **DNSBL** | DNS-based Blackhole List — danh sách IPs bị blacklist |
| **MTA** | Mail Transfer Agent — server gửi email |
| **MX Record** | Mail Exchange — DNS record chỉ server nhận email |
| **Bounce (Hard)** | Email bị reject vĩnh viễn (user không tồn tại) |
| **Bounce (Soft)** | Email bị reject tạm thời (mailbox full, server busy) |
| **Deferred** | Email chưa gửi được, sẽ retry lại |
| **DKIM** | DomainKeys Identified Mail — chữ ký số cho email |
| **SPF** | Sender Policy Framework — xác thực IP gửi email |
| **DMARC** | Domain-based Message Authentication — chính sách xác thực tổng hợp |
| **Warmup** | Quy trình tăng dần volume gửi từ IP mới |
| **Queue** | Hàng đợi email chờ được gửi |
| **PTR Record** | Reverse DNS — IP → hostname |
| **Rspamd** | Spam filter engine |
| **Hypertable** | TimescaleDB concept: bảng tối ưu cho time-series data |
| **Continuous Aggregate** | Auto-computed rollup trong TimescaleDB |
| **GELF** | Graylog Extended Log Format — format log structured |

---

*Tài liệu này là input cho dev team. Mọi module đều có thể điều chỉnh scope/priority dựa trên thực tế triển khai.*
