# Phase 04 — Lightweight Metrics Agent for Mail Servers

## Context Links
- [Parent Plan](./plan.md)
- [PRD Section 4.2: Agent Architecture](../wildduck-dashboard-requirements.md)
- [PRD Section 5.1: System Metrics](../wildduck-dashboard-requirements.md)
- [Research: Agent Design](./research/researcher-02-frontend-database-agent.md)
- Depends on: [Phase 01](./phase-01-project-setup-and-infrastructure.md), [Phase 03](./phase-03-backend-api-core.md)

## Overview
- **Priority:** P1 (Required for any monitoring data)
- **Status:** pending
- **Effort:** 3-4 days
- **Description:** Build lightweight Node.js agent deployed on every mail server (15+ nodes). Collects system metrics via `systeminformation`, monitors mail-related processes (WildDuck, Haraka, ZoneMTA, Rspamd, Redis), checks service ports, auto-registers with dashboard server, pushes metrics every 15s via HTTP POST.

## Key Insights
- `systeminformation` package: ~5-10MB overhead, safe for production
- HTTP POST preferred over WebSocket/gRPC: simpler, stateless, retry-able
- Agent memory target: ~40-70MB total (Node.js base + systeminformation + HTTP)
- Heartbeat interval: 15s for system metrics (PRD spec)
- Auto-registration on startup, re-register on IP change
- Server marks agent offline if no heartbeat for 3 missed intervals (45s)
- Use `--max-old-space-size=64` to cap V8 heap

## Requirements

### Functional
- Collect system metrics: CPU (total + per-core), RAM, disk (usage + I/O), network (rx/tx + errors), load avg, TCP connections, open files, uptime
- Monitor processes: WildDuck, Haraka, ZoneMTA, Rspamd, Redis, MongoDB — status, PID, CPU%, RAM MB
- Check service ports: SMTP(25), Submission(587), IMAP(993), POP3(995)
- Auto-register with dashboard on first startup
- Push metrics to `POST /metrics/system` every 15s
- Heartbeat via same metrics POST (server tracks last_seen)
- Graceful degradation: buffer metrics locally if server unreachable, flush on reconnect
- Configuration via env vars or config file
- PM2 ecosystem file for deployment

### Non-Functional
- Memory: < 70MB resident
- CPU: < 2% idle, < 5% during collection
- Network: < 2KB per metrics POST (gzip compressed)
- Startup time: < 3 seconds
- Zero dependency on dashboard server for mail operations (agent crash = no mail impact)

## Architecture

### Agent Package Structure
```
packages/agent/
├── package.json
├── tsconfig.json
├── ecosystem.config.js          # PM2 config
├── src/
│   ├── index.ts                 # Entry: init agent, start collection loop
│   ├── config.ts                # Env config: SERVER_URL, API_KEY, NODE_ID, etc.
│   ├── agent.ts                 # Main Agent class: lifecycle management
│   ├── collectors/
│   │   ├── system-collector.ts  # CPU, RAM, disk, network, load, uptime
│   │   ├── process-collector.ts # WildDuck, Haraka, ZoneMTA, Rspamd, Redis, MongoDB
│   │   └── port-checker.ts      # TCP port connectivity check (25, 587, 993, 995)
│   ├── transport/
│   │   ├── http-transport.ts    # HTTP POST to dashboard API with retry
│   │   └── buffer.ts            # In-memory buffer for offline periods
│   └── utils/
│       ├── logger.ts            # Minimal console logger with levels
│       └── network.ts           # Get local IP, hostname
└── dist/                        # Compiled JS
```

### Data Flow
```
Agent Start
  → Read config (env vars)
  → Auto-register: POST /nodes { hostname, ip, role, version }
  → Receive node_id confirmation
  → Start collection loop (every 15s):
      ├── system-collector.collect()
      ├── process-collector.collect()
      ├── port-checker.check()
      └── Merge into single payload
  → POST /metrics/system { node_id, timestamp, system, processes, services }
  → On failure: buffer in memory (max 100 entries = 25 min)
  → On reconnect: flush buffer FIFO
```

