import type { FastifyInstance } from "fastify";
import { eq, asc } from "drizzle-orm";
import { emailEvents } from "../db/schema/email-events-hypertable.js";

export class MessageTraceQueryService {
  constructor(private app: FastifyInstance) {}

  /**
   * Trace email lifecycle by message ID
   * Returns all events for a given message in chronological order
   */
  async traceByMessageId(messageId: string) {
    const events = await this.app.db
      .select()
      .from(emailEvents)
      .where(eq(emailEvents.messageId, messageId))
      .orderBy(asc(emailEvents.time));

    return events;
  }

  /**
   * Trace email by queue ID (fallback when message ID unavailable)
   * Returns all events for a given queue ID
   */
  async traceByQueueId(queueId: string) {
    const events = await this.app.db
      .select()
      .from(emailEvents)
      .where(eq(emailEvents.queueId, queueId))
      .orderBy(asc(emailEvents.time));

    return events;
  }
}
