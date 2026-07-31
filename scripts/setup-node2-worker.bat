@echo off
rem ==============================================================================
rem MAKNA GRID — NODE 2 (WINDOWS COMPUTE GPU WORKER) BOOTSTRAP SCRIPT
rem Server IP: 100.117.59.92
rem ==============================================================================

echo 🚀 Starting MAKNA Grid Node 2 (Windows Worker GPU) Setup...

(
  echo NODE_ENV=production
  echo NODE_ROLE=worker
  echo ENABLE_SCHEDULER_WORKER=true
  echo PORT=3000
  echo WEBHOOK_PORT=8765
  echo WEBHOOK_HOST=127.0.0.1
  echo DATABASE_HOST=100.78.186.123
  echo CONTENT_FLOW_API_URL=http://100.78.186.123:3001/api/v1/content/ingest
) > .env.local

echo ✅ Generated .env.local for Node 2 Worker GPU
echo ℹ️ Node 2 Role: WORKER (Compute GPU, G-Labs 127.0.0.1:8765, TTS, & FFmpeg Smart Sync ACTIVE).
echo 🌐 Launching MAKNA Grid Worker Engine...