### Metrics Payload (per PRD Section 4.2)
```typescript
interface AgentMetricsPayload {
  node_id: string;
  timestamp: string; // ISO 8601
  system: {
    cpu_percent: number;
    cpu_cores: { core: number; percent: number }[];
    ram_used_percent: number;
    ram_used_bytes: number;
    ram_total_bytes: number;
    disk_used_percent: number;
    disk_free_bytes: number;
    disk_read_bytes_sec: number;
    disk_write_bytes_sec: number;
    net_rx_bytes_sec: number;
    net_tx_bytes_sec: number;
    net_rx_errors: number;
    net_tx_errors: number;
    load_avg: [number, number, number]; // 1m, 5m, 15m
    tcp_established: number;
    tcp_time_wait: number;
    open_files: number;
    uptime_seconds: number;
  };
  processes: Record<string, {
    status: 'running' | 'stopped' | 'not_found';
    pid: number | null;
    memory_mb: number;
    cpu_percent: number;
  }>;
  services: Record<string, boolean>; // port_25: true, port_587: true, etc.
}
```

## Related Code Files

### Files to Create
- `packages/agent/src/index.ts`
- `packages/agent/src/config.ts`
- `packages/agent/src/agent.ts`
- `packages/agent/src/collectors/system-collector.ts`
- `packages/agent/src/collectors/process-collector.ts`
- `packages/agent/src/collectors/port-checker.ts`
- `packages/agent/src/transport/http-transport.ts`
- `packages/agent/src/transport/buffer.ts`
- `packages/agent/src/utils/logger.ts`
- `packages/agent/src/utils/network.ts`
- `packages/agent/ecosystem.config.js`

## Implementation Steps

### Step 1: Agent Config
1. Define env vars: `DASHBOARD_URL`, `API_KEY`, `NODE_ID` (auto-detected if empty), `NODE_ROLE`, `HEARTBEAT_INTERVAL` (default 15000ms), `LOG_LEVEL`
2. Validate with Zod, fail fast on missing required vars
3. Support both env vars and `.agent.env` file

### Step 2: System Collector
1. Use `systeminformation` to collect:
   - `si.currentLoad()` → cpu_percent, per-core
   - `si.mem()` → ram_used_percent, ram_used_bytes, ram_total_bytes
   - `si.fsSize()` → disk_used_percent, disk_free_bytes
   - `si.disksIO()` → disk_read_bytes_sec, disk_write_bytes_sec
   - `si.networkStats()` → net_rx/tx_bytes_sec, errors
   - `os.loadavg()` → load_avg [1m, 5m, 15m]
   - `si.networkConnections()` → count ESTABLISHED, TIME_WAIT
   - Read `/proc/sys/fs/file-nr` or `si.processes()` for open_files
   - `os.uptime()` → uptime_seconds
2. Cache `si` calls that are slow (fsSize < 5s stale OK)
3. Total collection time target: < 500ms

### Step 3: Process Collector
1. Define monitored processes:
   ```typescript
   const MONITORED_PROCESSES = [
     { name: 'zonemta', patterns: ['zone-mta', 'zonemta'] },
     { name: 'wildduck', patterns: ['wildduck'] },
     { name: 'haraka', patterns: ['haraka'] },
     { name: 'rspamd', patterns: ['rspamd'] },
     { name: 'redis', patterns: ['redis-server'] },
     { name: 'mongodb', patterns: ['mongod'] },
   ];
   ```
2. Use `si.processes()` to get full process list
3. Match process names/commands against patterns
4. Extract: status, pid, memory, cpu for each matched process
5. If process not found: `{ status: 'not_found', pid: null, memory_mb: 0, cpu_percent: 0 }`

