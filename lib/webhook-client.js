import { getSetting, getDb, getGlabsTaskRoute, getGlabsTaskRouteSync } from './db.js';
import { sanitizeI2vPrompt } from './prompts.js';
import { addGlabsJob, getBullMqJobStatus } from './queue.js';
import { getActiveTenantId } from './tenant-context.js';
import http from 'http';
import https from 'https';

// Custom raw HTTP fetch drop-in wrapper to bypass Next.js monkeypatches and Undici Keep-Alive socket pool issues
async function rawFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const transport = parsedUrl.protocol === 'https:' ? https : http;
      
      const headers = { ...options.headers };
      let body = options.body;
      
      if (body) {
        if (typeof body === 'object') {
          body = JSON.stringify(body);
        }
        headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = transport.request(url, {
        method: (options.method || 'GET').toUpperCase(),
        headers,
        signal: options.signal
      }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: {
              get(name) {
                return res.headers[name.toLowerCase()];
              },
              entries() {
                return Object.entries(res.headers);
              }
            },
            json: async () => JSON.parse(buffer.toString('utf8')),
            text: async () => buffer.toString('utf8'),
            arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (body) {
        req.write(body);
      }
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// Redirect all local fetch calls in this module to rawFetch
const fetch = rawFetch;

// In-memory maps for transparent fallback redirection
const taskParamsMap = new Map();
const taskMapRedirects = new Map();

function isQuotaError(errorMessage) {
  if (!errorMessage) return false;
  const msg = errorMessage.toLowerCase();
  return msg.includes('quota') || msg.includes('limit') || msg.includes('exhausted') || msg.includes('429');
}

/**
 * Client for the local webhook API (Veo/Imagen generation)
 * Default: http://127.0.0.1:8765
 */

import { exec } from 'child_process';

function ensureGatewaySshTunnel() {
  // SSH Tunnel is deprecated, as G-Labs is now directly accessible at 100.64.70.61 via Tailscale
}

function getBaseUrl(taskId = null) {
  if (taskId) {
    try {
      const route = getGlabsTaskRouteSync(taskId);
      if (route && route.host && route.port) {
        return `http://${route.host}:${route.port}`;
      }
    } catch (_) {}
  }
  const port = getSetting('webhook_port') || process.env.WEBHOOK_PORT || '8765';
  const host = getSetting('webhook_host') || process.env.WEBHOOK_HOST || '100.64.70.61';
  return `http://${host}:${port}`;
}

function getApiKey(taskId = null) {
  if (taskId) {
    try {
      const route = getGlabsTaskRouteSync(taskId);
      if (route && route.api_key) return route.api_key;
    } catch (_) {}
  }
  return getSetting('webhook_api_key') || '';
}

function getHeaders(taskId = null) {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': getApiKey(taskId),
  };
}

/**
 * Apply random safety delay before sending requests to G-Labs to prevent Google Flow rate limits.
 */
async function applyRandomDelay() {
  const delayEnabled = getSetting('webhook_delay_enabled') !== null
    ? Number(getSetting('webhook_delay_enabled')) === 1
    : true; // Default to true if not set yet
  
  if (!delayEnabled) return;

  const minSetting = getSetting('webhook_delay_min');
  const maxSetting = getSetting('webhook_delay_max');

  const min = minSetting !== null ? parseInt(minSetting, 10) : 10;
  const max = maxSetting !== null ? parseInt(maxSetting, 10) : 20;

  if (isNaN(min) || isNaN(max) || min < 0 || max < min) {
    return;
  }

  if (max === 0) return;

  const seconds = Math.floor(Math.random() * (max - min + 1)) + min;
  if (seconds > 0) {
    console.info(`[Webhook Client] Safety delay active. Waiting ${seconds}s before submitting request to G-Labs...`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}

/**
 * Check webhook server health
 */
export async function webhookHealth(hostOverride, portOverride) {
  const host = hostOverride || getSetting('webhook_host') || process.env.WEBHOOK_HOST || '100.64.70.61';
  const port = portOverride || getSetting('webhook_port') || process.env.WEBHOOK_PORT || '8765';
  const targetUrl = `http://${host}:${port}/api/health`;
  const res = await fetch(targetUrl, { signal: AbortSignal.timeout(5000) });
  return res.json();
}

/**
 * Sanitize T2I prompt for Google Imagen/Flow compatibility.
 */
function sanitizeImagePrompt(prompt) {
  if (!prompt) return prompt;
  let cleaned = prompt;

  // 0. Conflict Guard: Strip container terms
  cleaned = cleaned.replace(/,\s*(?:clean\s+)?cardboard\s+box\s+packaging/gi, '');
  cleaned = cleaned.replace(/,\s*(?:clean\s+)?cardboard\s+box/gi, '');

  // 1. Strip NEGATIVE PROMPT section
  cleaned = cleaned.replace(/\s*NEGATIVE PROMPT:.*$/i, '');

  // 2. Strip Midjourney syntax
  cleaned = cleaned.replace(/--ar\s+\d+:\d+/gi, '');
  cleaned = cleaned.replace(/--no\s+\S+/gi, '');

  // 3. Strip LAYER tags
  cleaned = cleaned.replace(/\[LAYER\s+\d+:\s*[^\]]*\]/gi, '');

  // 4. Strip VERTICAL prefix
  cleaned = cleaned.replace(/\(VERTICAL\s+\d+:\d+\)/gi, '');

  // 5. Strip Constraint tags
  cleaned = cleaned.replace(/\(Constraint:\s*[^)]*\)/gi, '');

  // 6. Strip parenthesized label prefixes
  cleaned = cleaned.replace(/\((Anchor|Wardrobe|Product Truth|Environment|Lighting|Frozen Action|Micro-Expression|Texture|Shot on):\s*/gi, '(');

  // 7. Strip strictly directives
  cleaned = cleaned.replace(/,?\s*strictly\s+no\s+[^,)]+/gi, '');
  cleaned = cleaned.replace(/,?\s*strictly\s+\w+\s+\w+/gi, '');

  // 8. Strip safety exclusion phrases
  cleaned = cleaned.replace(/,?\s*cropped from the elbow down to show only the forearms and hands/gi, '');
  cleaned = cleaned.replace(/,?\s*omitting the face,?\s*head,?\s*neck,?\s*chest,?\s*and shoulders/gi, '');
  cleaned = cleaned.replace(/,?\s*showcasing precise hand actions and movements/gi, '');

  // 9. Strip duplicate wardrobe description
  const gamisPattern = /wearing a modest loose-fitting gamis dress with long flowing sleeves covering the arms completely down to the wrists/gi;
  let gamisCount = 0;
  cleaned = cleaned.replace(gamisPattern, (match) => {
    gamisCount++;
    return gamisCount === 1 ? 'wearing a modest gamis dress with long sleeves' : '';
  });

  // 10. Clean up extra punctuation/whitespace
  cleaned = cleaned.replace(/\(\s*\)/g, '');
  cleaned = cleaned.replace(/,\s*,/g, ',');
  cleaned = cleaned.replace(/,\s*\)/g, ')');
  cleaned = cleaned.replace(/\(\s*,/g, '(');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Submit image generation request
 */
export async function generateImage({ prompt, model, aspect_ratio, reference_images, upscale, webhookOverride }) {
  await applyRandomDelay();
  const primaryModel = model || getSetting('webhook_image_model') || 'nano_banana_pro';
  const sanitizedPrompt = sanitizeImagePrompt(prompt);
  if (reference_images !== undefined && (!Array.isArray(reference_images) || reference_images.some(ref => typeof ref !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/i.test(ref)))) {
    const error = new Error('Format reference image T2I tidak valid.');
    error.code = 'INVALID_IMAGE_REFERENCE';
    throw error;
  }

  const useQueue = process.env.ENABLE_REDIS_QUEUE === 'true' || getSetting('enable_redis_queue') === '1';
  if (useQueue) {
    try {
      const tenantId = getActiveTenantId();
      const job = await addGlabsJob('image', {
        prompt: sanitizedPrompt,
        model: primaryModel,
        aspect_ratio: aspect_ratio || '9:16',
        reference_images,
        upscale,
        webhookOverride
      }, tenantId);
      
      console.log(`[Webhook Client] Enqueued image generation job to BullMQ. Job ID: ${job.id}`);
      return {
        task_id: 'bullmq_' + job.id,
        status: 'pending',
        message: 'Image task queued in BullMQ',
        poll_url: `/api/status/bullmq_${job.id}`
      };
    } catch (err) {
      console.warn(`[Webhook Client] Failed to enqueue image job to BullMQ, falling back to direct HTTP: ${err.message}`);
    }
  }
  const body = {
    prompt: sanitizedPrompt,
    model: primaryModel,
    aspect_ratio: aspect_ratio || '9:16',
  };
  if (reference_images) body.reference_images = reference_images;
  if (upscale) body.upscale = Array.isArray(upscale) ? upscale : [upscale];

  // Resolve webhook endpoint coordinates
  const host = webhookOverride?.webhook_host || getSetting('webhook_host') || process.env.WEBHOOK_HOST || '100.64.70.61';
  const port = webhookOverride?.webhook_port || getSetting('webhook_port') || process.env.WEBHOOK_PORT || '8765';
  const apiKey = webhookOverride?.webhook_api_key || getSetting('webhook_api_key') || '';
  const submitBaseUrl = `http://${host}:${port}`;
  const submitHeaders = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  };

  let resData;
  try {
    const res = await fetch(`${submitBaseUrl}/api/image/generate`, {
      method: 'POST',
      headers: submitHeaders,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const errorMsg = err.error || err.message || `HTTP ${res.status}`;
      
      // Check for quota fallback
      if (primaryModel === 'nano_banana_pro' && isQuotaError(errorMsg)) {
        console.warn(`[Webhook Client] Submission of nano_banana_pro failed: ${errorMsg}. Fallback to nano_banana_2...`);
        return generateImage({ prompt, model: 'nano_banana_2', aspect_ratio, reference_images, upscale, webhookOverride });
      }
      throw new Error(errorMsg);
    }
    resData = await res.json();
  } catch (error) {
    if (primaryModel === 'nano_banana_pro' && isQuotaError(error.message)) {
      console.warn(`[Webhook Client] Submission of nano_banana_pro failed: ${error.message}. Fallback to nano_banana_2...`);
      return generateImage({ prompt, model: 'nano_banana_2', aspect_ratio, reference_images, upscale, webhookOverride });
    }
    throw error;
  }

  // Persist the G-Labs task route destination for transparent status querying
  if (resData?.task_id) {
    taskParamsMap.set(resData.task_id, { prompt, model: primaryModel, aspect_ratio, reference_images, upscale, webhookOverride });
    try {
      const { saveGlabsTaskRoute } = await import('./db.js');
      saveGlabsTaskRoute(resData.task_id, host, port, apiKey);
    } catch (e) {
      console.error('[Webhook Client] Failed to persist task routing:', e.message);
    }
  }
  return resData;
}

/**
 * Submit video generation request
 */
export async function generateVideo({ prompt, model, aspect_ratio, mode, resolution, reference_images, webhookOverride }) {
  await applyRandomDelay();
  const finalPrompt = sanitizeI2vPrompt(prompt);

  let sanitizedRefImages = undefined;
  if (Array.isArray(reference_images) && reference_images.length > 0) {
    sanitizedRefImages = [];
    for (const ref of reference_images) {
      if (!ref || typeof ref !== 'string') continue;
      if (ref.startsWith('data:image/')) {
        sanitizedRefImages.push(ref);
      } else if (ref.startsWith('http://') || ref.startsWith('https://')) {
        try {
          const res = await fetch(ref);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            let mime = 'image/png';
            if (ref.endsWith('.jpg') || ref.endsWith('.jpeg')) mime = 'image/jpeg';
            else if (ref.endsWith('.webp')) mime = 'image/webp';
            sanitizedRefImages.push(`data:${mime};base64,${buf.toString('base64')}`);
          }
        } catch (e) {
          console.warn('[generateVideo] Failed to fetch HTTP reference image:', e.message);
        }
      } else {
        try {
          const fs = await import('fs');
          const path = await import('path');
          const absPath = (!path.isAbsolute(ref) || !fs.existsSync(ref))
            ? path.join(process.cwd(), 'public', ref.startsWith('/') ? ref.slice(1) : ref)
            : ref;

          if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
            const buf = fs.readFileSync(absPath);
            let mime = 'image/png';
            if (absPath.endsWith('.jpg') || absPath.endsWith('.jpeg')) mime = 'image/jpeg';
            else if (absPath.endsWith('.webp')) mime = 'image/webp';
            sanitizedRefImages.push(`data:${mime};base64,${buf.toString('base64')}`);
          } else {
            sanitizedRefImages.push(`data:image/png;base64,${ref}`);
          }
        } catch (e) {
          sanitizedRefImages.push(`data:image/png;base64,${ref}`);
        }
      }
    }
  }

  let videoMode = mode || (sanitizedRefImages && sanitizedRefImages.length > 0 ? 'start_image' : 'text_to_video');
  if (sanitizedRefImages && sanitizedRefImages.length > 0 && (videoMode === 'image_to_video' || videoMode === 't2v')) {
    videoMode = 'start_image';
  }

  const silentPrompt = `silent video, mute, no sound: ${finalPrompt}`;
  const body = {
    prompt: silentPrompt,
    model: model || getSetting('webhook_video_model') || 'veo_31_lite',
    aspect_ratio: aspect_ratio || '9:16',
    mode: videoMode,
  };
  if (resolution) body.resolution = Array.isArray(resolution) ? resolution : [resolution];
  if (sanitizedRefImages && sanitizedRefImages.length > 0) body.reference_images = sanitizedRefImages;

  const useQueue = process.env.ENABLE_REDIS_QUEUE === 'true' || getSetting('enable_redis_queue') === '1';
  if (useQueue) {
    try {
      const tenantId = getActiveTenantId();
      const job = await addGlabsJob('video', {
        prompt: silentPrompt,
        model: model || getSetting('webhook_video_model') || 'veo_31_lite',
        aspect_ratio: aspect_ratio || '9:16',
        mode: videoMode,
        resolution: resolution || undefined,
        reference_images: sanitizedRefImages || undefined,
        webhookOverride
      }, tenantId);
      
      console.log(`[Webhook Client] Enqueued video generation job to BullMQ. Job ID: ${job.id}`);
      return {
        task_id: 'bullmq_' + job.id,
        status: 'pending',
        message: 'Video task queued in BullMQ',
        poll_url: `/api/status/bullmq_${job.id}`
      };
    } catch (err) {
      console.warn(`[Webhook Client] Failed to enqueue video job to BullMQ, falling back to direct HTTP: ${err.message}`);
    }
  }

  // Resolve webhook endpoint coordinates
  const host = webhookOverride?.webhook_host || getSetting('webhook_host') || process.env.WEBHOOK_HOST || '100.64.70.61';
  const port = webhookOverride?.webhook_port || getSetting('webhook_port') || process.env.WEBHOOK_PORT || '8765';
  const apiKey = webhookOverride?.webhook_api_key || getSetting('webhook_api_key') || '';
  const submitBaseUrl = `http://${host}:${port}`;
  const submitHeaders = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  };

  const res = await fetch(`${submitBaseUrl}/api/video/generate`, {
    method: 'POST',
    headers: submitHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  
  const resData = await res.json();
  if (resData?.task_id) {
    try {
      const { saveGlabsTaskRoute } = await import('./db.js');
      saveGlabsTaskRoute(resData.task_id, host, port, apiKey);
    } catch (e) {
      console.error('[Webhook Client] Failed to persist task routing:', e.message);
    }
  }
  return resData;
}

/**
 * Check task status
 */
export async function getTaskStatus(taskId) {
  if (taskId && taskId.startsWith('bullmq_')) {
    const jobId = taskId.replace('bullmq_', '');
    return await getBullMqJobStatus(jobId);
  }

  // Check if this task is redirected to a fallback task
  if (taskMapRedirects.has(taskId)) {
    const realTaskId = taskMapRedirects.get(taskId);
    console.log(`[Webhook Client] Redirecting getTaskStatus for ${taskId} to fallback task ${realTaskId}`);
    const realStatus = await getTaskStatus(realTaskId);
    if (realStatus) {
      realStatus.task_id = taskId;
    }
    return realStatus;
  }

  const res = await fetch(`${getBaseUrl(taskId)}/api/status/${taskId}`, {
    headers: getHeaders(taskId),
  });
  const data = await res.json();

  // If task status is failed, check for daily quota fallback
  if (data?.status === 'failed') {
    const errorMsg = data.error || data.error_detail || data.message || '';
    if (isQuotaError(errorMsg)) {
      const params = taskParamsMap.get(taskId);
      if (params && params.model === 'nano_banana_pro') {
        console.warn(`[Webhook Client] Task ${taskId} failed: quota limit. Retrying with fallback model nano_banana_2...`);
        taskParamsMap.delete(taskId);

        try {
          const retryResult = await generateImage({
            prompt: params.prompt,
            model: 'nano_banana_2',
            aspect_ratio: params.aspect_ratio,
            reference_images: params.reference_images,
            upscale: params.upscale,
            webhookOverride: params.webhookOverride
          });

          if (retryResult?.task_id) {
            const newTaskId = retryResult.task_id;
            console.info(`[Webhook Client] Fallback task ${newTaskId} submitted for failed task ${taskId}.`);
            taskMapRedirects.set(taskId, newTaskId);

            return {
              task_id: taskId,
              status: 'pending',
              message: 'Retrying with fallback model nano_banana_2'
            };
          }
        } catch (retryErr) {
          console.error(`[Webhook Client] Failed to submit fallback task for ${taskId}:`, retryErr.message);
        }
      }
    }
  }

  return data;
}

/**
 * Get task result with file URLs
 */
export async function getTaskResult(taskId) {
  if (taskId && taskId.startsWith('bullmq_')) {
    const jobId = taskId.replace('bullmq_', '');
    return await getBullMqJobStatus(jobId);
  }
  const res = await fetch(`${getBaseUrl(taskId)}/api/result/${taskId}`, {
    headers: getHeaders(taskId),
  });
  return res.json();
}

/**
 * Get file download URL (no auth needed)
 */
export function getFileUrl(filename, taskId = null) {
  let host = '';
  let port = '';
  if (taskId) {
    try {
      const route = getGlabsTaskRouteSync(taskId);
      if (route) {
        host = route.host;
        port = route.port;
      }
    } catch (_) {}
  }
  if (!host && filename) {
    try {
      const { getGlabsTaskRouteByFilenameSync } = require('./db');
      const route = getGlabsTaskRouteByFilenameSync(filename);
      if (route) {
        host = route.host;
        port = route.port;
      }
    } catch (_) {}
  }

  if (host && port) {
    return `http://${host}:${port}/api/files/${filename}`;
  }
  return `${getBaseUrl()}/api/files/${filename}`;
}

/**
 * List all tasks
 */
export async function listTasks() {
  const res = await fetch(`${getBaseUrl()}/api/tasks`, {
    headers: getHeaders(),
  });
  return res.json();
}
