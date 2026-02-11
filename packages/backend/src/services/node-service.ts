import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { nodes } from "../db/schema/nodes-table.js";
import type { Node, NodeRegistrationPayload } from "@tinomail/shared";

export class NodeService {
  constructor(private app: FastifyInstance) {}

  async registerNode(payload: NodeRegistrationPayload): Promise<Node | "blocked"> {
    const now = new Date();

    // Check if node already exists
    const existing = await this.app.db
      .select()
      .from(nodes)
      .where(eq(nodes.id, payload.nodeId))
      .limit(1);

    const agentVersion = (payload.metadata?.agentVersion as string) || null;

    if (existing.length > 0) {
      // Reject registration if node is blocked
      if (existing[0].status === "blocked") return "blocked";

      // Update existing node
      const [updated] = await this.app.db
        .update(nodes)
        .set({
          hostname: payload.hostname,
          ipAddress: payload.ipAddress,
          role: payload.role,
          lastSeen: now,
          metadata: payload.metadata,
          agentVersion,
        })
        .where(eq(nodes.id, payload.nodeId))
        .returning();
      return updated as Node;
    }

    // Insert new node
    const [newNode] = await this.app.db
      .insert(nodes)
      .values({
        id: payload.nodeId,
        hostname: payload.hostname,
        ipAddress: payload.ipAddress,
        role: payload.role,
        status: "active",
        registeredAt: now,
        lastSeen: now,
        metadata: payload.metadata,
        agentVersion,
      })
      .returning();

    return newNode as Node;
  }

  async updateLastSeen(nodeId: string): Promise<void> {
    await this.app.db
      .update(nodes)
      .set({ lastSeen: new Date() })
      .where(eq(nodes.id, nodeId));
  }

  async getNodes(): Promise<Node[]> {
    const result = await this.app.db.select().from(nodes);
    return result as Node[];
  }

  async getNodeById(nodeId: string): Promise<Node | null> {
    const [node] = await this.app.db
      .select()
      .from(nodes)
      .where(eq(nodes.id, nodeId))
      .limit(1);
    return node ? (node as Node) : null;
  }

  async setMaintenance(nodeId: string, maintenance: boolean): Promise<Node | null> {
    const [updated] = await this.app.db
      .update(nodes)
      .set({ status: maintenance ? "maintenance" : "active" })
      .where(eq(nodes.id, nodeId))
      .returning();
    return updated ? (updated as Node) : null;
  }

  async deleteNode(nodeId: string): Promise<boolean> {
    const [deleted] = await this.app.db
      .delete(nodes)
      .where(eq(nodes.id, nodeId))
      .returning({ id: nodes.id });
    return !!deleted;
  }

  async setBlocked(nodeId: string, blocked: boolean): Promise<Node | null> {
    const [updated] = await this.app.db
      .update(nodes)
      .set({ status: blocked ? "blocked" : "active" })
      .where(eq(nodes.id, nodeId))
      .returning();
    return updated ? (updated as Node) : null;
  }

  async getNodesWithLatestMetrics(): Promise<Array<Node & {
    cpuPercent?: number | null;
    ramPercent?: number | null;
    diskPercent?: number | null;
    ramUsedBytes?: number | null;
    diskFreeBytes?: number | null;
    load1m?: number | null;
  }>> {
    // Get all nodes
    const allNodes = await this.app.db.select().from(nodes);

    // Get latest metrics for each node using postgres.js
    const latestMetrics = await this.app.sql`
      SELECT DISTINCT ON (node_id)
        node_id,
        cpu_percent,
        ram_percent,
        ram_used_bytes,
        disk_percent,
        disk_free_bytes,
        load_1m
      FROM metrics_system
      ORDER BY node_id, time DESC
    `;

    // Create a map of node_id to metrics
    const metricsMap = new Map<string, typeof latestMetrics[0]>();
    for (const metric of latestMetrics) {
      metricsMap.set(metric.node_id as string, metric);
    }

    // Merge nodes with their latest metrics
    return allNodes.map((node) => {
      const metrics = metricsMap.get(node.id);
      return {
        ...(node as Node),
        cpuPercent: metrics?.cpu_percent ?? null,
        ramPercent: metrics?.ram_percent ?? null,
        diskPercent: metrics?.disk_percent ?? null,
        ramUsedBytes: metrics?.ram_used_bytes ?? null,
        diskFreeBytes: metrics?.disk_free_bytes ?? null,
        load1m: metrics?.load_1m ?? null,
      };
    });
  }
}
