import { MongoClient, type ChangeStream, type ResumeToken } from "mongodb";
import { readFileSync, writeFileSync } from "node:fs";
import type { EventHttpTransport } from "../transport/event-http-transport.js";

const RESUME_TOKEN_PATH = "/tmp/tinomail-agent-zonemta-resume.json";
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

interface EmailEventPayload {
  time: string;
  eventType: string;
  queueId?: string;
  fromAddress?: string;
  toAddress?: string;
  toDomain?: string;
  mtaNode?: string;
  mxHost?: string;
  statusCode?: number;
  statusMessage?: string;
  deliveryTimeMs?: number;
  bounceType?: string;
  bounceMessage?: string;
}

/** Map ZoneMTA uppercase status to backend event types */
const STATUS_MAP: Record<string, string> = {
  SENT: "delivered",
  BOUNCED: "bounced",
  DEFERRED: "deferred",
};

export class ZonemtaEmailEventCollector {
  private client: MongoClient | null = null;
  private changeStream: ChangeStream | null = null;
  private eventBuffer: EmailEventPayload[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private lastResumeToken: ResumeToken | null = null;
  private reconnectAttempts = 0;
  private isStopping = false;

  constructor(
    private mongoUri: string,
    private nodeId: string,
    private transport: EventHttpTransport
  ) {}

  async connect(): Promise<void> {
    this.client = new MongoClient(this.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await this.client.connect();
    console.info("[ZoneMTA Events] Connected to MongoDB");

    this.lastResumeToken = this.loadResumeToken();
    this.openChangeStream();
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  async disconnect(): Promise<void> {
    this.isStopping = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining events
    await this.flush();

    if (this.changeStream) {
      await this.changeStream.close();
      this.changeStream = null;
    }

    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    console.info("[ZoneMTA Events] Disconnected");
  }

  private openChangeStream(): void {
    if (!this.client) return;

    const collection = this.client.db("zone-mta").collection("zone-queue");

    const pipeline = [
      {
        $match: {
          operationType: { $in: ["update", "replace"] },
          "updateDescription.updatedFields.status": { $exists: true },
        },
      },
    ];

    const options: Record<string, unknown> = {
      fullDocument: "updateLookup" as const,
    };
    if (this.lastResumeToken) {
      options.resumeAfter = this.lastResumeToken;
    }

    this.changeStream = collection.watch(pipeline, options);
    this.reconnectAttempts = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.changeStream.on("change", (change: any) => {
      try {
        this.handleChange(change);
      } catch (err) {
        console.error("[ZoneMTA Events] Error handling change:", err);
      }
    });

    this.changeStream.on("error", (err) => {
      console.error("[ZoneMTA Events] Change stream error:", err);
      this.scheduleReconnect();
    });
  }

  private handleChange(change: Record<string, unknown>): void {
    const fullDocument = change.fullDocument as Record<string, unknown> | null;
    if (!fullDocument) return;

    const status = String(fullDocument.status || "");
    const eventType = STATUS_MAP[status];
    if (!eventType) return;

    const event = this.mapToEmailEvent(fullDocument, eventType);
    this.eventBuffer.push(event);

    // Store resume token from the change event
    if (change._id) {
      this.lastResumeToken = change._id as ResumeToken;
    }

    if (this.eventBuffer.length >= BATCH_SIZE) {
      this.flush();
    }
  }

  private mapToEmailEvent(
    doc: Record<string, unknown>,
    eventType: string
  ): EmailEventPayload {
    const last = doc.last as Date | undefined;
    const first = doc.first as Date | undefined;

    // Parse SMTP status code from response string (e.g., "250 2.0.0 Ok")
    const response = doc.response as string | undefined;
    const statusCode = parseSmtpStatusCode(response);

    // Calculate delivery time if both timestamps exist
    let deliveryTimeMs: number | undefined;
    if (first && last) {
      deliveryTimeMs = last.getTime() - first.getTime();
      if (deliveryTimeMs < 0) deliveryTimeMs = undefined;
    }

    // Validate fromAddress — backend requires valid email format
    const returnPath = doc.returnPath as string | undefined;
    const fromAddress = returnPath && returnPath.includes("@") ? returnPath : undefined;

    // Validate toAddress
    const recipient = doc.recipient as string | undefined;
    const toAddress = recipient && recipient.includes("@") ? recipient : undefined;

    const event: EmailEventPayload = {
      time: last ? last.toISOString() : new Date().toISOString(),
      eventType,
      queueId: doc.id as string | undefined,
      fromAddress,
      toAddress,
      toDomain: doc.domain as string | undefined,
      mtaNode: this.nodeId,
      mxHost: doc.mxHostname as string | undefined,
      statusCode,
      statusMessage: response?.substring(0, 500),
      deliveryTimeMs,
    };

    // Add bounce-specific fields
    if (eventType === "bounced") {
      event.bounceType = "hard";
      event.bounceMessage = response?.substring(0, 500);
    } else if (eventType === "deferred") {
      event.bounceType = "soft";
      event.bounceMessage = response?.substring(0, 500);
    }

    return event;
  }

  private async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const batch = this.eventBuffer.splice(0, this.eventBuffer.length);

    try {
      await this.transport.sendEvents(batch as unknown as Record<string, unknown>[]);
      console.info(`[ZoneMTA Events] Flushed ${batch.length} events`);

      // Persist resume token after successful send
      if (this.lastResumeToken) {
        this.saveResumeToken(this.lastResumeToken);
      }
    } catch (err) {
      console.error("[ZoneMTA Events] Flush failed, re-queuing:", err);
      // Push events back to front of buffer for retry
      this.eventBuffer.unshift(...batch);
    }
  }

  private scheduleReconnect(): void {
    if (this.isStopping) return;

    this.reconnectAttempts++;
    if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `[ZoneMTA Events] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`
      );
      return;
    }

    const backoffMs = Math.min(
      Math.pow(2, this.reconnectAttempts - 1) * 1000,
      30000
    );
    console.info(
      `[ZoneMTA Events] Reconnecting in ${backoffMs}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    );

    setTimeout(() => {
      if (this.isStopping) return;
      try {
        this.openChangeStream();
      } catch (err) {
        console.error("[ZoneMTA Events] Reconnect failed:", err);
        this.scheduleReconnect();
      }
    }, backoffMs);
  }

  private saveResumeToken(token: ResumeToken): void {
    try {
      writeFileSync(RESUME_TOKEN_PATH, JSON.stringify(token), "utf-8");
    } catch (err) {
      console.warn("[ZoneMTA Events] Failed to save resume token:", err);
    }
  }

  private loadResumeToken(): ResumeToken | null {
    try {
      const data = readFileSync(RESUME_TOKEN_PATH, "utf-8");
      return JSON.parse(data) as ResumeToken;
    } catch {
      return null;
    }
  }
}

/** Parse SMTP status code from response string (e.g., "250 2.0.0 Ok" -> 250) */
function parseSmtpStatusCode(response?: string): number | undefined {
  if (!response) return undefined;
  const match = response.match(/^(\d{3})[\s-]/);
  return match ? parseInt(match[1], 10) : undefined;
}
