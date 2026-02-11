import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { z } from "zod";
import { authHook } from "../../hooks/auth-hook.js";

const timeRangeQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** Pick interval based on time range */
function pickInterval(fromDate: Date, toDate: Date): "5 minutes" | "1 hour" | "1 day" {
  const rangeHours = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60);
  if (rangeHours < 6) return "5 minutes";
  if (rangeHours <= 168) return "1 hour";
  return "1 day";
}

export default async function dashboardMetricsRoutes(app: FastifyInstance) {
  // GET /api/v1/metrics/email-throughput - Time-series throughput for overview chart
  app.get(
    "/email-throughput",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = timeRangeQuerySchema.parse(request.query);
      const fromIso = query.from;
      const toIso = query.to;
      const interval = pickInterval(new Date(fromIso), new Date(toIso));

      let data;
      if (interval === "5 minutes") {
        data = await app.sql`
          SELECT
            time_bucket('5 minutes', time) AS time,
            COUNT(*) FILTER (WHERE event_type = 'delivered')::int AS delivered,
            COUNT(*) FILTER (WHERE event_type = 'deferred')::int AS deferred,
            COUNT(*) FILTER (WHERE event_type = 'bounced')::int AS bounced
          FROM email_events
          WHERE time >= ${fromIso}::timestamptz AND time <= ${toIso}::timestamptz
          GROUP BY 1
          ORDER BY 1 ASC
        `;
      } else if (interval === "1 hour") {
        data = await app.sql`
          SELECT
            time_bucket('1 hour', time) AS time,
            COUNT(*) FILTER (WHERE event_type = 'delivered')::int AS delivered,
            COUNT(*) FILTER (WHERE event_type = 'deferred')::int AS deferred,
            COUNT(*) FILTER (WHERE event_type = 'bounced')::int AS bounced
          FROM email_events
          WHERE time >= ${fromIso}::timestamptz AND time <= ${toIso}::timestamptz
          GROUP BY 1
          ORDER BY 1 ASC
        `;
      } else {
        data = await app.sql`
          SELECT
            time_bucket('1 day', time) AS time,
            COUNT(*) FILTER (WHERE event_type = 'delivered')::int AS delivered,
            COUNT(*) FILTER (WHERE event_type = 'deferred')::int AS deferred,
            COUNT(*) FILTER (WHERE event_type = 'bounced')::int AS bounced
          FROM email_events
          WHERE time >= ${fromIso}::timestamptz AND time <= ${toIso}::timestamptz
          GROUP BY 1
          ORDER BY 1 ASC
        `;
      }

      const response: ApiResponse<typeof data> = { success: true, data };
      reply.send(response);
    },
  );

  // GET /api/v1/metrics/bounce-rate - Bounce rate trend for overview chart
  app.get(
    "/bounce-rate",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = timeRangeQuerySchema.parse(request.query);
      const fromIso = query.from;
      const toIso = query.to;
      const interval = pickInterval(new Date(fromIso), new Date(toIso));

      let rawData;
      if (interval === "5 minutes") {
        rawData = await app.sql`
          SELECT
            time_bucket('5 minutes', time) AS time,
            CASE WHEN COUNT(*) > 0
              THEN (COUNT(*) FILTER (WHERE event_type = 'bounced')::float / COUNT(*) * 100)
              ELSE 0
            END AS bounce_rate
          FROM email_events
          WHERE time >= ${fromIso}::timestamptz AND time <= ${toIso}::timestamptz
          GROUP BY 1
          ORDER BY 1 ASC
        `;
      } else if (interval === "1 hour") {
        rawData = await app.sql`
          SELECT
            time_bucket('1 hour', time) AS time,
            CASE WHEN COUNT(*) > 0
              THEN (COUNT(*) FILTER (WHERE event_type = 'bounced')::float / COUNT(*) * 100)
              ELSE 0
            END AS bounce_rate
          FROM email_events
          WHERE time >= ${fromIso}::timestamptz AND time <= ${toIso}::timestamptz
          GROUP BY 1
          ORDER BY 1 ASC
        `;
      } else {
        rawData = await app.sql`
          SELECT
            time_bucket('1 day', time) AS time,
            CASE WHEN COUNT(*) > 0
              THEN (COUNT(*) FILTER (WHERE event_type = 'bounced')::float / COUNT(*) * 100)
              ELSE 0
            END AS bounce_rate
          FROM email_events
          WHERE time >= ${fromIso}::timestamptz AND time <= ${toIso}::timestamptz
          GROUP BY 1
          ORDER BY 1 ASC
        `;
      }

      const data = rawData.map((row: Record<string, unknown>) => ({
        time: row.time,
        bounceRate: Number(row.bounce_rate) || 0,
      }));

      const response: ApiResponse<typeof data> = { success: true, data };
      reply.send(response);
    },
  );

  // GET /api/v1/metrics/top-domains - Top sending domains for overview chart
  app.get(
    "/top-domains",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = timeRangeQuerySchema.parse(request.query);
      const fromIso = query.from;
      const toIso = query.to;
      const limit = query.limit || 10;

      const data = await app.sql`
        SELECT
          from_domain AS domain,
          COUNT(*)::int AS count
        FROM email_events
        WHERE time >= ${fromIso}::timestamptz AND time <= ${toIso}::timestamptz
        GROUP BY from_domain
        ORDER BY count DESC
        LIMIT ${limit}
      `;

      const response: ApiResponse<typeof data> = { success: true, data };
      reply.send(response);
    },
  );
}
