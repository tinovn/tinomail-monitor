# Phase 03: Integrate Collector into MonitoringAgent

## Context Links

- [MonitoringAgent](../../packages/agent/src/monitoring-agent.ts)
- [Agent config](../../packages/agent/src/agent-config.ts)
- [Service auto-discovery](../../packages/agent/src/collectors/service-auto-discovery-collector.ts)

## Overview

- **Priority**: P1
- **Status**: pending
- **Description**: Wire `ZonemtaEmailEventCollector` into `MonitoringAgent` lifecycle — init, start, stop. Support both explicit config via env var and auto-discovery.

## Key Insights

- Agent already has pattern for optional collectors: `mongodbCollector`, `zonemtaCollector`, `redisCollector`
- Collector activation: either explicit env var OR auto-discovery detects ZoneMTA service
- Change stream is long-lived (not interval-based) — no `setInterval` needed, just `connect()` and `disconnect()`
- `EventHttpTransport` reuses same `serverUrl` and `apiKey` as metrics transport

## Requirements

### Functional
- If `AGENT_ZONEMTA_MONGODB_URI` is set, create `ZonemtaEmailEventCollector` in constructor
- If auto-discovery finds `zonemta` AND env var is set, activate the event collector in `initDynamicCollectors()`
- On `start()`: call `collector.connect()` to begin watching change stream
- On `stop()`: call `collector.disconnect()` to flush buffer and close stream
- Log lifecycle events: "[Agent] ZoneMTA event collector started/stopped"

### Non-functional
- Collector failure must not crash the agent — wrap in try-catch
- If connection fails on start, log error and continue (other collectors still run)

## Architecture

```
MonitoringAgent
  ├─ (existing) zonemtaCollector       — HTTP API metrics (15s interval)
  ├─ (NEW) zonemtaEventCollector       — MongoDB change stream (long-lived)
  └─ (NEW) eventTransport              — EventHttpTransport for /api/v1/events/ingest

Constructor:
  if (config.AGENT_ZONEMTA_MONGODB_URI) → create eventTransport + zonemtaEventCollector

start():
  if (zonemtaEventCollector) → await zonemtaEventCollector.connect()

stop():
  if (zonemtaEventCollector) → await zonemtaEventCollector.disconnect()
```

## Related Code Files

### Modify
- `packages/agent/src/monitoring-agent.ts`

### Reference (read-only)
- `packages/agent/src/collectors/zonemta-email-event-collector.ts` — created in phase 02
- `packages/agent/src/transport/event-http-transport.ts` — created in phase 01

## Implementation Steps

1. **Add imports to `monitoring-agent.ts`**
   ```typescript
   import { ZonemtaEmailEventCollector } from "./collectors/zonemta-email-event-collector.js";
   import { EventHttpTransport } from "./transport/event-http-transport.js";
   ```

2. **Add class properties**
   ```typescript
   private zonemtaEventCollector: ZonemtaEmailEventCollector | null = null;
   private eventTransport: EventHttpTransport | null = null;
   ```

3. **Initialize in constructor (after transport init)**
   ```typescript
   if (config.AGENT_ZONEMTA_MONGODB_URI) {
     this.eventTransport = new EventHttpTransport({
       serverUrl: config.AGENT_SERVER_URL,
       apiKey: config.AGENT_API_KEY,
       timeoutMs: 10000,
       maxRetries: 3,
     });
     this.zonemtaEventCollector = new ZonemtaEmailEventCollector(
       config.AGENT_ZONEMTA_MONGODB_URI,
       config.AGENT_NODE_ID,
       this.eventTransport
     );
   }
   ```

4. **Start collector in `start()` method** (after MongoDB collector connect block)
   ```typescript
   if (this.zonemtaEventCollector) {
     try {
       await this.zonemtaEventCollector.connect();
       console.info("[Agent] ZoneMTA email event collector started");
     } catch (error) {
       console.error("[Agent] ZoneMTA event collector failed to start:", error);
       this.zonemtaEventCollector = null;
     }
   }
   ```

5. **Stop collector in `stop()` method** (before MongoDB disconnect)
   ```typescript
   if (this.zonemtaEventCollector) {
     await this.zonemtaEventCollector.disconnect();
   }
   ```

6. **Optional: auto-discovery activation in `initDynamicCollectors()`**
   - Only activate if `AGENT_ZONEMTA_MONGODB_URI` is set AND zonemta discovered
   - This prevents activation when there's no MongoDB URI to connect to
   - The ZoneMTA HTTP API collector (`zonemtaCollector`) activates via discovery alone
   - The event collector additionally needs the MongoDB URI

## Todo List

- [ ] Add imports for `ZonemtaEmailEventCollector` and `EventHttpTransport`
- [ ] Add `zonemtaEventCollector` and `eventTransport` properties
- [ ] Initialize in constructor when `AGENT_ZONEMTA_MONGODB_URI` is set
- [ ] Start collector in `start()` with try-catch
- [ ] Stop collector in `stop()` with cleanup
- [ ] Verify agent still starts correctly when env var is not set

## Success Criteria

- Agent with `AGENT_ZONEMTA_MONGODB_URI` set: event collector starts and logs confirmation
- Agent without env var: no event collector created, no errors
- Event collector failure does not crash agent
- Clean shutdown flushes remaining events before closing

## Risk Assessment

- **Low**: Constructor changes are additive — null check pattern matches existing collectors
- **Low**: Start/stop follow exact same try-catch pattern as MongoDB collector
- **Medium**: `monitoring-agent.ts` is already 375 lines — adding ~20 lines stays manageable but approaches limit

## Security Considerations

- No new auth mechanism — reuses existing `AGENT_API_KEY`
- MongoDB URI from env var, never logged

## Next Steps

- Phase 04: build agent, test on staging ZoneMTA node, deploy
