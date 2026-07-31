/**
 * Node Role & Cluster Configuration Module for MAKNA Grid (Multi-Node Deployment)
 * Supports 3-Node Topology:
 * - Gateway Node (Node 1 - Ubuntu UI): NODE_ROLE=gateway, ENABLE_SCHEDULER_WORKER=false
 * - Worker Node (Node 2 - Windows Compute GPU): NODE_ROLE=worker, ENABLE_SCHEDULER_WORKER=true
 * - Storage Node (Node 3 - Storage & Central DB): NODE_ROLE=storage
 */

import { getSetting } from './db.js';

export function getNodeRole() {
  return (process.env.NODE_ROLE || 'standalone').toLowerCase();
}

export function isWorkerEnabled() {
  if (process.env.ENABLE_SCHEDULER_WORKER !== undefined) {
    return process.env.ENABLE_SCHEDULER_WORKER === 'true' || process.env.ENABLE_SCHEDULER_WORKER === '1';
  }
  const role = getNodeRole();
  if (role === 'gateway' || role === 'worker' || role === 'standalone' || role === 'master') return true;
  return true;
}

export function isGatewayNode() {
  return getNodeRole() === 'gateway';
}

export function isWorkerNode() {
  return getNodeRole() === 'worker';
}

export function isStorageNode() {
  return getNodeRole() === 'storage';
}

export function getMasterDbHost() {
  return process.env.MASTER_DB_HOST || process.env.DATABASE_HOST || '100.78.186.123';
}

export function getContentFlowApiUrl() {
  return process.env.CONTENT_FLOW_API_URL || getSetting('contentflow_ingest_url') || 'http://100.78.186.123:3001/api/v1/content/ingest';
}

export function getWebhookBaseUrl() {
  const port = getSetting('webhook_port') || process.env.WEBHOOK_PORT || '8765';
  const host = getSetting('webhook_host') || process.env.WEBHOOK_HOST || '100.117.59.92';
  return `http://${host}:${port}`;
}

export function getNodeSummary() {
  return {
    role: getNodeRole(),
    workerEnabled: isWorkerEnabled(),
    masterDbHost: getMasterDbHost(),
    webhookUrl: getWebhookBaseUrl(),
    contentFlowUrl: getContentFlowApiUrl()
  };
}