### Step 4: Port Checker
1. Configurable port list (default: 25, 587, 993, 995, 12080, 11334)
2. TCP connect with 3s timeout
3. Return boolean per port
4. Only check ports relevant to node role (ZoneMTA node doesn't need IMAP check)

### Step 5: HTTP Transport
1. POST to `${DASHBOARD_URL}/api/v1/metrics/system`
2. Headers: `Authorization: Bearer ${API_KEY}`, `Content-Type: application/json`, `Content-Encoding: gzip`
3. Gzip compress payload before sending
4. Retry strategy: 3 attempts, exponential backoff (1s, 2s, 4s)
5. On persistent failure: pass to buffer

### Step 6: Offline Buffer
1. In-memory circular buffer, max 100 entries (~25 min of data at 15s intervals)
2. On transport failure: push to buffer
3. On transport success: drain buffer (oldest first), send up to 10 buffered entries per successful POST
4. Buffer stats exposed for debugging

### Step 7: Agent Lifecycle
1. `agent.start()`:
   - Load config
   - Auto-register: POST `/api/v1/nodes` with hostname, IP, role, version
   - Start collection loop (setInterval 15s)
   - Log: "Agent started, node_id={id}, posting to {url}"
2. `agent.stop()`:
   - Clear interval
   - Flush buffer (best effort)
   - Log: "Agent stopped"
3. Handle SIGTERM/SIGINT gracefully

### Step 8: PM2 Ecosystem Config
```javascript
module.exports = {
  apps: [{
    name: 'tinomail-agent',
    script: './dist/index.js',
    node_args: '--max-old-space-size=64',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '100M',
    env: {
      NODE_ENV: 'production',
      DASHBOARD_URL: 'https://monitor.example.com',
      API_KEY: 'agent-key-here',
      NODE_ROLE: 'zonemta-outbound',
      HEARTBEAT_INTERVAL: '15000',
    },
  }],
};
```

### Step 9: Build & Distribution
1. Build with `tsup` (single output file, bundled)
2. Package as standalone: `npm pack` or direct git clone + `npm install --production`
3. Install script: `install.sh` that sets up PM2 + starts agent
4. Verify agent runs on fresh Ubuntu 22.04

## Todo List
- [ ] Create agent config with Zod validation
- [ ] Implement system-collector.ts (CPU, RAM, disk, network, load, uptime)
- [ ] Implement process-collector.ts (detect mail processes)
- [ ] Implement port-checker.ts (TCP connect test)
- [ ] Implement http-transport.ts (POST with retry + gzip)
- [ ] Implement buffer.ts (circular offline buffer)
- [ ] Implement agent.ts (lifecycle: register, loop, stop)
- [ ] Implement logger utility
- [ ] Implement network utility (get local IP)
- [ ] Create PM2 ecosystem.config.js
- [ ] Create install.sh script
- [ ] Test: agent starts and registers with local backend
- [ ] Test: metrics arrive in TimescaleDB
- [ ] Test: offline buffer works (stop backend, restart, verify flush)
- [ ] Test: memory stays < 70MB under load

## Success Criteria
- Agent starts, auto-registers with dashboard backend
- Metrics POST every 15s with complete system + process + port data
- Backend receives and stores metrics in metrics_system table
- Agent consumes < 70MB RAM, < 2% CPU
- Offline buffer accumulates data when server down, flushes on reconnect
- PM2 auto-restarts agent on crash
- No impact on mail server operations

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| systeminformation slow on some systems | Med | Cache slow calls, async with timeout |
| Agent memory leak over time | Med | V8 heap cap, PM2 max_memory_restart |
| Network timeouts blocking collection loop | High | Separate collection and transport intervals; POST is async |
| Process detection false positives | Low | Use strict pattern matching, verify PID responds |

## Security Considerations
- API key stored in env or config file (not in agent code)
- API key transmitted over HTTPS only
- Agent has read-only system access (no root required for most metrics)
- Port checker only does TCP connect (no data sent)
- No sensitive mail data collected (only system metrics)

## Next Steps
- Phase 06: Server monitoring UI renders agent data
- Later: Add agent remote management (restart process, update config) via API
