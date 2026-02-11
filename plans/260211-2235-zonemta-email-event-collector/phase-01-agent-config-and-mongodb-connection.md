# Phase 01: Agent Config & MongoDB Connection Setup

## Context Links

- [Agent config](../../packages/agent/src/agent-config.ts)
- [MongoDB metrics collector](../../packages/agent/src/collectors/mongodb-metrics-collector.ts) — reference for MongoClient usage pattern
- [ZoneMTA MongoDB schema research](../reports/researcher-260211-2236-zonemta-mongodb-schema.md)

## Overview

- **Priority**: P1
- **Status**: pending
- **Description**: Add `AGENT_ZONEMTA_MONGODB_URI` env var to agent config and create a small HTTP transport for sending email events to the backend ingestion endpoint.

## Key Insights

- Agent already uses `mongodb` npm package for `MongodbMetricsCollector` — no new dependency needed
- ZoneMTA DB (`zone-mta`) is separate from WildDuck DB — needs its own connection string
- Existing `HttpMetricsTransport` sends to `/api/v1/metrics/{type}` — events use different endpoint `/api/v1/events/ingest`
- Backend expects `x-api-key` header for agent auth (same key as metrics)

## Requirements

### Functional
- New env var `AGENT_ZONEMTA_MONGODB_URI` (optional, string, default: none)
- When set, agent creates a MongoDB connection to the zone-mta database
- New `EventHttpTransport` class to POST event batches to backend

### Non-functional
- Connection timeout: 5s (consistent with existing MongoDB collector)
- Retry with exponential backoff on transport failure (reuse same pattern as `HttpMetricsTransport`)

## Architecture

```
agent-config.ts
  └─ AGENT_ZONEMTA_MONGODB_URI: z.string().optional()

EventHttpTransport
  └─ sendEvents(events: EmailEventPayload[]): Promise<void>
       └─ POST /api/v1/events/ingest
            Headers: Content-Type: application/json, x-api-key: {key}
            Body: EmailEventPayload[]
```

## Related Code Files

### Modify
- `packages/agent/src/agent-config.ts` — add env var

### Create
- `packages/agent/src/transport/event-http-transport.ts` — event-specific HTTP transport

## Implementation Steps

1. **Add env var to `agent-config.ts`**
   - Add `AGENT_ZONEMTA_MONGODB_URI: z.string().optional()` to `envSchema`
   - This is optional — only ZoneMTA nodes will set it

2. **Create `event-http-transport.ts`**
   - Interface `EventTransportConfig`: `serverUrl`, `apiKey`, `timeoutMs`, `maxRetries`
   - Class `EventHttpTransport` with `sendEvents(events[])` method
   - POST to `${serverUrl}/api/v1/events/ingest`
   - Headers: `Content-Type: application/json`, `x-api-key: ${apiKey}`
   - Retry logic: same exponential backoff as `HttpMetricsTransport` (1s, 2s, 4s)
   - Accept array of event objects matching `emailEventIngestSchema`

3. **Define `EmailEventPayload` interface in collector file** (phase 02)
   - Matches backend's `emailEventSchema` fields
   - time (ISO string), eventType, queueId, fromAddress, toAddress, toDomain, mtaNode, mxHost, statusCode, statusMessage, deliveryTimeMs, bounceType, bounceCategory, bounceMessage

## Todo List

- [ ] Add `AGENT_ZONEMTA_MONGODB_URI` to `envSchema` in `agent-config.ts`
- [ ] Create `event-http-transport.ts` with `EventHttpTransport` class
- [ ] Verify transport sends correct payload format matching backend schema

## Success Criteria

- `AGENT_ZONEMTA_MONGODB_URI` parsed from env without breaking existing config
- `EventHttpTransport` can POST an array of events to `/api/v1/events/ingest`
- Retry + backoff works on network failure

## Risk Assessment

- **Low**: Adding optional env var is backward-compatible
- **Low**: Transport is isolated — no impact on existing metrics pipeline

## Security Considerations

- MongoDB URI may contain credentials — never log it
- Reuses existing `AGENT_API_KEY` for authentication

## Next Steps

- Phase 02 uses the MongoDB connection to open change stream
- Phase 03 wires transport into the collector and agent lifecycle
