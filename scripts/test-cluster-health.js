/**
 * Cluster Health & Connectivity Verification Script for MAKNA Grid (3-Node Topology)
 * Run this to check status of Node 1 (UI), Node 2 (Worker), and Node 3 (DB/Storage).
 */

import http from 'http';
import https from 'https';

function getNodeRole() {
  return (process.env.NODE_ROLE || 'standalone').toLowerCase();
}

function isWorkerEnabled() {
  if (process.env.ENABLE_SCHEDULER_WORKER !== undefined) {
    return process.env.ENABLE_SCHEDULER_WORKER === 'true' || process.env.ENABLE_SCHEDULER_WORKER === '1';
  }
  const role = getNodeRole();
  if (role === 'gateway') return false;
  return true;
}

function getMasterDbHost() {
  return process.env.MASTER_DB_HOST || process.env.DATABASE_HOST || '100.78.186.123';
}

function getContentFlowApiUrl() {
  return process.env.CONTENT_FLOW_API_URL || 'http://100.78.186.123:3001/api/v1/content/ingest';
}

function getWebhookBaseUrl() {
  const port = process.env.WEBHOOK_PORT || '8765';
  const host = process.env.WEBHOOK_HOST || '127.0.0.1';
  return `http://${host}:${port}`;
}

async function checkUrlHealth(urlStr) {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
        resolve({ ok: res.statusCode < 500, status: res.statusCode });
      });
      req.on('error', (err) => resolve({ ok: false, error: err.message }));
      req.on('timeout', () => resolve({ ok: false, error: 'Timeout 5s' }));
      req.end();
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

async function runClusterHealthCheck() {
  console.log('================================================================');
  console.log('🩺 MAKNA GRID 3-NODE CLUSTER HEALTH CHECK');
  console.log('================================================================');

  const role = getNodeRole();
  const workerEnabled = isWorkerEnabled();
  const masterDbHost = getMasterDbHost();
  const webhookUrl = getWebhookBaseUrl();
  const contentFlowUrl = getContentFlowApiUrl();

  console.log(`[Current Node Summary]`);
  console.log(` - Role: ${role.toUpperCase()}`);
  console.log(` - Worker Polling Enabled: ${workerEnabled ? 'YES ✅' : 'NO 🚫 (Gateway Mode)'}`);
  console.log(` - Central DB Host: ${masterDbHost}`);
  console.log(` - G-Labs Webhook URL: ${webhookUrl}`);
  console.log(` - ContentFlow API URL: ${contentFlowUrl}`);
  console.log('----------------------------------------------------------------');

  // Test Node 3 ContentFlow API Endpoint
  console.log(`[Testing Node 3 Storage & ContentFlow API...]`);
  const contentFlowHealth = await checkUrlHealth(contentFlowUrl);
  if (contentFlowHealth.ok) {
    console.log(` ✅ Node 3 ContentFlow Ingest API (http://100.78.186.123:3001) is ONLINE (HTTP ${contentFlowHealth.status})`);
  } else {
    console.log(` ⚠️ Node 3 ContentFlow API Response: ${contentFlowHealth.error || contentFlowHealth.status}`);
  }

  // Test Node 2 G-Labs Webhook Endpoint (if running on Worker)
  if (workerEnabled) {
    console.log(`[Testing Node 2 G-Labs Webhook Endpoint...]`);
    const glabsHealth = await checkUrlHealth(webhookUrl);
    if (glabsHealth.ok || glabsHealth.status === 404 || glabsHealth.status === 405) {
      console.log(` ✅ Node 2 G-Labs Webhook (127.0.0.1:8765) is RESPONDING (HTTP ${glabsHealth.status})`);
    } else {
      console.log(` ℹ️ Node 2 G-Labs Webhook Check: ${glabsHealth.error || glabsHealth.status}`);
    }
  }

  console.log('================================================================');
  console.log('🎉 Cluster Health Check Complete!');
  console.log('================================================================');
}

runClusterHealthCheck();
