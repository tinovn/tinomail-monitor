import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ApiResponse } from "@tinomail/shared";
import { agentAuthHook } from "../../hooks/agent-auth-hook.js";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { nodes } from "../../db/schema/nodes-table.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Agent source files to download during update (relative to GitHub raw URL) */
const AGENT_SOURCE_FILES = [
  "index.ts",
  "agent-config.ts",
  "monitoring-agent.ts",
  "self-updater.ts",
  "collectors/system-metrics-collector.ts",
  "collectors/process-health-collector.ts",
  "collectors/mongodb-metrics-collector.ts",
  "collectors/service-auto-discovery-collector.ts",
  "collectors/zonemta-metrics-collector.ts",
  "collectors/redis-metrics-collector.ts",
  "collectors/zonemta-email-event-collector.ts",
  "transport/http-metrics-transport.ts",
  "transport/event-http-transport.ts",
  "transport/offline-metrics-buffer.ts",
];

const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/tinovn/tinomail-monitor/main/packages/agent/src";

interface LatestVersionResponse {
  version: string;
  files: string[];
  githubRawBase: string;
  updateRequested: boolean;
}

const nodeIdQuerySchema = z.object({
  nodeId: z.string().min(1),
});

export default async function agentVersionCheckRoutes(app: FastifyInstance) {
  // GET /api/v1/agents/latest-version?nodeId=db1
  // Agent calls this to check if update is available
  app.get(
    "/latest-version",
    { onRequest: [agentAuthHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { nodeId } = nodeIdQuerySchema.parse(request.query);

      // Read latest agent version from agent package.json (synced via deploy)
      // For simplicity, we read it from the monorepo's agent package.json
      let latestVersion = "0.3.0";
      try {
        // Resolve from monorepo root (process.cwd)
        const pkgPath = resolve(process.cwd(), "packages/agent/package.json");
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        latestVersion = pkg.version || latestVersion;
      } catch {
        // Fallback to hardcoded version
      }

      // Check if admin requested update for this node
      let updateRequested = false;
      try {
        const [node] = await app.db
          .select({ updateRequested: nodes.updateRequested })
          .from(nodes)
          .where(eq(nodes.id, nodeId))
          .limit(1);
        updateRequested = node?.updateRequested ?? false;
      } catch {
        // Ignore DB errors
      }

      const data: LatestVersionResponse = {
        version: latestVersion,
        files: AGENT_SOURCE_FILES,
        githubRawBase: GITHUB_RAW_BASE,
        updateRequested,
      };

      const response: ApiResponse<LatestVersionResponse> = {
        success: true,
        data,
      };
      reply.send(response);
    },
  );

  // POST /api/v1/agents/ack-update?nodeId=db1
  // Agent calls this after successful update to clear the flag
  app.post(
    "/ack-update",
    { onRequest: [agentAuthHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { nodeId } = nodeIdQuerySchema.parse(request.query);

      await app.db
        .update(nodes)
        .set({ updateRequested: false })
        .where(eq(nodes.id, nodeId));

      const response: ApiResponse<{ acknowledged: boolean }> = {
        success: true,
        data: { acknowledged: true },
      };
      reply.send(response);
    },
  );
}
