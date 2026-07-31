#!/bin/bash
# ==============================================================================
# MAKNA GRID — NODE 1 (UBUNTU DESKTOP UI GATEWAY) BOOTSTRAP SCRIPT
# Server IP: 100.65.62.63
# ==============================================================================

echo "🚀 Starting MAKNA Grid Node 1 (Ubuntu UI Gateway) Setup..."

# Set environment variables for Gateway role
cat << 'EOF' > .env.local
NODE_ENV=production
NODE_ROLE=gateway
ENABLE_SCHEDULER_WORKER=true
PORT=3000

# Central Master Database Node 3 & Direct G-Labs Webhook Node 2
DATABASE_HOST=100.78.186.123
CONTENT_FLOW_API_URL=http://100.78.186.123:3001/api/v1/content/ingest
WEBHOOK_HOST=100.117.59.92
WEBHOOK_PORT=8765
EOF

echo "✅ Generated .env.local for Node 1 UI Gateway (Direct Tailscale IP 100.117.59.92:8765)"
echo "ℹ️ Node 1 Role: GATEWAY (UI & AI Ideation active)."
echo "🌐 Launching MAKNA Grid Gateway Service on http://100.65.62.63:3000..."
