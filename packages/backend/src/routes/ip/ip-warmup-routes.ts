import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { eq } from "drizzle-orm";
import { sendingIps } from "../../db/schema/sending-ips-table.js";
import { updateIpWarmupSchema, addIpRangeSchema } from "../../schemas/ip-validation-schemas.js";
import { authHook } from "../../hooks/auth-hook.js";

export default async function ipWarmupRoutes(app: FastifyInstance) {
  // PUT /api/v1/ips/:ip/warmup - Update IP warmup configuration
  app.put<{ Params: { ip: string } }>(
    "/:ip/warmup",
    { onRequest: [authHook] },
    async (request, reply) => {
      const body = updateIpWarmupSchema.parse(request.body);

      const updateData: {
        warmupStart?: string;
        warmupDay?: number;
        dailyLimit?: number;
        updatedAt: Date;
      } = { updatedAt: new Date() };

      if (body.warmupStart) {
        updateData.warmupStart = body.warmupStart;
      }
      if (body.warmupDay !== undefined) {
        updateData.warmupDay = body.warmupDay;
      }
      if (body.dailyLimit !== undefined) {
        updateData.dailyLimit = body.dailyLimit;
      }

      const [updated] = await app.db
        .update(sendingIps)
        .set(updateData)
        .where(eq(sendingIps.ip, request.params.ip))
        .returning();

      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "IP address not found",
          },
        });
      }

      const response: ApiResponse<typeof updated> = {
        success: true,
        data: updated,
      };
      reply.send(response);
    }
  );

  // POST /api/v1/ips/range - Add IP range from CIDR notation
  app.post(
    "/range",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = addIpRangeSchema.parse(request.body);

      // Parse CIDR (e.g., "192.168.1.0/24")
      const cidrParts = body.cidr.split("/");
      if (cidrParts.length !== 2) {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_CIDR", message: "CIDR must be in IP/prefix format (e.g., 192.168.1.0/24)" },
        });
      }
      const [baseIp, prefixStr] = cidrParts;
      const prefix = parseInt(prefixStr, 10);

      if (isNaN(prefix) || prefix > 32 || prefix < 8) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_CIDR",
            message: "CIDR prefix must be between /8 and /32",
          },
        });
      }

      // Calculate IP range
      const baseOctets = baseIp.split(".").map((o) => parseInt(o, 10));
      if (baseOctets.length !== 4 || baseOctets.some(isNaN)) {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_CIDR", message: "Invalid IP address in CIDR notation" },
        });
      }
      const hostBits = 32 - prefix;
      const numIps = Math.pow(2, hostBits) - 2; // Exclude network and broadcast

      if (numIps > 1000) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "RANGE_TOO_LARGE",
            message: "IP range too large. Maximum 1000 IPs per request.",
          },
        });
      }

      // Generate IP addresses
      const ips = [];
      for (let i = 1; i <= numIps; i++) {
        const offset = i;
        const ip = [
          baseOctets[0] + Math.floor(offset / (256 ** 3)),
          Math.floor(offset / (256 ** 2)) % 256,
          Math.floor(offset / 256) % 256,
          offset % 256,
        ].join(".");
        ips.push(ip);
      }

      // Insert into database
      const inserted = [];
      for (const ip of ips) {
        try {
          const [result] = await app.db
            .insert(sendingIps)
            .values({
              ip,
              ipVersion: 4,
              nodeId: body.nodeId,
              subnet: body.subnet || body.cidr,
              status: "active",
              warmupDay: 0,
              currentDailySent: 0,
              blacklistCount: 0,
              reputationScore: 50,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoNothing()
            .returning();

          if (result) inserted.push(result);
        } catch (error) {
          app.log.error({ error, ip }, "Failed to insert IP");
        }
      }

      const response: ApiResponse<{ inserted: number; total: number }> = {
        success: true,
        data: {
          inserted: inserted.length,
          total: ips.length,
        },
      };
      reply.send(response);
    }
  );
}
