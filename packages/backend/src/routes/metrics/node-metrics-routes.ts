import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { z } from "zod";
import { authHook } from "../../hooks/auth-hook.js";

const nodeTimeRangeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

const nodeParamsSchema = z.object({
  nodeId: z.string().min(1),
});

export default async function nodeMetricsRoutes(app: FastifyInstance) {
  // GET /api/v1/metrics/node/:nodeId/cpu
  app.get(
    "/node/:nodeId/cpu",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { nodeId } = nodeParamsSchema.parse(request.params);
      const { from, to } = nodeTimeRangeSchema.parse(request.query);

      const rows = await app.sql`
        SELECT
          time,
          cpu_percent AS value
        FROM metrics_system
        WHERE node_id = ${nodeId}
          AND time >= ${from}::timestamptz
          AND time <= ${to}::timestamptz
        ORDER BY time ASC
      `;

      const data = rows.map((r: Record<string, unknown>) => ({
        time: new Date(r.time as string | Date).toISOString(),
        value: Number(r.value) || 0,
      }));

      const response: ApiResponse<typeof data> = { success: true, data };
      reply.send(response);
    },
  );

  // GET /api/v1/metrics/node/:nodeId/ram
  app.get(
    "/node/:nodeId/ram",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { nodeId } = nodeParamsSchema.parse(request.params);
      const { from, to } = nodeTimeRangeSchema.parse(request.query);

      const rows = await app.sql`
        SELECT
          time,
          ram_percent,
          ram_used_bytes
        FROM metrics_system
        WHERE node_id = ${nodeId}
          AND time >= ${from}::timestamptz
          AND time <= ${to}::timestamptz
        ORDER BY time ASC
      `;

      const data = rows.map((r: Record<string, unknown>) => ({
        time: new Date(r.time as string | Date).toISOString(),
        usedPercent: Number(r.ram_percent) || 0,
        freePercent: Math.round((100 - (Number(r.ram_percent) || 0)) * 10) / 10,
        ramUsedBytes: Number(r.ram_used_bytes) || null,
      }));

      const response: ApiResponse<typeof data> = { success: true, data };
      reply.send(response);
    },
  );

  // GET /api/v1/metrics/node/:nodeId/disk
  app.get(
    "/node/:nodeId/disk",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { nodeId } = nodeParamsSchema.parse(request.params);

      // Get latest disk metrics for this node
      const rows = await app.sql`
        SELECT
          disk_percent,
          disk_free_bytes
        FROM metrics_system
        WHERE node_id = ${nodeId}
        ORDER BY time DESC
        LIMIT 1
      `;

      let data: { partition: string; usedPercent: number; total: number }[] = [];
      if (rows.length > 0) {
        const row = rows[0] as Record<string, unknown>;
        const usedPercent = Number(row.disk_percent) || 0;
        const freeBytes = Number(row.disk_free_bytes) || 0;
        const totalBytes = freeBytes > 0 && usedPercent < 100
          ? Math.round(freeBytes / ((100 - usedPercent) / 100))
          : 0;
        data = [{ partition: "All Disks", usedPercent, total: totalBytes }];
      }

      const response: ApiResponse<typeof data> = { success: true, data };
      reply.send(response);
    },
  );

  // GET /api/v1/metrics/node/:nodeId/network
  app.get(
    "/node/:nodeId/network",
    { onRequest: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { nodeId } = nodeParamsSchema.parse(request.params);
      const { from, to } = nodeTimeRangeSchema.parse(request.query);

      const rows = await app.sql`
        SELECT
          time,
          net_rx_bytes_sec,
          net_tx_bytes_sec
        FROM metrics_system
        WHERE node_id = ${nodeId}
          AND time >= ${from}::timestamptz
          AND time <= ${to}::timestamptz
        ORDER BY time ASC
      `;

      const data = rows.map((r: Record<string, unknown>) => ({
        time: new Date(r.time as string | Date).toISOString(),
        rxBytesPerSec: Number(r.net_rx_bytes_sec) || 0,
        txBytesPerSec: Number(r.net_tx_bytes_sec) || 0,
      }));

      const response: ApiResponse<typeof data> = { success: true, data };
      reply.send(response);
    },
  );
}
