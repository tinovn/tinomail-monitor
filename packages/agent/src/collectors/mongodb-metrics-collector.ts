import type { MongodbMetrics } from "@tinomail/shared";
import { MongoClient } from "mongodb";

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

interface ServerStatus {
  connections: { current: number; available: number };
  opcounters: {
    insert: number;
    query: number;
    update: number;
    delete: number;
    command: number;
  };
  wiredTiger?: {
    cache: {
      "bytes currently in the cache": number;
      "maximum bytes configured": number;
    };
  };
}

interface DbStats {
  dataSize: number;
  indexSize: number;
  storageSize: number;
}

interface OplogStats {
  firstTs: Date | null;
  lastTs: Date | null;
}

export class MongodbMetricsCollector {
  private primaryClient: MongoClient | null = null;
  private memberClients: Map<string, MongoClient> = new Map();

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

  async collectAll(): Promise<MongodbMetrics[]> {
    if (!this.primaryClient) {
      throw new Error("MongoDB client not connected");
    }

    const results: MongodbMetrics[] = [];
    const now = new Date();

    try {
      // Get replica set status from primary
      const admin = this.primaryClient.db("admin");
      const rsStatus = (await admin.command({
        replSetGetStatus: 1,
      })) as ReplicaSetStatus;

      // Find primary member for optime reference
      const primaryMember = rsStatus.members.find(
        (m) => m.stateStr === "PRIMARY"
      );
      const primaryOptime = primaryMember?.optimeDate || rsStatus.date;

      // Collect metrics for each member
      for (const member of rsStatus.members) {
        try {
          const memberMetrics = await this.collectMemberMetrics(
            member,
            primaryOptime,
            now
          );
          results.push(memberMetrics);
        } catch (error) {
          const nodeId = this.extractNodeId(member.name);
          console.warn(
            `[MongoDB Collector] Failed to collect metrics for ${nodeId}:`,
            (error as Error).message
          );
          // Continue collecting from other members
        }
      }

      console.info(
        `[MongoDB Collector] Collected metrics from ${results.length}/${rsStatus.members.length} members`
      );
    } catch (error) {
      console.error(
        "[MongoDB Collector] Failed to get replica set status:",
        error
      );
      throw error;
    }

    return results;
  }

  private async collectMemberMetrics(
    member: ReplicaSetMember,
    primaryOptime: Date,
    now: Date
  ): Promise<MongodbMetrics> {
    const nodeId = this.extractNodeId(member.name);
    const isPrimary = member.stateStr === "PRIMARY";

    // Connect to member if not already connected
    let client = this.memberClients.get(member.name);
    if (!client) {
      const memberUri = this.buildMemberUri(member.name);
      client = new MongoClient(memberUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        directConnection: true,
      });
      await client.connect();
      this.memberClients.set(member.name, client);
    }

    const admin = client.db("admin");

    // Collect server status
    const serverStatus = (await admin.command({
      serverStatus: 1,
    })) as ServerStatus;

    // Calculate replication lag
    let replLagSeconds: number | null = null;
    if (!isPrimary && member.optimeDate) {
      const lagMs = primaryOptime.getTime() - member.optimeDate.getTime();
      replLagSeconds = Math.max(0, Math.round(lagMs / 1000));
    }

    // Collect oplog window (only on PRIMARY)
    let oplogWindowHours: number | null = null;
    if (isPrimary) {
      const oplogStats = await this.getOplogWindow(client);
      if (oplogStats.firstTs && oplogStats.lastTs) {
        const windowMs =
          oplogStats.lastTs.getTime() - oplogStats.firstTs.getTime();
        oplogWindowHours = Math.round((windowMs / (1000 * 60 * 60)) * 100) / 100;
      }
    }

    // Aggregate database sizes (wildduck + wildduck-attachments)
    const { dataSize, indexSize, storageSize } = await this.getAggregatedDbStats(
      client
    );

    // Extract WiredTiger cache metrics
    const wtCache = serverStatus.wiredTiger?.cache;
    const wtCacheUsedBytes = wtCache?.["bytes currently in the cache"] || 0;
    const wtCacheMaxBytes = wtCache?.["maximum bytes configured"] || 0;

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
      wtCacheUsedBytes,
      wtCacheMaxBytes,
    };
  }

  private async getOplogWindow(client: MongoClient): Promise<OplogStats> {
    try {
      const local = client.db("local");
      const oplog = local.collection("oplog.rs");

      const [firstDoc, lastDoc] = await Promise.all([
        oplog.findOne({}, { sort: { ts: 1 }, projection: { ts: 1 } }),
        oplog.findOne({}, { sort: { ts: -1 }, projection: { ts: 1 } }),
      ]);

      return {
        firstTs: firstDoc?.ts?.getHighBits
          ? new Date(firstDoc.ts.getHighBits() * 1000)
          : null,
        lastTs: lastDoc?.ts?.getHighBits
          ? new Date(lastDoc.ts.getHighBits() * 1000)
          : null,
      };
    } catch (error) {
      console.warn("[MongoDB Collector] Failed to get oplog window:", error);
      return { firstTs: null, lastTs: null };
    }
  }

  private async getAggregatedDbStats(
    client: MongoClient
  ): Promise<DbStats> {
    const dbNames = ["wildduck", "wildduck-attachments"];
    let totalDataSize = 0;
    let totalIndexSize = 0;
    let totalStorageSize = 0;

    for (const dbName of dbNames) {
      try {
        const db = client.db(dbName);
        const stats = (await db.stats()) as DbStats;
        totalDataSize += stats.dataSize || 0;
        totalIndexSize += stats.indexSize || 0;
        totalStorageSize += stats.storageSize || 0;
      } catch (error) {
        console.warn(
          `[MongoDB Collector] Failed to get stats for ${dbName}:`,
          error
        );
      }
    }

    return {
      dataSize: totalDataSize,
      indexSize: totalIndexSize,
      storageSize: totalStorageSize,
    };
  }

  private extractNodeId(hostPort: string): string {
    // Extract hostname from "mongodb-01.internal:27017" -> "mongodb-01"
    const hostname = hostPort.split(":")[0];
    return hostname.split(".")[0];
  }

  private buildMemberUri(hostPort: string): string {
    // Extract just host:port and build a direct connection URI
    const [host, port = "27017"] = hostPort.split(":");
    // Parse auth from original URI if present
    const uriParts = this.mongoUri.match(/^mongodb:\/\/([^@]+@)?(.+)/);
    const auth = uriParts?.[1] || "";
    return `mongodb://${auth}${host}:${port}/?directConnection=true`;
  }

  async disconnect(): Promise<void> {
    try {
      if (this.primaryClient) {
        await this.primaryClient.close();
        this.primaryClient = null;
      }

      for (const [name, client] of this.memberClients.entries()) {
        try {
          await client.close();
        } catch (error) {
          console.warn(
            `[MongoDB Collector] Failed to close connection to ${name}:`,
            error
          );
        }
      }
      this.memberClients.clear();

      console.info("[MongoDB Collector] Disconnected");
    } catch (error) {
      console.error("[MongoDB Collector] Disconnect error:", error);
    }
  }
}
