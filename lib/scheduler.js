/**
 * MAKNA Scheduler V4 — Native SQLite-Based Scheduler Engine
 * 
 * 5 Queues: scraper, analyzer, ideation, production, glabs
 * Modes: interval (scraper) and time_window (others)
 * Auto-creates jobs based on queue config and processes them via processors.
 */

import {
  getAllSchedulerConfigs, getSchedulerConfig,
  claimNextJob, completeJob, failJob,
  createJob, getJobsCompletedToday, getDb,
} from './db';
import path from 'path';
import { logContextStorage } from './console-hook';

// Import processors dynamically to support hot-reloading
async function getProcessors() {
  return await import('./scheduler-processors');
}

// Queue definitions with their API cost
const QUEUE_DEFS = {
  scraper:        { label: 'Scraper', cost: 0 },
  analyzer:       { label: 'RE Analyzer', cost: 1 },
  ideation:       { label: 'Ideation', cost: 1 },
  production:     { label: 'Production', cost: 1 },
  glabs:          { label: 'G Labs Webhook', cost: 0 },
  re_scraper:     { label: 'RE Campaign Scraper', cost: 0 },
  re_analyzer:    { label: 'RE Campaign Analyzer', cost: 1 },
  glabs_campaign: { label: 'G Labs Campaign', cost: 0 },
  re_tts:         { label: 'RE Campaign TTS', cost: 0 },
  re_glabs:       { label: 'RE Campaign AI Visuals', cost: 0 },
  re_ffmpeg:      { label: 'RE Campaign FFmpeg Muxer', cost: 0 },
  re_social_poster: { label: 'RE Campaign Social Poster', cost: 0 },
  re_plus_recomm:   { label: 'RE Plus Recomm Sourcing', cost: 1 },
  pillar_sourcing:  { label: 'Pillar Product JIT Sourcing', cost: 1 },
  pillar_generator: { label: 'Pillar Storyboard Generator', cost: 1 },
  pillar_tts:       { label: 'Pillar Campaign TTS Voice', cost: 0 },
  pillar_glabs:     { label: 'Pillar Campaign AI Visuals', cost: 0 },
  pillar_ffmpeg:    { label: 'Pillar Campaign FFmpeg Muxer', cost: 0 },
  pillar_social_poster: { label: 'Pillar Campaign Social Poster', cost: 0 },
  product_scraper:      { label: 'Product Scraper', cost: 1 },
  re_deconstruct:       { label: 'RE Deconstruct Lab', cost: 1 },
  recipe_generator:     { label: 'Recipe Generator', cost: 1 },
  recipe_glabs:         { label: 'Recipe AI Visuals', cost: 0 },
  recipe_exporter:      { label: 'Recipe Grid & Nextcloud Exporter', cost: 0 },
};

// Runtime state using Node's global object to persist across Next.js dev server module reloads
const globalRef = global;
if (!globalRef.schedulerState) {
  globalRef.schedulerState = {
    schedulerInterval: null,
    isRunning: false,
    lastTick: {},
    lastJobCreation: {},
  };
}
const state = globalRef.schedulerState;
if (!state.activeLocks) {
  state.activeLocks = new Set();
}

/**
 * Check if current time is within a time window.
 */
function isInTimeWindow(windowStart, windowEnd) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = windowStart.split(':').map(Number);
  const [endH, endM] = windowEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Calculate interval in ms between jobs for time_window mode.
 * (endTime - startTime) / jobsPerDay
 */
function getTimeWindowIntervalMs(windowStart, windowEnd, jobsPerDay) {
  const [startH, startM] = windowStart.split(':').map(Number);
  const [endH, endM] = windowEnd.split(':').map(Number);
  const windowMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  if (windowMinutes <= 0 || jobsPerDay <= 0) return Infinity;
  return (windowMinutes / jobsPerDay) * 60 * 1000; // convert to ms
}

