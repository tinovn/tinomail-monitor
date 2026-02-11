#!/bin/bash
# =============================================================================
# TinoMail Monitor Agent — Installation Script
# Run on each mail server node: curl -sL <url> | bash -s -- <args>
# =============================================================================
set -e

# --- Must run as root ---
if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: This script must be run as root (use sudo)"
  echo "  curl -sL <URL> | sudo bash -s -- $*"
  exit 1
fi

# --- Configuration (override via arguments or env) ---
MONITOR_URL="${MONITOR_URL:-https://mail-monitor.tino.vn}"
API_KEY="${API_KEY:-}"
NODE_ID="${NODE_ID:-}"
NODE_ROLE="${NODE_ROLE:-auto}"
MONGODB_URI="${MONGODB_URI:-}"
ZONEMTA_API_URL="${ZONEMTA_API_URL:-}"
REDIS_URL="${REDIS_URL:-}"
INSTALL_DIR="/opt/tinomail-agent"

# --- Parse arguments ---
usage() {
  echo "Usage: $0 --api-key <KEY> --node-id <ID> [OPTIONS]"
  echo ""
  echo "Required:"
  echo "  --api-key         Agent API key from monitor server"
  echo "  --node-id         Unique node identifier (e.g., mta-01, wildduck-01, mongo-01)"
  echo ""
  echo "Optional:"
  echo "  --role            Node role (default: auto — auto-detects running services)"
  echo "                    Options: auto, zonemta, wildduck, haraka, mongodb, redis"
  echo "  --mongodb-uri     MongoDB connection URI (for MongoDB nodes)"
  echo "  --zonemta-api-url ZoneMTA API URL (default: http://localhost:12080)"
  echo "  --redis-url       Redis URL (default: redis://localhost:6379)"
  echo "  --server-url      Monitor server URL (default: https://mail-monitor.tino.vn)"
  echo ""
  echo "Example:"
  echo "  $0 --api-key abc123 --node-id mta-01"
  echo "  $0 --api-key abc123 --node-id mta-01 --role zonemta"
  echo "  $0 --api-key abc123 --node-id mongo-01 --mongodb-uri 'mongodb://localhost:27017'"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --api-key) API_KEY="$2"; shift 2 ;;
    --node-id) NODE_ID="$2"; shift 2 ;;
    --role) NODE_ROLE="$2"; shift 2 ;;
    --mongodb-uri) MONGODB_URI="$2"; shift 2 ;;
    --zonemta-api-url) ZONEMTA_API_URL="$2"; shift 2 ;;
    --redis-url) REDIS_URL="$2"; shift 2 ;;
    --server-url) MONITOR_URL="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

if [ -z "$API_KEY" ] || [ -z "$NODE_ID" ]; then
  echo "ERROR: --api-key and --node-id are required"
  usage
fi

echo "=== TinoMail Monitor Agent Installer ==="
echo "Node ID:    $NODE_ID"
echo "Role:       $NODE_ROLE"
echo "Server:     $MONITOR_URL"
echo ""

# --- Step 1: Install Node.js 20 if not present ---
if ! command -v node &>/dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 20 ]]; then
  echo "[1/5] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
else
  echo "[1/5] Node.js $(node -v) already installed"
fi

# --- Step 2: Create agent directory ---
echo "[2/5] Setting up agent directory..."
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# --- Step 3: Create package.json and install ---
echo "[3/5] Installing agent package..."
cat > package.json << 'PKGJSON'
{
  "name": "tinomail-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "systeminformation": "^5.23.0",
    "mongodb": "^6.12.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0"
  }
}
PKGJSON

npm install --quiet 2>&1 | tail -3

# --- Step 4: Download agent source from GitHub ---
echo "[4/5] Downloading agent source..."
mkdir -p src/collectors src/transport

# Download each file from the repo
REPO_RAW="https://raw.githubusercontent.com/tinovn/tinomail-monitor/main/packages/agent/src"
SHARED_RAW="https://raw.githubusercontent.com/tinovn/tinomail-monitor/main/packages/shared/src"

