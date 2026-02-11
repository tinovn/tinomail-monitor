import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { z } from "zod";
import { EmailThroughputQueryService } from "../../services/email-throughput-query-service.js";

const throughputQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  by: z.enum(["node", "domain", "event_type"]).optional(),
});

const statsQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  groupBy: z.enum(["from_domain", "to_domain", "mta_node", "event_type"]),
});

const bounceAnalysisQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export default async function emailThroughputRoutes(app: FastifyInstance) {
  const throughputService = new EmailThroughputQueryService(app);

  // GET /api/v1/email/throughput
  app.get(
    "/throughput",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = throughputQuerySchema.parse(request.query);

      const data = await throughputService.getThroughput({
        from: new Date(query.from),
        to: new Date(query.to),
        groupBy: query.by,
      });

      const response: ApiResponse<any> = {
        success: true,
        data,
      };

      reply.send(response);
    }
  );

  // GET /api/v1/email/stats
  app.get("/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = statsQuerySchema.parse(request.query);

    const data = await throughputService.getStats({
      from: new Date(query.from),
      to: new Date(query.to),
      groupBy: query.groupBy,
    });

    const response: ApiResponse<any> = {
      success: true,
      data,
    };

    reply.send(response);
  });

  // GET /api/v1/email/bounce-analysis
  app.get(
    "/bounce-analysis",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = bounceAnalysisQuerySchema.parse(request.query);

      const data = await throughputService.getBounceAnalysis({
        from: new Date(query.from),
        to: new Date(query.to),
      });

      const response: ApiResponse<any> = {
        success: true,
        data,
      };

      reply.send(response);
    }
  );
}
