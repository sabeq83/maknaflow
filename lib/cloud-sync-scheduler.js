import { 
  getSetting, 
  setSetting, 
  getDb, 
  createReCampaign, 
  addReCampaignItems,
  createPillarCampaign, 
  createPillarCampaignItem 
} from './db.js';

const globalRef = global;
if (!globalRef.cloudSyncSchedulerState) {
  globalRef.cloudSyncSchedulerState = {
    interval: null,
    isRunning: false,
    lastTickTime: null,
    lastTickStatus: 'Idle',
    logs: [],
  };
}
const state = globalRef.cloudSyncSchedulerState;

function addLog(message, type = 'info') {
  const logEntry = {
    time: new Date().toISOString(),
    message,
    type
  };
  state.logs.unshift(logEntry);
  if (state.logs.length > 50) {
    state.logs.pop();
  }
  console.log(`[CloudSync] [${type.toUpperCase()}] ${message}`);
}

export function getCloudSyncState() {
  return {
    isRunning: state.isRunning,
    lastTickTime: state.lastTickTime,
    lastTickStatus: state.lastTickStatus,
    logs: state.logs
  };
}

export async function tickCloudSync() {
  state.lastTickTime = new Date().toISOString();
  
  const isEnabled = getSetting('cloud_sync_enabled') === '1';
  if (!isEnabled) {
    state.lastTickStatus = 'Disabled';
    return;
  }
  
  state.lastTickStatus = 'Running';
  
  const cloudHubUrl = getSetting('cloud_hub_url') || process.env.CLOUD_HUB_URL || 'http://localhost:3001';
  const secretCloudToken = getSetting('secret_cloud_token') || process.env.SECRET_CLOUD_TOKEN || 'makna_cloud_secret_hub_token_2026';
  
  const db = getDb();
  
  // ==========================================
  // PHASE 1: Fetch New Jobs from Cloud Hub
  // ==========================================
  try {
    addLog(`Polling jobs from cloud control plane: ${cloudHubUrl}...`, 'info');
    
    const res = await fetch(`${cloudHubUrl}/api/sync/jobs`, {
      headers: {
        'Authorization': `Bearer ${secretCloudToken}`
      }
    });
    
    if (!res.ok) {
      throw new Error(`Cloud Hub API returned status ${res.status}`);
    }
    
    const data = await res.json();
    setSetting('cloud_last_sync_status', 'success');
    setSetting('cloud_last_sync_error', '');
    setSetting('cloud_last_poll_time', new Date().toISOString());
    
    if (data.success && Array.isArray(data.jobs)) {
      if (data.jobs.length > 0) {
        addLog(`Found ${data.jobs.length} cloud job(s)`, 'info');
      }
      
      for (const job of data.jobs) {
        const localCampaignId = `cloud_${job.id}`;
        
        // Check if already registered locally
        let exists = false;
        if (job.type === 'RE') {
          const check = await db.prepare('SELECT id FROM re_campaigns WHERE id = ?').get(localCampaignId);
          exists = !!check;
        } else if (job.type === 'OPC') {
          const check = await db.prepare('SELECT id FROM pillar_campaigns WHERE id = ?').get(localCampaignId);
          exists = !!check;
        }
        
        if (!exists) {
          addLog(`Registering new cloud job: ${job.id} (${job.type})`, 'info');
          
          if (job.type === 'RE') {
            const conf = job.config || {};
            createReCampaign({
              id: localCampaignId,
              campaign_name: `${job.brand_name || 'Brand'} (Cloud ${job.id})`,
              aspect_ratio: conf.aspectRatio || '9:16',
              target_ai: conf.targetAi || 'Google Veo (8s)',
              custom_instruction: conf.customInstruction || '',
              video_model: conf.videoModel || 'veo_31_lite',
              words_per_clip: conf.wordsPerClip || '17-19 kata',
              face_visibility: conf.faceVisibility || 'Faceless',
              enable_tts: conf.enableTts ? 1 : 0,
              enable_glabs: conf.enableGLabs ? 1 : 0,
              enable_ffmpeg: conf.enableFfmpeg ? 1 : 0,
              enable_social_post: 0,
              local_scheduler: 1,
            });
            addReCampaignItems(localCampaignId, [job.source_url]);
          } else if (job.type === 'OPC') {
            const conf = job.config || {};
            createPillarCampaign({
              id: localCampaignId,
              campaign_name: `${job.brand_name || 'Brand'} (Cloud ${job.id})`,
              content_pillar: conf.contentPillar || '',
              custom_hook: conf.customHook || '',
              visual_action_guideline: conf.visualActionGuideline || conf.visualIdea || '',
              custom_instruction: conf.customInstruction || '',
              aspect_ratio: conf.aspectRatio || '9:16',
              target_ai: conf.targetAi || 'Google Veo (8s)',
              video_model: conf.videoModel || 'veo_31_lite',
              enable_tts: conf.enableTts ? 1 : 0,
              enable_glabs: conf.enableGLabs ? 1 : 0,
              enable_ffmpeg: conf.enableFfmpeg ? 1 : 0,
              enable_social_post: 0,
              local_scheduler: 1,
              words_per_clip: conf.wordsPerClip || '17-19 kata',
              face_visibility: conf.faceVisibility || 'Faceless',
            });
            
            const creativePayload = {
              row_number: 1,
              content_pillar: conf.contentPillar || '',
              custom_hook: conf.customHook || '',
              visual_action_guideline: conf.visualActionGuideline || conf.visualIdea || '',
              custom_instruction: conf.customInstruction || '',
              source_product_url: conf.productUrl || '',
              product_image_url: conf.productImageUrl || '',
            };
            
            createPillarCampaignItem({
              campaign_id: localCampaignId,
              row_creative_payload: JSON.stringify(creativePayload),
              generation_status: (conf.productBridging && conf.productUrl) ? 'pending_sourcing' : 'pending',
            });
          }
          
          // Notify cloud plane that local engine has starting processing
          try {
            await fetch(`${cloudHubUrl}/api/sync/status`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${secretCloudToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                job_id: job.id,
                type: job.type,
                status_engine: 'processing'
              })
            });
            addLog(`Updated cloud status for job ${job.id} to: processing`, 'info');
          } catch (statusErr) {
            addLog(`Failed to report 'processing' status for job ${job.id}: ${statusErr.message}`, 'warning');
          }
        }
      }
    }
  } catch (err) {
    setSetting('cloud_last_sync_status', 'error');
    setSetting('cloud_last_sync_error', err.message);
    addLog(`Poll error: ${err.message}`, 'error');
  }

  // ==========================================
  // PHASE 2: Check Statuses & Report Completed/Failed
  // ==========================================
  
  // 1. RE campaigns completion checks
  try {
    const runningReCampaigns = await db.prepare(`
      SELECT id FROM re_campaigns 
      WHERE id LIKE 'cloud_%' AND status = 'running'
    `).all();
    
    for (const campaign of runningReCampaigns) {
      const jobId = campaign.id.replace('cloud_', '');
      const items = await db.prepare('SELECT * FROM re_campaign_items WHERE campaign_id = ?').all(campaign.id);
      if (items.length === 0) continue;
      
      const item = items[0];
      
      if (item.ffmpeg_status === 'completed' && item.drive_link) {
        addLog(`Reporting complete for RE Job: ${jobId}`, 'info');
        try {
          const res = await fetch(`${cloudHubUrl}/api/sync/complete`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${secretCloudToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              job_id: jobId,
              type: 'RE',
              drive_link: item.drive_link,
              video_status: 'Rendered'
            })
          });
          if (res.ok) {
            await db.prepare("UPDATE re_campaigns SET status = 'completed' WHERE id = ?").run(campaign.id);
            addLog(`Successfully synced and completed RE Job: ${jobId}`, 'success');
          } else {
            const txt = await res.text();
            addLog(`Failed to report sync-complete for RE Job ${jobId}: ${txt}`, 'error');
          }
        } catch (err) {
          addLog(`Fetch error reporting complete for RE Job ${jobId}: ${err.message}`, 'error');
        }
      } else if (
        item.scrape_status === 'failed' ||
        item.analyze_status === 'failed' ||
        item.tts_status === 'failed' ||
        item.visual_status === 'failed' ||
        item.ffmpeg_status === 'failed'
      ) {
        const retryCount = item.retry_count || 0;
        if (retryCount >= 3) {
          addLog(`Reporting failure for RE Job: ${jobId}`, 'warning');
          try {
            const res = await fetch(`${cloudHubUrl}/api/sync/status`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${secretCloudToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                job_id: jobId,
                type: 'RE',
                status_engine: 'failed'
              })
            });
            if (res.ok) {
              await db.prepare("UPDATE re_campaigns SET status = 'failed' WHERE id = ?").run(campaign.id);
              addLog(`Successfully reported failure for RE Job: ${jobId}`, 'warning');
            }
          } catch (err) {
            addLog(`Fetch error reporting failure for RE Job ${jobId}: ${err.message}`, 'error');
          }
        }
      }
    }
  } catch (reErr) {
    addLog(`RE Check error: ${reErr.message}`, 'error');
  }

  // 2. OPC campaigns completion checks
  try {
    const runningPillarCampaigns = await db.prepare(`
      SELECT id FROM pillar_campaigns 
      WHERE id LIKE 'cloud_%' AND status = 'running'
    `).all();
    
    for (const campaign of runningPillarCampaigns) {
      const jobId = campaign.id.replace('cloud_', '');
      const items = await db.prepare('SELECT * FROM pillar_campaign_items WHERE campaign_id = ?').all(campaign.id);
      if (items.length === 0) continue;
      
      const item = items[0];
      
      if (item.ffmpeg_status === 'completed' && item.drive_link) {
        addLog(`Reporting complete for OPC Job: ${jobId}`, 'info');
        try {
          const res = await fetch(`${cloudHubUrl}/api/sync/complete`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${secretCloudToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              job_id: jobId,
              type: 'OPC',
              drive_link: item.drive_link,
              video_status: 'Rendered'
            })
          });
          if (res.ok) {
            await db.prepare("UPDATE pillar_campaigns SET status = 'completed' WHERE id = ?").run(campaign.id);
            addLog(`Successfully synced and completed OPC Job: ${jobId}`, 'success');
          } else {
            const txt = await res.text();
            addLog(`Failed to report sync-complete for OPC Job ${jobId}: ${txt}`, 'error');
          }
        } catch (err) {
          addLog(`Fetch error reporting complete for OPC Job ${jobId}: ${err.message}`, 'error');
        }
      } else if (
        item.generation_status === 'failed' ||
        item.tts_status === 'failed' ||
        item.visual_status === 'failed' ||
        item.ffmpeg_status === 'failed'
      ) {
        const retryCount = item.retry_count || 0;
        if (retryCount >= 3) {
          addLog(`Reporting failure for OPC Job: ${jobId}`, 'warning');
          try {
            const res = await fetch(`${cloudHubUrl}/api/sync/status`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${secretCloudToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                job_id: jobId,
                type: 'OPC',
                status_engine: 'failed'
              })
            });
            if (res.ok) {
              await db.prepare("UPDATE pillar_campaigns SET status = 'failed' WHERE id = ?").run(campaign.id);
              addLog(`Successfully reported failure for OPC Job: ${jobId}`, 'warning');
            }
          } catch (err) {
            addLog(`Fetch error reporting failure for OPC Job ${jobId}: ${err.message}`, 'error');
          }
        }
      }
    }
  } catch (opcErr) {
    addLog(`OPC Check error: ${opcErr.message}`, 'error');
  }
}

export function startCloudSyncScheduler() {
  if (state.isRunning) {
    console.log('[CloudSync] Daemon is already running.');
    return;
  }
  
  state.isRunning = true;
  addLog('MAKNA Hub Sync daemon starting...', 'info');
  
  // Run first tick
  tickCloudSync().catch(err => console.error('[CloudSync] Initial tick error:', err.message));
  
  // Set recurring interval based on user setting
  const intervalSec = Number(getSetting('cloud_sync_interval') || '60');
  state.interval = setInterval(() => {
    tickCloudSync().catch(err => console.error('[CloudSync] Tick error:', err.message));
  }, intervalSec * 1000);
  
  addLog(`MAKNA Hub Sync daemon started with ${intervalSec}s polling interval.`, 'info');
}

export function stopCloudSyncScheduler() {
  state.isRunning = false;
  state.lastTickStatus = 'Stopped';
  if (state.interval) {
    clearInterval(state.interval);
    state.interval = null;
  }
  addLog('MAKNA Hub Sync daemon stopped.', 'info');
}

export function isCloudSyncSchedulerRunning() {
  return state.isRunning;
}
