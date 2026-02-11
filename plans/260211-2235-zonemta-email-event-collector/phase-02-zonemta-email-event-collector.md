# Phase 02: ZoneMTA Email Event Collector Core

## Context Links

- [ZoneMTA MongoDB schema research](../reports/researcher-260211-2236-zonemta-mongodb-schema.md)
- [Backend email event validation schema](../../packages/backend/src/schemas/email-event-validation-schemas.ts)
- [Shared EmailEvent type](../../packages/shared/src/types/email-event.ts)
- [Shared email event type constants](../../packages/shared/src/constants/email-event-types.ts)
- [MongoDB metrics collector](../../packages/agent/src/collectors/mongodb-metrics-collector.ts) — MongoClient pattern reference

## Overview

- **Priority**: P1
- **Status**: pending
- **Description**: Core collector that opens a MongoDB change stream on `zone-queue`, maps status transitions to `EmailEvent` payloads, batches them, and sends via `EventHttpTransport`.

## Key Insights

- Change streams require MongoDB replica set — already deployed as 3-node cluster
- Watch for `update`/`replace` operations where `status` field changes to SENT, BOUNCED, or DEFERRED
- Do NOT watch for initial QUEUED inserts — only status transitions
- ZoneMTA `zone-queue` doc fields: `id`, `seq`, `recipient`, `returnPath`, `zone`, `status`, `domain`, `mxHostname`, `mxPort`, `response`, `first`, `last`, `next`, `count`
- Backend expects ISO datetime strings for `time` field
- SMTP response codes can be parsed from `response` string (e.g., "250 2.0.0 Ok" -> statusCode=250)
- Resume token enables crash recovery — persist to file after each batch send

## Requirements

### Functional
- Open change stream on `zone-queue` collection in `zone-mta` database
- Filter: `operationType` in [`update`, `replace`], `updateDescription.updatedFields.status` exists
- Map ZoneMTA status to event types:
  - `SENT` -> `delivered`
  - `BOUNCED` -> `bounced`
  - `DEFERRED` -> `deferred`
- Extract fields from fullDocument (require `fullDocument: "updateLookup"`)
- Batch events: max 50 events OR 5s timeout, whichever first
- Persist resume token to file after successful batch send
- On startup, load resume token from file to resume from last position
- Auto-reconnect on change stream error with exponential backoff

### Non-functional
- Memory: minimal — no unbounded queues, batch cap at 50
- Latency: events forwarded within 5s of occurrence
- Reliability: resume token ensures no gaps on restart

## Architecture

```
ZonemtaEmailEventCollector
  ├─ MongoClient (zone-mta DB)
  ├─ ChangeStream (zone-queue, fullDocument: "updateLookup")
  │    └─ Pipeline: [{ $match: { operationType: { $in: ["update", "replace"] } } }]
  ├─ Event buffer (array, max 50)
  ├─ Flush timer (5s interval)
  ├─ Resume token file (/tmp/tinomail-agent-zonemta-resume.json)
  └─ EventHttpTransport (POST /api/v1/events/ingest)

Flow:
  change event → mapToEmailEvent() → buffer.push()
  buffer full OR timer fires → flush() → transport.sendEvents() → save resume token
```

## Related Code Files

### Create
- `packages/agent/src/collectors/zonemta-email-event-collector.ts`

### Reference (read-only)
- `packages/agent/src/collectors/mongodb-metrics-collector.ts` — MongoClient connect/disconnect pattern
- `packages/agent/src/transport/event-http-transport.ts` — created in phase 01
- `packages/backend/src/schemas/email-event-validation-schemas.ts` — payload shape

## Implementation Steps

1. **Define `EmailEventPayload` interface**
   - Match backend's `emailEventSchema` fields (only the ones we can populate from zone-queue):
     ```typescript
     interface EmailEventPayload {
       time: string;          // ISO datetime
       eventType: string;     // delivered | bounced | deferred
       queueId?: string;      // zone-queue doc.id
       fromAddress?: string;  // doc.returnPath
       toAddress?: string;    // doc.recipient
       toDomain?: string;     // doc.domain
       mtaNode?: string;      // agent nodeId
       mxHost?: string;       // doc.mxHostname
       statusCode?: number;   // parsed from doc.response
       statusMessage?: string;// doc.response (truncated to 500 chars)
       deliveryTimeMs?: number;// calculated from doc.first to doc.last
       bounceType?: string;   // "hard" or "soft" based on status
       bounceMessage?: string;// doc.response for bounced events
     }
     ```

2. **Create `ZonemtaEmailEventCollector` class**
   - Constructor args: `mongoUri: string`, `nodeId: string`, `transport: EventHttpTransport`
   - Properties: `client: MongoClient`, `changeStream`, `eventBuffer: EmailEventPayload[]`, `flushTimer`, `resumeTokenPath`