/**
 * Maybe create a new job for a queue based on its config and daily quota.
 */
async function maybeCreateJob(queueName, config) {
  // Campaign-related queues and manual queues are strictly handled manually or by the local scheduler.
  if (
    queueName === 'product_scraper' ||
    queueName === 'glabs_campaign' ||
    queueName.startsWith('recipe_') ||
    queueName.startsWith('re_') ||
    queueName.startsWith('pillar_')
  ) return;

  const completedToday = getJobsCompletedToday(queueName);

  if (config.mode === 'interval') {
    // Interval mode: create job every N minutes regardless of time window
    const intervalMs = config.interval_minutes * 60 * 1000;
    const lastCreation = state.lastJobCreation[queueName] || 0;
    if (Date.now() - lastCreation < intervalMs) return;

    // Check if there's pending work (processor will determine this)
    createJob(queueName, null);
    state.lastJobCreation[queueName] = Date.now();
    return;
  }

  if (config.mode === 'time_window') {
    // Time window mode: only create jobs within the window
    if (!isInTimeWindow(config.window_start, config.window_end)) return;

    // Check daily quota
    if (completedToday >= config.jobs_per_day) return;

    // Calculate interval between jobs within the window
    const intervalMs = getTimeWindowIntervalMs(
      config.window_start, config.window_end, config.jobs_per_day
    );
    const lastCreation = state.lastJobCreation[queueName] || 0;
    if (Date.now() - lastCreation < intervalMs) return;

    createJob(queueName, null);
    state.lastJobCreation[queueName] = Date.now();
  }
}

/**
 * Process one pending job from a queue.
 */
const PIPELINE_SEQUENCE = {
  // RE Campaign
  re_scraper:      're_analyzer',
  re_analyzer:     're_tts',
  re_tts:          're_glabs',
  re_glabs:        're_ffmpeg',
  re_ffmpeg:       're_social_poster',
  
  // Pillar Campaign
  pillar_sourcing:  'pillar_generator',
  pillar_generator: 'pillar_tts',
  pillar_tts:       'pillar_glabs',
  pillar_glabs:     'pillar_ffmpeg',
  pillar_ffmpeg:    'pillar_social_poster',

  // Recipe Campaign
  recipe_generator: 'recipe_glabs',
  recipe_glabs:     'recipe_exporter',
};

const AI_QUEUES = ['pillar_generator', 're_analyzer', 'recipe_generator'];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getActiveAiTasksCount(activeLocks) {
  let count = 0;
  for (const key of activeLocks) {
    if (key.startsWith('ai_active_')) count++;
  }
  return count;
}

async function claimNextJobWithLock(queueName, activeLocks) {
  const db = getDb();
  const now = new Date().toISOString();
  
  // Get up to 50 pending jobs for this queue
  const pendingJobs = await db.prepare(`
    SELECT * FROM scheduler_jobs
    WHERE queue_name = ? AND status = 'pending' AND run_at <= ?
    ORDER BY run_at ASC
    LIMIT 50
  `).all(queueName, now);
  
  for (const job of pendingJobs) {
    let lockKey = `job_${job.id}`;
    if (job.payload) {
      try {
        const payloadObj = JSON.parse(job.payload);
        if (payloadObj && payloadObj.item_id) {
          lockKey = `item_${payloadObj.item_id}`;
        }
      } catch (_) {}
    }
    
    // If this item is already being processed, skip this job
    if (activeLocks.has(lockKey)) {
      continue;
    }
    
    // Atomically claim the job
    const updateRes = await db.prepare(`
      UPDATE scheduler_jobs SET status = 'running', started_at = ?, attempts = attempts + 1
      WHERE id = ? AND status = 'pending'
    `).run(now, job.id);
    
    if (updateRes.changes > 0) {
      return { 
        job: { ...job, status: 'running', started_at: now, attempts: job.attempts + 1 },
        lockKey 
      };
    }
  }
  return null;
}

