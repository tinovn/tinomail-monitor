#!/bin/bash
# Emergency fix: download missing collector files + update shared types
# Run on each agent node: curl -sL <url> | sudo bash
set -e

INSTALL_DIR="/opt/tinomail-agent"
GITHUB_RAW="https://raw.githubusercontent.com/tinovn/tinomail-monitor/main/packages/agent/src"

echo "=== Fixing agent missing files ==="

# Download ALL agent source files (full re-sync)
mkdir -p "$INSTALL_DIR/src/collectors" "$INSTALL_DIR/src/transport" "$INSTALL_DIR/src/shared"

for FILE in index.ts agent-config.ts monitoring-agent.ts self-updater.ts; do
  curl -sL "$GITHUB_RAW/$FILE" -o "$INSTALL_DIR/src/$FILE"
  echo "  Downloaded $FILE"
done

for FILE in system-metrics-collector.ts process-health-collector.ts mongodb-metrics-collector.ts service-auto-discovery-collector.ts zonemta-metrics-collector.ts redis-metrics-collector.ts; do
  curl -sL "$GITHUB_RAW/collectors/$FILE" -o "$INSTALL_DIR/src/collectors/$FILE"
  echo "  Downloaded collectors/$FILE"
done

for FILE in http-metrics-transport.ts offline-metrics-buffer.ts; do
  curl -sL "$GITHUB_RAW/transport/$FILE" -o "$INSTALL_DIR/src/transport/$FILE"
  echo "  Downloaded transport/$FILE"
done

# Patch @tinomail/shared imports
sed -i 's|from "@tinomail/shared"|from "./shared/index.js"|g' "$INSTALL_DIR/src/"*.ts 2>/dev/null || true
sed -i 's|from "@tinomail/shared"|from "../shared/index.js"|g' "$INSTALL_DIR/src/collectors/"*.ts 2>/dev/null || true
sed -i 's|from "@tinomail/shared"|from "../shared/index.js"|g' "$INSTALL_DIR/src/transport/"*.ts 2>/dev/null || true

# Rebuild shared types with all types
cat > "$INSTALL_DIR/src/shared/index.ts" << 'SHAREDTYPES'
// Inline shared types — avoids @tinomail/shared workspace dependency

export interface SystemMetrics {
  time: Date;
  nodeId: string;
  nodeRole: string;
  cpuPercent: number;
  ramPercent: number;
  ramUsedBytes: number;
  diskPercent: number;
  diskFreeBytes: number;
  diskReadBytesSec: number;
  diskWriteBytesSec: number;
  netRxBytesSec: number;
  netTxBytesSec: number;
  netRxErrors: number;
  netTxErrors: number;
  load1m: number;
  load5m: number;
  load15m: number;
  tcpEstablished: number;
  tcpTimeWait: number;
  openFiles: number;
}

export interface NodeRegistrationPayload {
  nodeId: string;
  hostname: string;
  ipAddress: string;
  role: string;
  metadata?: Record<string, unknown>;
}

export interface MongodbMetrics {
  time: Date;
  nodeId: string;
  role: string;
  connectionsCurrent: number;
  connectionsAvailable: number;
  opsInsert: number;
  opsQuery: number;
  opsUpdate: number;
  opsDelete: number;
  opsCommand: number;
  replLagSeconds: number | null;
  dataSizeBytes: number;
  indexSizeBytes: number;
  storageSizeBytes: number;
  oplogWindowHours: number | null;
  wtCacheUsedBytes: number;
  wtCacheMaxBytes: number;
}

export interface ZonemtaMetrics {
  time: Date;
  nodeId: string;
  mtaRole: string | null;
  queueSize: number;
  activeDeliveries: number;
  sentTotal: number;
  deliveredTotal: number;
  bouncedTotal: number;
  deferredTotal: number;
  rejectedTotal: number;
  connectionsActive: number;
  throughputPerSec: number;
}

export interface RedisMetrics {
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

export interface RspamdMetrics {
  time: Date;
  nodeId: string;
  scanned: number;
  ham: number;
  spam: number;
  greylist: number;
  rejected: number;
  learnedHam: number;
  learnedSpam: number;
}

export type MetricsPayload =
  | { type: "system"; data: SystemMetrics }
  | { type: "mongodb"; data: MongodbMetrics }
  | { type: "redis"; data: RedisMetrics }
  | { type: "zonemta"; data: ZonemtaMetrics }
  | { type: "rspamd"; data: RspamdMetrics };
SHAREDTYPES

echo ""
echo "Restarting agent..."
systemctl restart tinomail-agent

sleep 3
if systemctl is-active --quiet tinomail-agent; then
  echo "=== Agent fixed and running! ==="
else
  echo "=== Agent still failing. Check: journalctl -u tinomail-agent -n 20 ==="
fi