3. **Implement `connect()` method**
   - Create MongoClient with `serverSelectionTimeoutMS: 5000`
   - Connect and get `zone-mta` database, `zone-queue` collection
   - Load resume token from file (if exists)
   - Open change stream with pipeline and resume token

4. **Implement change stream pipeline**
   ```typescript
   const pipeline = [
     {
       $match: {
         operationType: { $in: ["update", "replace"] },
         "updateDescription.updatedFields.status": { $exists: true }
       }
     }
   ];
   const options = {
     fullDocument: "updateLookup" as const,
     ...(resumeToken ? { resumeAfter: resumeToken } : {})
   };
   ```

5. **Implement `change` event handler**
   - Extract `fullDocument` from change event
   - Skip if `fullDocument` is null (document deleted between update and lookup)
   - Skip if status is `QUEUED` (not a delivery event)
   - Map status: `SENT`->`delivered`, `BOUNCED`->`bounced`, `DEFERRED`->`deferred`
   - Call `mapToEmailEvent(fullDocument, eventType)` to build payload
   - Push to `eventBuffer`
   - If buffer reaches 50, call `flush()`

6. **Implement `mapToEmailEvent(doc, eventType)` helper**
   - `time`: `doc.last?.toISOString() || new Date().toISOString()`
   - `eventType`: mapped value
   - `queueId`: `doc.id`
   - `fromAddress`: `doc.returnPath`
   - `toAddress`: `doc.recipient`
   - `toDomain`: `doc.domain`
   - `mtaNode`: `this.nodeId`
   - `mxHost`: `doc.mxHostname`
   - `statusCode`: parse from `doc.response` using regex `/^(\d{3})\s/`
   - `statusMessage`: `doc.response?.substring(0, 500)`
   - `deliveryTimeMs`: if `doc.first` and `doc.last`, calculate `last - first` in ms
   - `bounceType`: if BOUNCED -> `"hard"`, if DEFERRED -> `"soft"`
   - `bounceMessage`: `doc.response` for bounced/deferred events

7. **Implement `parseSmtpStatusCode(response)` helper**
   - Regex: `/^(\d{3})[\s-]/`
   - Return parsed int or undefined

8. **Implement `flush()` method**
   - If buffer empty, return
   - Copy buffer, clear it
   - Call `transport.sendEvents(events)`
   - On success: save latest resume token to file
   - On failure: log error, push events back to buffer (retry on next flush)

9. **Implement flush timer**
   - `setInterval(flush, 5000)` — started in `connect()`, cleared in `disconnect()`

10. **Implement resume token persistence**
    - `saveResumeToken(token)`: write JSON to `/tmp/tinomail-agent-zonemta-resume.json`
    - `loadResumeToken()`: read from file, return parsed token or null
    - Use `fs.writeFileSync` / `fs.readFileSync` with try-catch

11. **Implement error handling on change stream**
    - Listen for `error` event on change stream
    - On error: log, wait with backoff (1s, 2s, 4s, max 30s), reconnect
    - Reconnect reuses saved resume token
    - Cap reconnect attempts; after 10 failures, stop and log critical

12. **Implement `disconnect()` method**
    - Clear flush timer
    - Flush remaining buffer
    - Close change stream
    - Close MongoClient

## Todo List

- [ ] Define `EmailEventPayload` interface
- [ ] Create `ZonemtaEmailEventCollector` class with constructor
- [ ] Implement `connect()` with change stream setup
- [ ] Implement change stream pipeline with status filter
- [ ] Implement `change` event handler with status mapping
- [ ] Implement `mapToEmailEvent()` field mapping
- [ ] Implement `parseSmtpStatusCode()` helper
- [ ] Implement `flush()` with batch send and error handling
- [ ] Implement flush timer (5s interval)
- [ ] Implement resume token save/load to file
- [ ] Implement change stream error handling with auto-reconnect
- [ ] Implement `disconnect()` cleanup

## Success Criteria

- Change stream opens and receives status update events from zone-queue
- Events correctly mapped: SENT->delivered, BOUNCED->bounced, DEFERRED->deferred
- Batching works: sends at 50 events or 5s, whichever first
- Resume token persisted; agent restart resumes from correct position
- Auto-reconnect on stream error with backoff
- File stays under 200 lines (split helpers if needed)

## Risk Assessment

- **Medium**: `fullDocument: "updateLookup"` may return null if doc deleted before lookup — handled with null check
- **Medium**: Change stream breaks on MongoDB primary stepdown — mitigated by auto-reconnect with resume token
- **Low**: `response` field format may vary — regex parsing is defensive (returns undefined on no match)
- **Low**: Zone-queue may have additional undocumented fields — we only read known fields

## Security Considerations

- No email body/subject accessed — only envelope metadata (from, to, domain, status)
- MongoDB URI with credentials never logged
- Resume token file in /tmp — acceptable for agent running as system service

## Next Steps

- Phase 03 integrates this collector into `MonitoringAgent` lifecycle
