import type { MongodbMetrics, MongodbReplEvent } from "@tinomail/shared";
import { MongoClient } from "mongodb";
import {
  extractWiredTigerPressure,
  type ServerStatus,
} from "./mongodb-wiredtiger-pressure-collector.js";
import { collectConnectionBreakdown } from "./mongodb-connection-source-breakdown-collector.js";
import { collectGridfsBreakdown } from "./mongodb-gridfs-collection-size-collector.js";
import { MongodbReplEventDetector } from "./mongodb-repl-event-detector.js";
import {
  getOplogWindow,
  getAggregatedDbStats,
} from "./mongodb-member-connection-and-oplog-helpers.js";

interface ReplicaSetMember {
  name: string;
  stateStr: string;
  optimeDate?: Date;
}

interface ReplicaSetStatus {
  members: ReplicaSetMember[];
  myState: number;
  date: Date;
}

export class MongodbMetricsCollector {
  private primaryClient: MongoClient | null = null;
  private memberClients: Map<string, MongoClient> = new Map();
  private eventDetector = new MongodbReplEventDetector();

  constructor(private mongoUri: string) {}

  async connect(): Promise<void> {
    try {
      this.primaryClient = new MongoClient(this.mongoUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      await this.primaryClient.connect();
      console.info("[MongoDB Collector] Connected to primary");
    } catch (error) {
      console.error("[MongoDB Collector] Failed to connect:", error);
      throw error;
    }
  }

  /** Collect metrics + replica set events in a single pass. */
  async collectAllWithEvents(): Promise<{ metrics: MongodbMetrics[]; events: MongodbReplEvent[] }> {
    if (!this.primaryClient) throw new Error("MongoDB client not connected");

    const metrics: MongodbMetrics[] = [];
    const now = new Date();
    const admin = this.primaryClient.db("admin");
    const rsStatus = (await admin.command({ replSetGetStatus: 1 })) as ReplicaSetStatus;

    const primaryMember = rsStatus.members.find((m) => m.stateStr === "PRIMARY");
    const primaryOptime = primaryMember?.optimeDate ?? rsStatus.date;

    for (const member of rsStatus.members) {
      try {
        metrics.push(await this.collectMemberMetrics(member, primaryOptime, now));
      } catch (error) {
        console.warn(
          `[MongoDB Collector] Failed for ${this.extractNodeId(member.name)}:`,
          (error as Error).message
        );
      }
    }

    // Enrich PRIMARY entry with connection breakdown + GridFS sizes
    const primaryEntry = metrics.find((m) => m.role === "primary");
    if (primaryEntry && this.primaryClient) {
      const [connBreakdown, gridfsBreakdown] = await Promise.all([
        collectConnectionBreakdown(this.primaryClient),
        collectGridfsBreakdown(this.primaryClient),
      ]);
      Object.assign(primaryEntry, connBreakdown, gridfsBreakdown);
    }

    const memberSnapshots = rsStatus.members.map((m) => ({
      nodeId: this.extractNodeId(m.name),
      stateStr: m.stateStr,
    }));
    const events = this.eventDetector.detectEvents(memberSnapshots);

    console.info(
      `[MongoDB Collector] ${metrics.length}/${rsStatus.members.length} members, ${events.length} events`
    );
    return { metrics, events };
  }

  /** Legacy: metrics only. */
  async collectAll(): Promise<MongodbMetrics[]> {
    const { metrics } = await this.collectAllWithEvents();
    return metrics;
  }

  private async collectMemberMetrics(
    member: ReplicaSetMember,
    primaryOptime: Date,
    now: Date
  ): Promise<MongodbMetrics> {
    const nodeId = this.extractNodeId(member.name);
    const isPrimary = member.stateStr === "PRIMARY";

    let client = this.memberClients.get(member.name);
    if (!client) {
      client = new MongoClient(this.buildMemberUri(member.name), {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        directConnection: true,
      });
      await client.connect();
      this.memberClients.set(member.name, client);
    }

    const serverStatus = (await client.db("admin").command({ serverStatus: 1 })) as ServerStatus;

    const replLagSeconds =
      !isPrimary && member.optimeDate
        ? Math.max(0, Math.round((primaryOptime.getTime() - member.optimeDate.getTime()) / 1000))
        : null;

    let oplogWindowHours: number | null = null;
    if (isPrimary) {
      const oplog = await getOplogWindow(client);
      if (oplog.firstTs && oplog.lastTs) {
        oplogWindowHours =
          Math.round(((oplog.lastTs.getTime() - oplog.firstTs.getTime()) / 3_600_000) * 100) / 100;
      }
    }

    const { dataSize, indexSize, storageSize } = await getAggregatedDbStats(client);
    const wtCache = serverStatus.wiredTiger?.cache;
    const { wtCacheDirtyBytes, wtCacheTimeoutCount, wtEvictionCalls } =
      extractWiredTigerPressure(serverStatus);

    return {
      time: now,
      nodeId,
      role: member.stateStr.toLowerCase(),
      connectionsCurrent: serverStatus.connections.current,
      connectionsAvailable: serverStatus.connections.available,
      opsInsert: serverStatus.opcounters.insert,
      opsQuery: serverStatus.opcounters.query,
      opsUpdate: serverStatus.opcounters.update,
      opsDelete: serverStatus.opcounters.delete,
      opsCommand: serverStatus.opcounters.command,
      replLagSeconds,
      dataSizeBytes: dataSize,
      indexSizeBytes: indexSize,
      storageSizeBytes: storageSize,
      oplogWindowHours,
      wtCacheUsedBytes: wtCache?.["bytes currently in the cache"] ?? 0,
      wtCacheMaxBytes: wtCache?.["maximum bytes configured"] ?? 0,
      wtCacheDirtyBytes,
      wtCacheTimeoutCount,
      wtEvictionCalls,
      connAppImap: null,
      connAppSmtp: null,
      connAppInternal: null,
      connAppMonitoring: null,
      connAppOther: null,
      gridfsMessagesBytes: null,
      gridfsAttachFilesBytes: null,
      gridfsAttachChunksBytes: null,
      gridfsStorageFilesBytes: null,
      gridfsStorageChunksBytes: null,
    };
  }

  private extractNodeId(hostPort: string): string {
    return hostPort.split(":")[0].split(".")[0];
  }

  private buildMemberUri(hostPort: string): string {
    const [host, port = "27017"] = hostPort.split(":");
    const auth = this.mongoUri.match(/^mongodb:\/\/([^@]+@)?/)?.[1] ?? "";
    return `mongodb://${auth}${host}:${port}/?directConnection=true`;
  }

  async disconnect(): Promise<void> {
    if (this.primaryClient) {
      await this.primaryClient.close().catch(() => {});
      this.primaryClient = null;
    }
    for (const [name, client] of this.memberClients.entries()) {
      await client.close().catch((e: Error) =>
        console.warn(`[MongoDB Collector] Close failed for ${name}:`, e.message)
      );
    }
    this.memberClients.clear();
    console.info("[MongoDB Collector] Disconnected");
  }
}