async function triggerNextPipelineJob(queueName, itemId) {
  const nextQueue = PIPELINE_SEQUENCE[queueName];
  if (!nextQueue) return;
  
  // Check if the next queue is enabled in config
  const config = getSchedulerConfig(nextQueue);
  if (!config || !config.is_enabled) return;
  
  console.log(`⚡ [Scheduler Fast-Forward] Pipeline progress: ${queueName} completed. Enqueuing next stage: ${nextQueue} for item #${itemId}`);
  createJob(nextQueue, { item_id: itemId });
  
  // Trigger a tick immediately so the next job is claimed and processed right away!
  setImmediate(() => {
    tick().catch(err => console.error('[Scheduler Fast-Forward] Tick error:', err));
  });
}

/**
 * Process pending jobs from a queue concurrently.
 */
async function processQueue(queueName) {
  // Concurrency limits: AI queues have max 2 active globally. Other queues can run up to 3 jobs in parallel.
  const isAiQueue = AI_QUEUES.includes(queueName);
  const limit = isAiQueue ? 2 : 3;
  
  const promises = [];
  
  for (let i = 0; i < limit; i++) {
    // If it's an AI queue, check if global limit of 2 is reached
    if (isAiQueue && getActiveAiTasksCount(state.activeLocks) >= 2) {
      break;
    }
    
    const claim = await claimNextJobWithLock(queueName, state.activeLocks);
    if (!claim) break;
    
    const { job, lockKey } = claim;
    
    // Add locks to set
    state.activeLocks.add(lockKey);
    let aiLockKey = null;
    if (isAiQueue) {
      aiLockKey = `ai_active_${job.id}`;
      state.activeLocks.add(aiLockKey);
    }
    
    let tenantId = job.tenant_id || 'default_tenant';
    if (tenantId === 'default_tenant' && job.payload) {
      try {
        const parsed = JSON.parse(job.payload);
        if (parsed && parsed.tenant_id) {
          tenantId = parsed.tenant_id;
        }
      } catch (_) {}
    }
    let logFile = null;
    if (queueName.startsWith('re_')) {
      logFile = path.join(process.cwd(), 'public', `re_campaign_logs_${tenantId}.txt`);
    } else if (queueName.startsWith('pillar_') || queueName === 'pillar_sourcing' || queueName === 'pillar_generator') {
      logFile = path.join(process.cwd(), 'public', `opc_logs_${tenantId}.txt`);
    } else if (queueName.startsWith('instant_')) {
      logFile = path.join(process.cwd(), 'public', `instant_factory_logs_${tenantId}.txt`);
    }

    // Execute job asynchronously
    const executeJob = async () => {
      const { tenantContext } = await import('./tenant-context.js');
      await tenantContext.run(tenantId, async () => {
        try {
          console.log(`🚀 [Scheduler] Processing job #${job.id} on queue [${queueName}]`);
          
          // Throttling protection for Gemini API rate limits
          if (isAiQueue) {
            console.log(`⏳ [Rate Limit Safeguard] Gemini API Throttling active: sleeping for 4 seconds...`);
            await sleep(4000);
          }
          
          const procs = await getProcessors();
          const processorMap = {
            scraper:        procs.processScraper,
            analyzer:       procs.processAnalyzer,
            ideation:       procs.processIdeation,
            production:     procs.processProduction,
            glabs:          procs.processGLabs,
            re_scraper:     procs.processReScraper,
            re_analyzer:    procs.processReReanalyzer || procs.processReAnalyzer,
            glabs_campaign: procs.processGLabsCampaign,
            re_tts:         procs.processReTts,
            re_glabs:       procs.processReGlabs,
            re_ffmpeg:      procs.processReFfmpeg,
            re_social_poster: procs.processReSocialPoster,
            re_plus_recomm:   procs.processRePlusRecomm,
            pillar_sourcing:  procs.processRowProductSourcing,
            pillar_generator: procs.processPillarGenerator,
            pillar_tts:       procs.processPillarTts,
            pillar_glabs:     procs.processPillarGlabs,
            pillar_ffmpeg:    procs.processPillarFfmpeg,
            pillar_social_poster: procs.processPillarSocialPoster,
            product_scraper:  procs.processProductScraper,
            re_deconstruct:   procs.processDeconstruct,
            recipe_generator: procs.processRecipeGenerator,
            recipe_glabs:     procs.processRecipeGLabs,
            recipe_exporter:  procs.processRecipeExporter,
          };

          const processor = processorMap[queueName];
          if (!processor) {
            failJob(job.id, `No processor found for queue: ${queueName}`);
            return;
          }

          const payload = job.payload ? JSON.parse(job.payload) : null;
          const result = await processor(payload, job);
          
          if (result && result.skip) {
            completeJob(job.id, { skipped: true, reason: result.reason });
          } else {
            completeJob(job.id, result);
            
            // Fast-Forward Progression: If result has item_id and is not skipped
            if (result && result.item_id) {
              triggerNextPipelineJob(queueName, result.item_id);
            }
          }
        } catch (error) {
          console.error(`[Scheduler] ${queueName} job #${job.id} failed:`, error.message);
          failJob(job.id, error.message);
        } finally {
          // Release locks
          state.activeLocks.delete(lockKey);
          if (aiLockKey) {
            state.activeLocks.delete(aiLockKey);
          }
        }
      });
    };

    const promise = (async () => {
      if (logFile) {
        await logContextStorage.run(logFile, executeJob);
      } else {
        await executeJob();
      }
    })();
    
    promises.push(promise);
  }
  
  if (promises.length > 0) {
    await Promise.all(promises);
    return true;
  }
  return false;
}

