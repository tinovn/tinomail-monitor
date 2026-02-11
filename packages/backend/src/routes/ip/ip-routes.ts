import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { IpService } from "../../services/ip-service.js";
import { updateIpStatusSchema, bulkIpActionSchema } from "../../schemas/ip-validation-schemas.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function ipRoutes(app: FastifyInstance) {
  const ipService = new IpService(app);

  // GET /api/v1/ips - Get all IPs (requires auth)
  app.get("/", { onRequest: [authHook] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const ips = await ipService.getIps();
    const response: ApiResponse<typeof ips> = {
      success: true,
      data: ips,
    };
    reply.send(response);
  });

  // GET /api/v1/ips/:ip - Get IP by address (requires auth)
  app.get<{ Params: { ip: string } }>(
    "/:ip",
    { onRequest: [authHook] },
    async (request, reply) => {
      const ip = await ipService.getIpByAddress(request.params.ip);

      if (!ip) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "IP address not found",
          },
        });
      }

      const response: ApiResponse<typeof ip> = {
        success: true,
        data: ip,
      };
      reply.send(response);
    },
  );

  // PUT /api/v1/ips/:ip/status - Update IP status (requires auth)
  app.put<{ Params: { ip: string } }>(
    "/:ip/status",
    { onRequest: [authHook] },
    async (request, reply) => {
      const body = updateIpStatusSchema.parse(request.body);
      const ip = await ipService.updateIpStatus(request.params.ip, body.status, body.notes);

      if (!ip) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "IP address not found",
          },
        });
      }

      const response: ApiResponse<typeof ip> = {
        success: true,
        data: ip,
      };
      reply.send(response);
    },
  );

  // POST /api/v1/ips/bulk-action - Bulk IP action (requires auth)
  app.post("/bulk-action", { onRequest: [authHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = bulkIpActionSchema.parse(request.body);

    const statusMap: Record<string, string> = {
      activate: "active",
      pause: "paused",
      quarantine: "quarantine",
      retire: "retired",
    };

    const count = await ipService.bulkUpdateStatus(body.ips, statusMap[body.action], body.notes);

    const response: ApiResponse<{ updated: number }> = {
      success: true,
      data: { updated: count },
    };
    reply.send(response);
  });
}
