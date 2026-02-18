/**
 * Shared helper functions for MongoDB member-level data collection:
 * oplog window calculation and aggregated database size stats.
 */

import type { MongoClient } from "mongodb";

export interface DbStats {
  dataSize: number;
  indexSize: number;
  storageSize: number;
}

export interface OplogStats {
  firstTs: Date | null;
  lastTs: Date | null;
}

/** Returns the oplog window boundaries for a member, or nulls on error. */
export async function getOplogWindow(client: MongoClient): Promise<OplogStats> {
  try {
    const oplog = client.db("local").collection("oplog.rs");
    const [first, last] = await Promise.all([
      oplog.findOne({}, { sort: { ts: 1 }, projection: { ts: 1 } }),
      oplog.findOne({}, { sort: { ts: -1 }, projection: { ts: 1 } }),
    ]);
    return {
      firstTs: first?.ts?.getHighBits ? new Date(first.ts.getHighBits() * 1000) : null,
      lastTs: last?.ts?.getHighBits ? new Date(last.ts.getHighBits() * 1000) : null,
    };
  } catch (error) {
    console.warn("[MongoDB Collector] Oplog window failed:", (error as Error).message);
    return { firstTs: null, lastTs: null };
  }
}

/** Sums dataSize / indexSize / storageSize across wildduck databases. */
export async function getAggregatedDbStats(client: MongoClient): Promise<DbStats> {
  let dataSize = 0, indexSize = 0, storageSize = 0;
  for (const dbName of ["wildduck", "wildduck-attachments"]) {
    try {
      const stats = (await client.db(dbName).stats()) as DbStats;
      dataSize += stats.dataSize ?? 0;
      indexSize += stats.indexSize ?? 0;
      storageSize += stats.storageSize ?? 0;
    } catch {
      console.warn(`[MongoDB Collector] dbStats failed for ${dbName}`);
    }
  }
  return { dataSize, indexSize, storageSize };
}
