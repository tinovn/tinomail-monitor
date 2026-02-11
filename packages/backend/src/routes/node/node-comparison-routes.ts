import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { authHook } from "../../hooks/auth-hook.js";

interface ComparisonQueryParams {
  nodes: string;
  metric: string;
  from?: string;
  to?: string;
}

interface ComparisonDataPoint {
  time: Date;
  nodeId: string;
  value: number;
}

export default async function nodeComparisonRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ComparisonQueryParams }>(
    "/",
    { onRequest: [authHook] },
    async (request: FastifyRequest<{ Querystring: ComparisonQueryParams }>, reply: FastifyReply) => {
      const { nodes, metric, from, to } = request.query;

      if (!nodes || !metric) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_PARAMS",
            message: "nodes and metric parameters are required",
          },
        });
      }

      const nodeIds = nodes.split(",").map((id) => id.trim());
      const fromDate = from ? new Date(from) : new Date(Date.now() - 6 * 60 * 60 * 1000);
      const toDate = to ? new Date(to) : new Date();

      // Map metric to database column
      const metricColumnMap: Record<string, string> = {
        cpu: "cpu_percent",
        ram: "ram_percent",
        disk: "disk_percent",
        load: "load_1m",
        network_rx: "net_rx_bytes_sec",
        network_tx: "net_tx_bytes_sec",
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

      const data = await app.sql<ComparisonDataPoint[]>`
        SELECT
          time,
          node_id as "nodeId",
          ${app.sql(column)} as value
        FROM metrics_system
        WHERE node_id = ANY(${nodeIds})
          AND time >= ${fromDate}
          AND time <= ${toDate}
        ORDER BY time ASC
      `;

      const response: ApiResponse<ComparisonDataPoint[]> = {
        success: true,
        data,
      };
      reply.send(response);
    },
  );
}
