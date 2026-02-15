#!/bin/bash
# ============================================================================
# Install tino-zonemta-delivery-tracker plugin on a ZoneMTA node
#
# Usage:
#   bash install-tino-zonemta-delivery-tracker.sh [NODE_ID] [API_KEY] [SERVER_URL]
#
# Example:
#   bash install-tino-zonemta-delivery-tracker.sh zonemta-01 abc123 https://mail-monitor.tino.vn
#
# Defaults:
#   NODE_ID   = hostname
#   API_KEY   = (required)
#   SERVER_URL = https://mail-monitor.tino.vn
# ============================================================================

set -euo pipefail

# --- Config ---
ZONEMTA_PLUGINS_DIR="/opt/zone-mta/plugins"
ZONEMTA_CONFIG_DIR="/etc/zone-mta/plugins"
PLUGIN_NAME="tino-zonemta-delivery-tracker"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

NODE_ID="${1:-$(hostname)}"
API_KEY="${2:-}"
SERVER_URL="${3:-https://mail-monitor.tino.vn}"

# --- Validate ---
if [ -z "$API_KEY" ]; then
    echo "ERROR: API_KEY is required"
    echo "Usage: $0 [NODE_ID] [API_KEY] [SERVER_URL]"
    exit 1
fi

echo "=== Installing ${PLUGIN_NAME} ==="
echo "  Node ID:    ${NODE_ID}"
echo "  Server URL: ${SERVER_URL}"
echo "  Plugins:    ${ZONEMTA_PLUGINS_DIR}/${PLUGIN_NAME}/"
echo "  Config:     ${ZONEMTA_CONFIG_DIR}/${PLUGIN_NAME}.toml"
echo ""

# --- Create plugin directory ---
mkdir -p "${ZONEMTA_PLUGINS_DIR}/${PLUGIN_NAME}"

# --- Copy plugin code ---
cp "${SCRIPT_DIR}/index.js" "${ZONEMTA_PLUGINS_DIR}/${PLUGIN_NAME}/index.js"
echo "  Copied index.js"

# --- Generate config with actual values ---
mkdir -p "${ZONEMTA_CONFIG_DIR}"
cat > "${ZONEMTA_CONFIG_DIR}/${PLUGIN_NAME}.toml" <<EOF
["${PLUGIN_NAME}"]
enabled = "sender"
serverUrl = "${SERVER_URL}"
apiKey = "${API_KEY}"
nodeId = "${NODE_ID}"
EOF
echo "  Generated config"

# --- Restart ZoneMTA ---
echo ""
echo "=== Restarting zone-mta ==="
if systemctl is-active --quiet zone-mta; then
    systemctl restart zone-mta
    echo "  zone-mta restarted"
else
    echo "  WARNING: zone-mta service not found/running. Start manually."
fi

# --- Verify ---
echo ""
echo "=== Verify plugin loaded ==="
echo "  Run: journalctl -u zone-mta -n 20 | grep 'Tino'"
echo "  Expected: 'Plugin loaded — sending events to ${SERVER_URL}/api/v1/events/ingest (node=${NODE_ID})'"
echo ""
echo "Done!"
