import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { authHook } from "../../hooks/auth-hook.js";

interface HeatmapQueryParams {
  metric: string;
  from?: string;
  to?: string;
  bucket?: string;
}

interface HeatmapDataPoint {
  nodeId: string;
  bucket: Date;
  value: number;
}

export default async function nodeHeatmapRoutes(app: FastifyInstance) {
  app.get<{ Querystring: HeatmapQueryParams }>(
    "/",
    { onRequest: [authHook] },
    async (request: FastifyRequest<{ Querystring: HeatmapQueryParams }>, reply: FastifyReply) => {
      const { metric, from, to, bucket = "1h" } = request.query;

      if (!metric) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_PARAMS",
            message: "metric parameter is required",
          },
        });
      }

      const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to) : new Date();

      // Map metric to database column
      const metricColumnMap: Record<string, string> = {
        cpu: "cpu_percent",
        ram: "ram_percent",
        disk: "disk_percent",
        load: "load_1m",
      };

      const column = metricColumnMap[metric];
      if (!column) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_METRIC",
            message: `Invalid metric. Valid options: ${Object.keys(metricColumnMap).join(", ")}`,
          },
        });
      }

      // Parse bucket interval (default 1h)
      const bucketInterval = bucket || "1h";

      const data = await app.sql<HeatmapDataPoint[]>`
        SELECT
          node_id as "nodeId",
          time_bucket(${bucketInterval}::interval, time) as bucket,
          AVG(${app.sql(column)})::numeric(10,2) as value
        FROM metrics_system
        WHERE time >= ${fromDate}
          AND time <= ${toDate}
        GROUP BY node_id, bucket
        ORDER BY bucket ASC, node_id ASC
      `;

      const response: ApiResponse<HeatmapDataPoint[]> = {
        success: true,
        data,
      };
      reply.send(response);
    },
  );
}