/**
 * Main tick: runs every 30 seconds. Checks all queues, creates jobs if needed, processes them.
 */
async function tick() {
  if (!state.isRunning) return;

  const configs = getAllSchedulerConfigs();

  for (const config of configs) {
    const queueName = config.queue_name;

    // Process each queue asynchronously so a stuck job in one queue doesn't block other queues
    (async () => {
      try {
        // Step 1: Maybe create new jobs based on schedule (ONLY if queue is enabled)
        if (config.is_enabled) {
          await maybeCreateJob(queueName, config);
        }

        // Step 2: Process pending jobs (runs manual triggers even if queue is disabled!)
        const processed = await processQueue(queueName);
        if (processed) {
          console.log(`[Scheduler] Successfully processed job from queue: ${queueName}`);
        }
      } catch (error) {
        console.error(`[Scheduler] Tick error for ${queueName}:`, error.message);
      }
    })();
  }
}

// ========================
// Public API
// ========================

export function startScheduler() {
  if (state.isRunning) {
    console.log('[Scheduler] Already running.');
    return;
  }

  state.isRunning = true;
  console.log('🏭 [Scheduler V4] Starting with 15s polling interval...');

  // Run first tick immediately
  tick().catch(err => console.error('[Scheduler] Initial tick error:', err));

  // Then poll every 15 seconds
  state.schedulerInterval = setInterval(() => {
    tick().catch(err => console.error('[Scheduler] Tick error:', err));
  }, 15_000);
}

export function stopScheduler() {
  state.isRunning = false;
  if (state.schedulerInterval) {
    clearInterval(state.schedulerInterval);
    state.schedulerInterval = null;
  }
  console.log('🛑 [Scheduler V4] Stopped.');
}

export function isSchedulerRunning() {
  return state.isRunning;
}

export function getSchedulerStatus() {
  return {
    running: state.isRunning,
    queues: Object.entries(QUEUE_DEFS).map(([name, def]) => ({
      name,
      label: def.label,
      cost: def.cost,
    })),
  };
}
