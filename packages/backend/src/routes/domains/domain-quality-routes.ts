import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { DomainHealthScoreService } from "../../services/domain-health-score-service.js";
import { DomainDnsCheckService } from "../../services/domain-dns-check-service.js";
import { domainStatsQuerySchema, domainParamsSchema, domainListQuerySchema } from "../../schemas/domain-validation-schemas.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function domainQualityRoutes(app: FastifyInstance) {
  const domainHealthService = new DomainHealthScoreService(app);
  const domainDnsCheckService = new DomainDnsCheckService(app);

  // GET /api/v1/domains - List sending domains with health scores (paginated)
  app.get("/", { onRequest: [authHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = domainListQuerySchema.parse(request.query);
    const allDomains = await domainHealthService.getDomainsWithHealthScores();

    // Filter by search term
    let filtered = allDomains;
    if (query.search) {
      const term = query.search.toLowerCase();
      filtered = allDomains.filter((d) => d.domain.toLowerCase().includes(term));
    }

    // Sort
    if (query.sortBy) {
      const dir = query.sortOrder === "desc" ? -1 : 1;
      filtered.sort((a, b) => {
        const aVal = a[query.sortBy!];
        const bVal = b[query.sortBy!];
        if (typeof aVal === "string") return dir * aVal.localeCompare(bVal as string);
        return dir * ((aVal as number) - (bVal as number));
      });
    }

    // Paginate
    const total = filtered.length;
    const offset = (query.page - 1) * query.limit;
    const paginated = filtered.slice(offset, offset + query.limit);

    const response: ApiResponse<{
      domains: typeof paginated;
      pagination: { page: number; limit: number; total: number; pages: number };
    }> = {
      success: true,
      data: {
        domains: paginated,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.ceil(total / query.limit),
        },
      },
    };
    reply.send(response);
  });

  // GET /api/v1/domains/:domain - Get domain detail
  app.get<{ Params: { domain: string } }>(
    "/:domain",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { domain } = domainParamsSchema.parse(request.params);
      const domains = await domainHealthService.getDomainsWithHealthScores();
      const domainData = domains.find((d) => d.domain === domain);

      if (!domainData) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Domain not found",
          },
        });
      }

      const response: ApiResponse<typeof domainData> = {
        success: true,
        data: domainData,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/domains/:domain/stats - Get domain stats over time
  app.get<{ Params: { domain: string }; Querystring: { from?: string; to?: string } }>(
    "/:domain/stats",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { domain } = domainParamsSchema.parse(request.params);
      const query = domainStatsQuerySchema.parse(request.query);

      const stats = await domainHealthService.getDomainStats(
        domain,
        new Date(query.from),
        new Date(query.to)
      );

      const response: ApiResponse<typeof stats> = {
        success: true,
        data: stats,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/domains/:domain/dns-check - Live DNS check for SPF, DKIM, DMARC
  app.get<{ Params: { domain: string } }>(
    "/:domain/dns-check",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { domain } = domainParamsSchema.parse(request.params);
      const dnsCheck = await domainDnsCheckService.checkDomain(domain);

      const response: ApiResponse<typeof dnsCheck> = {
        success: true,
        data: dnsCheck,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/domains/:domain/destinations - Per-destination stats from this sending domain
  app.get<{ Params: { domain: string }; Querystring: { from?: string; to?: string; limit?: number } }>(
    "/:domain/destinations",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { domain } = domainParamsSchema.parse(request.params);
      const query = domainStatsQuerySchema.parse(request.query);
      const limit = request.query.limit || 20;

      const destinations = await domainHealthService.getDomainDestinations(
        domain,
        new Date(query.from),
        new Date(query.to),
        limit
      );

      const response: ApiResponse<typeof destinations> = {
        success: true,
        data: destinations,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/domains/:domain/sending-pattern - Hourly sending pattern heatmap
  app.get<{ Params: { domain: string }; Querystring: { from?: string; to?: string } }>(
    "/:domain/sending-pattern",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { domain } = domainParamsSchema.parse(request.params);
      const query = domainStatsQuerySchema.parse(request.query);

      const fromIso = new Date(query.from).toISOString();
      const toIso = new Date(query.to).toISOString();

      const data = await app.sql`
        SELECT
          EXTRACT(HOUR FROM time)::int AS hour,
          EXTRACT(DOW FROM time)::int AS weekday,
          COUNT(*)::int AS value
        FROM email_events
        WHERE from_domain = ${domain}
          AND time >= ${fromIso}::timestamptz
          AND time <= ${toIso}::timestamptz
        GROUP BY hour, weekday
        ORDER BY weekday, hour
      `;

      const response: ApiResponse<typeof data> = {
        success: true,
        data,
      };
      reply.send(response);
    }
  );

  // GET /api/v1/domains/:domain/senders - Top senders (from_user) in this domain
  app.get<{ Params: { domain: string }; Querystring: { from?: string; to?: string; limit?: number } }>(
    "/:domain/senders",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { domain } = domainParamsSchema.parse(request.params);
      const query = domainStatsQuerySchema.parse(request.query);
      const limit = request.query.limit || 20;

      const senders = await domainHealthService.getDomainTopSenders(
        domain,
        new Date(query.from),
        new Date(query.to),
        limit
      );

      const response: ApiResponse<typeof senders> = {
        success: true,
        data: senders,
      };
      reply.send(response);
    }
  );
}
