import { Worker } from 'bullmq';
import { getRedisConnection } from '../lib/redis.js';
import { saveGlabsTaskRoute } from '../lib/db.js';

// Since the worker runs on Node 2, it connects to local G-Labs app
const GLABS_LOCAL_HOST = '127.0.0.1';
const GLABS_LOCAL_PORT = '8765';
const GLABS_URL = `http://${GLABS_LOCAL_HOST}:${GLABS_LOCAL_PORT}`;

// Concurrency limit from environment or default to 2
const CONCURRENCY = parseInt(process.env.GLABS_WORKER_CONCURRENCY || '2', 10);

console.log(`🏁 Starting G-Labs Queue Worker Daemon on Node 2 (Concurrency Limit: ${CONCURRENCY})...`);

const worker = new Worker('glabs-task-queue', async (job) => {
  const { type, data, tenantId } = job;
  console.log(`📥 Processing Job ${job.id} [Type: ${job.name}] for Tenant: ${tenantId}`);

  // 1. Submit task to local G-Labs API
  const endpoint = job.name === 'image' ? '/api/image/generate' : '/api/video/generate';
  const apiKey = data.webhookOverride?.webhook_api_key || ''; // G-Labs API Key

  const response = await fetch(`${GLABS_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errorMsg = errorBody.error || errorBody.message || `HTTP ${response.status}`;
    throw new Error(`G-Labs submission failed: ${errorMsg}`);
  }

  const submitData = await response.json();
  const gLabsTaskId = submitData.task_id;
  if (!gLabsTaskId) {
    throw new Error('G-Labs did not return a task_id');
  }

  console.log(`🚀 Submitted to G-Labs. G-Labs Task ID: ${gLabsTaskId}. Polling status...`);

  // 2. Persist route to central DB so gateway can find files
  try {
    const workerPublicIp = process.env.WEBHOOK_HOST || '100.117.59.92';
    // Save route under the original BullMQ job ID too for transparent lookups
    await saveGlabsTaskRoute(gLabsTaskId, workerPublicIp, GLABS_LOCAL_PORT, apiKey);
    await saveGlabsTaskRoute(`bullmq_${job.id}`, workerPublicIp, GLABS_LOCAL_PORT, apiKey);
  } catch (err) {
    console.warn(`[Worker] Failed to save task routing: ${err.message}`);
  }

  // 3. Poll status of G-Labs task
  const pollInterval = 5000; // 5 seconds
  const timeoutMs = 600000; // 10 minutes timeout
  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`G-Labs task ${gLabsTaskId} timed out after 10 minutes.`);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const statusRes = await fetch(`${GLABS_URL}/api/status/${gLabsTaskId}`, {
      headers: { 'X-API-Key': apiKey }
    });

    if (!statusRes.ok) {
      console.warn(`[Worker] Poll request failed with HTTP ${statusRes.status}, retrying...`);
      continue;
    }

    const statusData = await statusRes.json();
    console.log(`[Worker] Polling Job ${job.id} (G-Labs Task: ${gLabsTaskId}) -> Status: ${statusData.status}`);

    if (statusData.status === 'completed') {
      console.log(`🎉 Job ${job.id} completed successfully!`);
      return statusData.results;
    }

    if (statusData.status === 'failed') {
      const errorMsg = statusData.error || statusData.error_detail || 'Unknown G-Labs error';
      throw new Error(`G-Labs task failed: ${errorMsg}`);
    }
  }
}, {
  connection: getRedisConnection(),
  concurrency: CONCURRENCY,
  lockDuration: 60000,     // 60 seconds lock duration
  stalledInterval: 30000,  // check for stalled jobs every 30 seconds
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

worker.on('completed', (job) => {
  console.log(`✓ Job ${job.id} marked as completed.`);
});

worker.on('error', (err) => {
  console.error('💥 Worker internal error:', err);
});
