/** WiredTiger cache pressure metrics extracted from serverStatus().wiredTiger.cache */

export interface WiredTigerPressure {
  wtCacheDirtyBytes: number | null;
  wtCacheTimeoutCount: number | null;
  wtEvictionCalls: number | null;
}

export interface ServerStatus {
  connections: { current: number; available: number };
  opcounters: {
    insert: number;
    query: number;
    update: number;
    delete: number;
    command: number;
  };
  wiredTiger?: {
    cache: Record<string, number>;
  };
}

/**
 * Extracts WiredTiger cache pressure fields from a serverStatus result.
 * Returns nulls if wiredTiger section is absent (non-WT engines).
 */
export function extractWiredTigerPressure(serverStatus: ServerStatus): WiredTigerPressure {
  const cache = serverStatus.wiredTiger?.cache;

  if (!cache) {
    return { wtCacheDirtyBytes: null, wtCacheTimeoutCount: null, wtEvictionCalls: null };
  }

  const wtCacheDirtyBytes = cache["tracked dirty bytes in the cache"] ?? null;

  // MongoDB 8.0 renamed the timeout key — try both variants
  const wtCacheTimeoutCount =
    cache["cache timed out waiting for the lock requests"] ??
    cache["pages timed out while waiting for lock"] ??
    null;

  const wtEvictionCalls = cache["eviction calls"] ?? null;

  return {
    wtCacheDirtyBytes: typeof wtCacheDirtyBytes === "number" ? wtCacheDirtyBytes : null,
    wtCacheTimeoutCount: typeof wtCacheTimeoutCount === "number" ? wtCacheTimeoutCount : null,
    wtEvictionCalls: typeof wtEvictionCalls === "number" ? wtEvictionCalls : null,
  };
}
