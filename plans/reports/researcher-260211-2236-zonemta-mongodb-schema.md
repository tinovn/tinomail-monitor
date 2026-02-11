# ZoneMTA MongoDB Storage Research

**Date**: 2026-02-11
**Researcher**: researcher-a7f4106
**Topic**: ZoneMTA MongoDB collections, schema, and delivery event tracking

---

## 1. MongoDB Collections

### Primary Collections

**`zone-queue`** (configurable)
- Main message queue storage
- Stores delivery attempts and recipient data
- Each email generates 1...N entries (one per recipient)

**GridFS Collections** (bucket: `mail`)
- `mail.files` - Message metadata and headers
- `mail.chunks` - Message body chunks (255 KiB default)
- Each email has single entry in `mail.files`, references queue entries

### Collection Relationship
```
mail.files (1) → (N) zone-queue entries (one per recipient)
```

---

## 2. Default Database Configuration

**Database Name**: `zone-mta`
**Connection String**: `mongodb://127.0.0.1:27017/zone-mta`
**GridFS Bucket**: `mail`
**Queue Collection**: `zone-queue`
**Queue Instance ID**: `default` (for multi-server deployments)

---

## 3. Queue Document Schema

### Confirmed Fields (from API responses & config)

**Message Identification**
- `id` (string) - Queue ID / Message ID
- `seq` (string) - Recipient sequence ID

**Envelope**
- `recipient` (string) - To address
- `returnPath` (string) - From address (MAIL FROM)
- `zone` (string) - Sending zone assignment

**Status & Tracking**
- `status` (enum) - `QUEUED`, `DEFERRED`, `SENT`, `BOUNCED`

**Deferred Delivery Fields** (when status=DEFERRED)
- `first` (Date) - Initial deferral timestamp
- `last` (Date) - Most recent attempt
- `next` (Date) - Scheduled next retry
- `count` (number) - Retry attempt counter
- `response` (string) - SMTP error message from MX

**Delivery Metadata** (inferred from plugins)
- `domain` (string) - Recipient domain
- `mxPort` (number) - MX server port
- `mxHostname` (string) - MX server hostname

---

## 4. GridFS `mail.files` Schema

**MongoDB GridFS Standard Fields**
- `_id` (ObjectId)
- `length` (number) - File size in bytes
- `chunkSize` (number) - Chunk size (default 255 KiB)
- `uploadDate` (Date)
- `filename` (string)
- `contentType` (string)

**ZoneMTA Custom Fields**
- `date` (Date) - Extracted from email Date header

---

## 5. Delivery Event Hooks & Fields

### sender:delivered Hook
```javascript
app.addHook('sender:delivered', async (delivery, info) => {
  // delivery = envelope object (sender, recipient, zone, custom props)
  // info = MX response info (not fully documented)
});
```

### log:entry Hook
```javascript
app.addHook('log:entry', async (entry) => {
  // entry.action = event type
});
```

### queue:bounce Hook
```javascript
app.addHook('queue:bounce', async (bounce) => {
  // bounce = bounce details (schema not documented)
});
```

### Bounce Notification Webhook (POST fields)
- `id` - Queue ID
- `to` - Recipient address
- `seq` - Recipient sequence ID
- `returnPath` - Sender address
- `category` - Bounce category/reason
- `response` - SMTP error message

**Note**: ZoneMTA docs state hook object fields may have undocumented additions. Use `console.log()` to inspect runtime structures.

---

## 6. GridFS Storage Details

**Message Pipeline**
Incoming connection → MongoDB GridFS (streaming)

**Garbage Collection**
Messages in GridFS without referencing queue entries are auto-deleted (configurable via `disableGC: false`)

**At-Least-Once Delivery**
Messages deleted from queue only after positive MX response

**Locking**
Child processes lock messages during processing; locks auto-release on crash

---

## 7. MongoDB Change Streams Support

**ZoneMTA Documentation**: No explicit mention of change stream support

**General MongoDB Capability**
- Change streams available since MongoDB 3.6
- Requires replica set or sharded cluster (NOT standalone)
- Reads from oplog for real-time notifications
- Supports collection, database, or deployment-wide watches

**Feasibility for Monitoring**
- Can watch `zone-queue` collection for INSERT/UPDATE/DELETE
- Can watch `mail.files` for new messages
- Filter using aggregation pipelines (e.g., `status` changes)
- Resume tokens for fault tolerance

**Implementation Requirement**: MongoDB must be deployed as replica set (minimum 1 primary + 2 secondaries or 1 arbiter)

---

## 8. Status Enumeration

### Queue Status (type label)
- `queued` - Ready for immediate delivery
- `deferred` - Scheduled for retry later

### Delivery Result (result label)
- `delivered` - Accepted by remote MX
- `rejected` - Hard bounce
- `deferred` - Soft bounce (temporary failure)

---

## 9. Integration with WildDuck

**zonemta-wildduck Plugin**
- Uses same `zone-mta` database
- Handles user authentication
- Rewrites headers (From address validation)
- Local delivery via LMTP (bypasses MX for internal users)

**Logging Migration**
Graylog (Gelf) replaced deprecated `messagelog` collection

**WildDuck Database**
Separate `wildduck` database for IMAP/user data; `zone-mta` only for outbound queue

---

## 10. Unresolved Questions

1. **Complete schema for `delivery` object in `sender:delivered` hook** — docs state "might differ from what is listed"
2. **`info` object fields in `sender:delivered`** — not documented
3. **`bounce` object schema in `queue:bounce` hook** — not documented
4. **Additional fields in `zone-queue` beyond confirmed list** (e.g., custom metadata, headers storage)
5. **Index structures** — not documented (critical for query performance)
6. **TTL/expiration policies** on queue documents
7. **Change stream usage examples** for ZoneMTA monitoring

---

## Sources

- [ZoneMTA GitHub Repository](https://github.com/zone-eu/zone-mta)
- [ZoneMTA npm Package](https://www.npmjs.com/package/zone-mta)
- [ZoneMTA Default Config](https://github.com/zone-eu/zone-mta/blob/master/config/default.js)
- [ZoneMTA Plugin Documentation](https://github.com/zone-eu/zone-mta/blob/master/plugins/README.md)
- [ZoneMTA Bounce Notifications](https://github.com/zone-eu/zone-mta/wiki/Receiving-bounce-notifications)
- [ZoneMTA Architecture](https://github.com/zone-eu/zone-mta/wiki/Architecture)
- [zonemta-wildduck Plugin](https://github.com/zone-eu/zonemta-wildduck)
- [MongoDB Change Streams Documentation](https://www.mongodb.com/docs/manual/changestreams/)
- [MongoDB GridFS Specification](https://github.com/mongodb/specifications/blob/master/source/gridfs/gridfs-spec.md)
