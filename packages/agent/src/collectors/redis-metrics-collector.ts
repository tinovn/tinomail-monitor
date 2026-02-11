/** Collects Redis metrics via INFO command over raw TCP socket (no dependency needed) */

import * as net from "node:net";

interface RedisMetricsResult {
  time: Date;
  nodeId: string;
  memoryUsedBytes: number;
  memoryMaxBytes: number;
  connectedClients: number;
  opsPerSec: number;
  hitRate: number;
  evictedKeys: number;
  totalKeys: number;
}

export class RedisMetricsCollector {
  private host: string;
  private port: number;

  constructor(redisUrl: string) {
    const url = new URL(redisUrl);
    this.host = url.hostname || "localhost";
    this.port = parseInt(url.port, 10) || 6379;
  }

  async collect(nodeId: string): Promise<RedisMetricsResult> {
    const info = await this.sendInfoCommand();
    const parsed = this.parseInfoResponse(info);

    const keyspaceHits = parseInt(parsed.keyspace_hits || "0", 10);
    const keyspaceMisses = parseInt(parsed.keyspace_misses || "0", 10);
    const totalHitMiss = keyspaceHits + keyspaceMisses;
    const hitRate = totalHitMiss > 0 ? Math.round((keyspaceHits / totalHitMiss) * 10000) / 100 : 0;

    // Parse total keys from keyspace info (db0:keys=123,expires=0,avg_ttl=0)
    let totalKeys = 0;
    for (const [key, val] of Object.entries(parsed)) {
      if (key.startsWith("db") && val.includes("keys=")) {
        const match = val.match(/keys=(\d+)/);
        if (match) totalKeys += parseInt(match[1], 10);
      }
    }

    return {
      time: new Date(),
      nodeId,
      memoryUsedBytes: parseInt(parsed.used_memory || "0", 10),
      memoryMaxBytes: parseInt(parsed.maxmemory || "0", 10),
      connectedClients: parseInt(parsed.connected_clients || "0", 10),
      opsPerSec: parseFloat(parsed.instantaneous_ops_per_sec || "0"),
      hitRate,
      evictedKeys: parseInt(parsed.evicted_keys || "0", 10),
      totalKeys,
    };
  }

  /** Send INFO command to Redis via raw TCP and return full response */
  private sendInfoCommand(): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let data = "";

      socket.setTimeout(5000);
      socket.connect(this.port, this.host, () => {
        socket.write("INFO\r\n");
      });

      socket.on("data", (chunk) => {
        data += chunk.toString();
        // Redis INFO response ends with a double newline after all sections
        if (data.includes("\r\n\r\n") && data.split("\r\n").length > 10) {
          socket.destroy();
          resolve(data);
        }
      });

      socket.on("end", () => resolve(data));
      socket.on("error", (err) => {
        socket.destroy();
        reject(err);
      });
      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("Redis INFO timeout"));
      });
    });
  }

  /** Parse Redis INFO response into key-value map */
  private parseInfoResponse(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of info.split("\r\n")) {
      if (!line || line.startsWith("#") || line.startsWith("$")) continue;
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      result[line.slice(0, colonIdx)] = line.slice(colonIdx + 1);
    }
    return result;
  }
}
