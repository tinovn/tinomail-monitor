import type { FastifyInstance } from "fastify";
import { sql, and, gte, lte, ilike, inArray, between } from "drizzle-orm";
import { emailEvents } from "../db/schema/email-events-hypertable.js";
import type { LogSearchQuery } from "../schemas/log-search-validation-schemas.js";

interface SearchResult {
  rows: any[];
  hasMore: boolean;
  cursor: string | null;
}

export class EmailEventSearchQueryService {
  constructor(private app: FastifyInstance) {}

  /**
   * Advanced search for email events with multiple filters
   * Supports cursor-based pagination
   */
  async searchEmailEvents(filters: LogSearchQuery): Promise<SearchResult> {
    const conditions: any[] = [];

    // Time range
    const from = filters.from ? new Date(filters.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = filters.to ? new Date(filters.to) : new Date();
    conditions.push(gte(emailEvents.time, from));
    conditions.push(lte(emailEvents.time, to));

    // Event type filter
    if (filters.eventType && filters.eventType.length > 0) {
      conditions.push(inArray(emailEvents.eventType, filters.eventType));
    }

    // Address filters (ILIKE for partial match)
    if (filters.fromAddress) {
      conditions.push(ilike(emailEvents.fromAddress, `%${filters.fromAddress}%`));
    }
    if (filters.toAddress) {
      conditions.push(ilike(emailEvents.toAddress, `%${filters.toAddress}%`));
    }

    // Domain filters
    if (filters.fromDomain) {
      conditions.push(ilike(emailEvents.fromDomain, `%${filters.fromDomain}%`));
    }
    if (filters.toDomain) {
      conditions.push(ilike(emailEvents.toDomain, `%${filters.toDomain}%`));
    }

    // MTA node filter
    if (filters.mtaNode && filters.mtaNode.length > 0) {
      conditions.push(inArray(emailEvents.mtaNode, filters.mtaNode));
    }

    // Sending IP filter
    if (filters.sendingIp) {
      conditions.push(ilike(emailEvents.sendingIp, `%${filters.sendingIp}%`));
    }

    // Message ID filter
    if (filters.messageId) {
      conditions.push(ilike(emailEvents.messageId, `%${filters.messageId}%`));
    }

    // Queue ID filter
    if (filters.queueId) {
      conditions.push(ilike(emailEvents.queueId, `%${filters.queueId}%`));
    }

    // Status code range
    if (filters.statusCodeMin !== undefined && filters.statusCodeMax !== undefined) {
      conditions.push(
        between(emailEvents.statusCode, filters.statusCodeMin, filters.statusCodeMax)
      );
    } else if (filters.statusCodeMin !== undefined) {
      conditions.push(gte(emailEvents.statusCode, filters.statusCodeMin));
    } else if (filters.statusCodeMax !== undefined) {
      conditions.push(lte(emailEvents.statusCode, filters.statusCodeMax));
    }

    // Bounce type filter
    if (filters.bounceType) {
      conditions.push(ilike(emailEvents.bounceType, `%${filters.bounceType}%`));
    }

    // Full-text search in status/bounce messages
    if (filters.searchText) {
      conditions.push(
        sql`(${emailEvents.statusMessage} ILIKE ${`%${filters.searchText}%`} OR ${emailEvents.bounceMessage} ILIKE ${`%${filters.searchText}%`})`
      );
    }

    // Cursor-based pagination
    if (filters.cursor) {
      const cursorTime = new Date(filters.cursor);
      conditions.push(lte(emailEvents.time, cursorTime));
    }

    // Fetch limit + 1 to detect hasMore
    const limit = filters.limit || 50;
    const results = await this.app.db
      .select()
      .from(emailEvents)
      .where(and(...conditions))
      .orderBy(sql`${emailEvents.time} DESC`)
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const rows = hasMore ? results.slice(0, limit) : results;
    const cursor = hasMore && rows.length > 0 ? rows[rows.length - 1].time.toISOString() : null;

    return { rows, hasMore, cursor };
  }
}