# Agent source files
for FILE in index.ts agent-config.ts monitoring-agent.ts self-updater.ts; do
  curl -sL "$REPO_RAW/$FILE" -o "src/$FILE"
done

for FILE in system-metrics-collector.ts process-health-collector.ts mongodb-metrics-collector.ts service-auto-discovery-collector.ts zonemta-metrics-collector.ts redis-metrics-collector.ts; do
  curl -sL "$REPO_RAW/collectors/$FILE" -o "src/collectors/$FILE" 2>/dev/null || true
done

for FILE in http-metrics-transport.ts offline-metrics-buffer.ts; do
  curl -sL "$REPO_RAW/transport/$FILE" -o "src/transport/$FILE"
done

# Shared types (inline the needed types to avoid workspace dependency)
mkdir -p src/shared
cat > src/shared/index.ts << 'SHAREDTYPES'
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
  connections_current: number;
  connections_available: number;
  ops_insert: number;
  ops_query: number;
  ops_update: number;
  ops_delete: number;
  ops_command: number;
  repl_lag_seconds: number | null;
  data_size_bytes: number;
  index_size_bytes: number;
  storage_size_bytes: number;
  oplog_window_hours: number | null;
  wt_cache_used_bytes: number;
  wt_cache_max_bytes: number;
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

# Patch imports: replace @tinomail/shared with correct relative path per depth
# src/*.ts -> ./shared/index.js
sed -i 's|from "@tinomail/shared"|from "./shared/index.js"|g' src/*.ts 2>/dev/null || true
# src/collectors/*.ts and src/transport/*.ts -> ../shared/index.js
sed -i 's|from "@tinomail/shared"|from "../shared/index.js"|g' src/collectors/*.ts 2>/dev/null || true
sed -i 's|from "@tinomail/shared"|from "../shared/index.js"|g' src/transport/*.ts 2>/dev/null || true

# Create tsconfig
cat > tsconfig.json << 'TSCONFIG'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
TSCONFIG

# --- Step 5: Create .env and systemd service ---
echo "[5/5] Configuring service..."

cat > .env << ENVFILE
AGENT_SERVER_URL=$MONITOR_URL
AGENT_API_KEY=$API_KEY
AGENT_NODE_ID=$NODE_ID
AGENT_NODE_ROLE=$NODE_ROLE
AGENT_HEARTBEAT_INTERVAL=15000
ENVFILE

# Add optional configs
if [ -n "$MONGODB_URI" ]; then
  echo "AGENT_MONGODB_URI=$MONGODB_URI" >> .env
  echo "AGENT_MONGODB_INTERVAL=30000" >> .env
fi

if [ -n "$ZONEMTA_API_URL" ]; then
  echo "AGENT_ZONEMTA_API_URL=$ZONEMTA_API_URL" >> .env
fi

if [ -n "$REDIS_URL" ]; then
  echo "AGENT_REDIS_URL=$REDIS_URL" >> .env
fi

chmod 600 .env

# Create systemd service
cat > /etc/systemd/system/tinomail-agent.service << SERVICE
[Unit]
Description=TinoMail Monitor Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$INSTALL_DIR/node_modules/.bin/tsx src/index.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tinomail-agent

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable tinomail-agent
systemctl start tinomail-agent

sleep 3
if systemctl is-active --quiet tinomail-agent; then
  echo ""
  echo "=== Agent installed and running! ==="
  echo "Node:   $NODE_ID ($NODE_ROLE)"
  echo "Server: $MONITOR_URL"
  echo ""
  echo "Commands:"
  echo "  systemctl status tinomail-agent    # Check status"
  echo "  journalctl -fu tinomail-agent      # View logs"
  echo "  systemctl restart tinomail-agent   # Restart"
  echo ""
else
  echo ""
  echo "=== WARNING: Agent failed to start ==="
  echo "Check logs: journalctl -u tinomail-agent -n 20"
fi
