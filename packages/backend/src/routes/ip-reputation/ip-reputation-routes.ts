import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { IpReputationQueryService } from "../../services/ip-reputation-query-service.js";
import { DnsblCheckerService } from "../../services/dnsbl-checker-service.js";
import { authHook } from "../../hooks/auth-hook.js";
import { dnsblLists } from "../../db/schema/dnsbl-lists-table.js";
import { eq } from "drizzle-orm";

export default async function ipReputationRoutes(app: FastifyInstance) {
  const reputationService = new IpReputationQueryService(app);
  const dnsblChecker = new DnsblCheckerService(app);

  // GET /api/v1/ip-reputation/summary - Overview stats
  app.get(
    "/summary",
    { onRequest: [authHook] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const summary = await reputationService.getSummary();
      const response: ApiResponse<typeof summary> = {
        success: true,
        data: summary,
      };
      reply.send(response);
    },
  );

  // GET /api/v1/ip-reputation/blacklisted - Currently blacklisted IPs
  app.get(
    "/blacklisted",
    { onRequest: [authHook] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const blacklisted = await reputationService.getBlacklistedIps();
      const response: ApiResponse<typeof blacklisted> = {
        success: true,
        data: blacklisted,
      };
      reply.send(response);
    },
  );

  // GET /api/v1/ip-reputation/heatmap - All IPs color-coded
  app.get(
    "/heatmap",
    { onRequest: [authHook] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const heatmap = await reputationService.getIpStatusHeatmap();
      const response: ApiResponse<typeof heatmap> = {
        success: true,
        data: heatmap,
      };
      reply.send(response);
    },
  );

  // GET /api/v1/ip-reputation/:ip/checks - Check history for specific IP
  app.get<{ Params: { ip: string }; Querystring: { hours?: string } }>(
    "/:ip/checks",
    { onRequest: [authHook] },
    async (request, reply) => {
      const hours = request.query.hours ? parseInt(request.query.hours) : 24;
      const history = await reputationService.getIpCheckHistory(
        request.params.ip,
        hours,
      );
      const response: ApiResponse<typeof history> = {
        success: true,
        data: history,
      };
      reply.send(response);
    },
  );

  // GET /api/v1/ip-reputation/:ip/timeline - Listing/delisting events
  app.get<{ Params: { ip: string }; Querystring: { days?: string } }>(
    "/:ip/timeline",
    { onRequest: [authHook] },
    async (request, reply) => {
      const days = request.query.days ? parseInt(request.query.days) : 7;
      const timeline = await reputationService.getBlacklistTimeline(
        request.params.ip,
        days,
      );
      const response: ApiResponse<typeof timeline> = {
        success: true,
        data: timeline,
      };
      reply.send(response);
    },
  );

  // POST /api/v1/ip-reputation/:ip/check-now - Trigger immediate check
  app.post<{ Params: { ip: string } }>(
    "/:ip/check-now",
    { onRequest: [authHook] },
    async (request, reply) => {
      const { ip } = request.params;

      // Get all enabled DNSBLs
      const dnsbls = await app.db
        .select()
        .from(dnsblLists)
        .where(eq(dnsblLists.enabled, true));

      if (dnsbls.length === 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "NO_DNSBLS",
            message: "No enabled DNSBLs configured",
          },
        });
      }

      // Perform check
      const results = await dnsblChecker.checkIpAgainstDnsbls(
        ip,
        dnsbls.map((d) => ({
          blacklist: d.blacklist,
          tier: d.tier as "critical" | "high" | "medium",
          description: d.description,
        })),
      );

      const response: ApiResponse<typeof results> = {
        success: true,
        data: results,
      };
      reply.send(response);
    },
  );
}
