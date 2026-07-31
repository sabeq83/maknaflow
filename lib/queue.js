import { Queue } from 'bullmq';
import { getRedisConnection } from './redis.js';

let glabsQueue = null;

export function getGlabsQueue() {
  if (!glabsQueue) {
    glabsQueue = new Queue('glabs-task-queue', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600 * 24, // Keep completed jobs for 24h
          count: 1000,
        },
        removeOnFail: {
          age: 3600 * 24 * 7, // Keep failed jobs for 7 days
          count: 5000,
        },
      },
    });
  }
  return glabsQueue;
}

export async function addGlabsJob(type, data, tenantId = 'default_tenant') {
  const queue = getGlabsQueue();
  const job = await queue.add(type, {
    ...data,
    tenantId,
  });
  return job;
}

export async function getBullMqJobStatus(jobId) {
  const queue = getGlabsQueue();
  const job = await queue.getJob(jobId);
  if (!job) {
    return { status: 'failed', error: 'Job not found' };
  }
  const state = await job.getState(); // completed, failed, active, delayed, waiting
  if (state === 'completed') {
    return { status: 'completed', results: job.returnvalue };
  }
  if (state === 'failed') {
    return { status: 'failed', error: job.failedReason || 'Unknown queue error' };
  }
  return { status: 'pending', message: `Job is currently ${state}` };
}
