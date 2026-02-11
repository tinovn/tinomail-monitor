import type { SystemMetrics } from "@tinomail/shared";
import * as si from "systeminformation";

interface CachedStats {
  diskIO: { rIO: number; wIO: number; timestamp: number };
  netStats: { rx: number; tx: number; timestamp: number };
}

export class SystemMetricsCollector {
  private cache: CachedStats | null = null;

  async collect(nodeId: string, nodeRole: string): Promise<SystemMetrics> {
    const now = Date.now();

    // Collect all metrics in parallel
    const [cpu, mem, disk, diskIO, network, load, connections] =
      await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.disksIO(),
        si.networkStats(),
        si.currentLoad(),
        si.networkConnections(),
      ]);

    // Calculate disk usage — sum all real filesystems
    const realDisks = disk.filter(
      (d) => d.size > 0 && !d.fs.startsWith("tmpfs") && !d.fs.startsWith("devtmpfs") && !d.fs.startsWith("efivarfs"),
    );
    const totalSize = realDisks.reduce((sum, d) => sum + d.size, 0);
    const totalUsed = realDisks.reduce((sum, d) => sum + d.used, 0);
    const diskPercent = totalSize > 0 ? Math.round((totalUsed / totalSize) * 100 * 10) / 10 : 0;
    const diskFreeBytes = totalSize - totalUsed;

    // Calculate disk I/O rates (bytes/sec)
    let diskReadBytesSec = 0;
    let diskWriteBytesSec = 0;

    if (this.cache?.diskIO) {
      const timeDiff = (now - this.cache.diskIO.timestamp) / 1000; // seconds
      if (timeDiff > 0) {
        diskReadBytesSec = Math.round(
          (diskIO.rIO - this.cache.diskIO.rIO) / timeDiff
        );
        diskWriteBytesSec = Math.round(
          (diskIO.wIO - this.cache.diskIO.wIO) / timeDiff
        );
      }
    }

    // Update disk cache
    this.cache = {
      ...this.cache,
      diskIO: { rIO: diskIO.rIO, wIO: diskIO.wIO, timestamp: now },
    } as CachedStats;

    // Calculate network rates (bytes/sec)
    const primaryNet = network[0] || { rx_bytes: 0, tx_bytes: 0, rx_errors: 0, tx_errors: 0 };
    let netRxBytesSec = 0;
    let netTxBytesSec = 0;

    if (this.cache?.netStats) {
      const timeDiff = (now - this.cache.netStats.timestamp) / 1000;
      if (timeDiff > 0) {
        netRxBytesSec = Math.round(
          (primaryNet.rx_bytes - this.cache.netStats.rx) / timeDiff
        );
        netTxBytesSec = Math.round(
          (primaryNet.tx_bytes - this.cache.netStats.tx) / timeDiff
        );
      }
    }

    // Update network cache
    this.cache = {
      ...this.cache,
      netStats: {
        rx: primaryNet.rx_bytes,
        tx: primaryNet.tx_bytes,
        timestamp: now,
      },
    } as CachedStats;

    // Count TCP connections by state
    const tcpEstablished = connections.filter(
      (c) => c.state === "ESTABLISHED"
    ).length;
    const tcpTimeWait = connections.filter(
      (c) => c.state === "TIME_WAIT"
    ).length;

    // Get open files count (requires elevated permissions - set to 0 for now)
    const openFiles = 0;

    // Extract load average values
    const loadAvg = Array.isArray(load.avgLoad) ? load.avgLoad : [0, 0, 0];

    return {
      time: new Date(),
      nodeId,
      nodeRole,
      cpuPercent: Math.round(cpu.currentLoad * 10) / 10,
      ramPercent: Math.round((mem.used / mem.total) * 100 * 10) / 10,
      ramUsedBytes: mem.used,
      diskPercent,
      diskFreeBytes,
      diskReadBytesSec,
      diskWriteBytesSec,
      netRxBytesSec,
      netTxBytesSec,
      netRxErrors: primaryNet.rx_errors || 0,
      netTxErrors: primaryNet.tx_errors || 0,
      load1m: loadAvg[0] || 0,
      load5m: loadAvg[1] || 0,
      load15m: loadAvg[2] || 0,
      tcpEstablished,
      tcpTimeWait,
      openFiles,
    };
  }
}
