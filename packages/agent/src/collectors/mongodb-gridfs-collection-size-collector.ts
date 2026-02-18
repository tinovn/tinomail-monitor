/**
 * Collects per-collection storage sizes for WildDuck GridFS collections.
 * Uses collStats command — PRIMARY only.
 */

import type { MongoClient } from "mongodb";

export interface GridfsBreakdown {
  gridfsMessagesBytes: number | null;
  gridfsAttachFilesBytes: number | null;
  gridfsAttachChunksBytes: number | null;
  gridfsStorageFilesBytes: number | null;
  gridfsStorageChunksBytes: number | null;
}

const NULL_BREAKDOWN: GridfsBreakdown = {
  gridfsMessagesBytes: null,
  gridfsAttachFilesBytes: null,
  gridfsAttachChunksBytes: null,
  gridfsStorageFilesBytes: null,
  gridfsStorageChunksBytes: null,
};

interface CollStatsResult {
  storageSize?: number;
}

/** Returns storageSize in bytes for the given db+collection, or null on error. */
async function getCollectionStorageSize(
  client: MongoClient,
  dbName: string,
  collName: string
): Promise<number | null> {
  try {
    const db = client.db(dbName);
    const result = (await db.command({ collStats: collName })) as CollStatsResult;
    return typeof result.storageSize === "number" ? result.storageSize : null;
  } catch (error) {
    console.warn(
      `[MongoDB GridFS] collStats failed for ${dbName}.${collName}:`,
      (error as Error).message
    );
    return null;
  }
}

/**
 * Collects GridFS collection storage sizes for WildDuck databases.
 * Must be called with a client connected to the PRIMARY.
 * Returns all-null breakdown on total failure; individual nulls on partial failure.
 */
export async function collectGridfsBreakdown(
  client: MongoClient
): Promise<GridfsBreakdown> {
  try {
    const [
      gridfsMessagesBytes,
      gridfsAttachFilesBytes,
      gridfsAttachChunksBytes,
      gridfsStorageFilesBytes,
      gridfsStorageChunksBytes,
    ] = await Promise.all([
      getCollectionStorageSize(client, "wildduck", "messages"),
      getCollectionStorageSize(client, "wildduck-attachments", "attachments.files"),
      getCollectionStorageSize(client, "wildduck-attachments", "attachments.chunks"),
      getCollectionStorageSize(client, "wildduck-attachments", "storage.files"),
      getCollectionStorageSize(client, "wildduck-attachments", "storage.chunks"),
    ]);

    return {
      gridfsMessagesBytes,
      gridfsAttachFilesBytes,
      gridfsAttachChunksBytes,
      gridfsStorageFilesBytes,
      gridfsStorageChunksBytes,
    };
  } catch (error) {
    console.warn(
      "[MongoDB GridFS] collectGridfsBreakdown failed, returning nulls:",
      (error as Error).message
    );
    return NULL_BREAKDOWN;
  }
}
