import { getDb, listReCampaignItems, listPillarCampaignItems, getSetting, updateReCampaignItem, updatePillarCampaignItem, updateInstantCampaignItem, listInstantCampaignItems } from './db.js';
import { 
  processReScraper, 
  processReAnalyzer, 
  processReTts, 
  processReGlabs, 
  processReFfmpeg, 
  processReSocialPoster,
  processPillarGenerator,
  processPillarTts,
  processPillarGlabs,
  processPillarFfmpeg,
  processPillarSocialPoster,
  processRowProductSourcing,
  processInstantRowProductSourcing,
  processInstantGenerator,
  processInstantTts,
  processInstantGlabs,
  processInstantFfmpeg,
  processInstantSocialPoster,
  processRecipeGenerator,
  processRecipeGLabs,
  processRecipeExporter
} from './scheduler-processors.js';
import { runSyncWorker } from './sheets-autopilot-worker.js';
import path from 'path';
import { logContextStorage } from './console-hook.js';
import { getGeminiModel } from './gemini.js';
import { buildProductBridgingInjectorPrompt } from './prompts.js';
import { parseGeminiJSON } from './json-parser.js';


const globalRef = global;
if (!globalRef.campaignSchedulerState) {
  globalRef.campaignSchedulerState = {
    interval: null,
    isRunning: false,
    activeTasks: new Set(), // Melacak item_id yang sedang aktif diproses untuk mencegah pemrosesan ganda
    lastSheetsSyncTime: 0,
    isSheetsSyncRunning: false,
    lastTickAt: null,
    lastError: null,
  };
}
const state = globalRef.campaignSchedulerState;
state.lastTickAt ??= null;
state.lastError ??= null;

import { isWorkerEnabled, getNodeRole } from './node-config.js';

export function startCampaignScheduler() {
  if (!isWorkerEnabled()) {
    console.log(`[Campaign Scheduler] Node role is '${getNodeRole()}'. Background Queue Worker disabled on this node.`);
    return;
  }
  if (state.isRunning) {
    console.log('[Campaign Scheduler] Already running.');
    return;
  }
  state.isRunning = true;
  console.log('🏭 [Campaign Scheduler] Starting campaign-based scheduler with 15s interval...');
  
  // Run immediately on start
  tickCampaignScheduler().catch(err => {
    state.lastError = err.message;
    console.error('[Campaign Scheduler] Initial tick error:', err);
  });

  state.interval = setInterval(async () => {
    try {
      await tickCampaignScheduler();
    } catch (e) {
      state.lastError = e.message;
      console.error('[Campaign Scheduler] Tick error:', e);
    }
  }, 15_000);
}

export function stopCampaignScheduler() {
  state.isRunning = false;
  if (state.interval) {
    clearInterval(state.interval);
    state.interval = null;
  }
  console.log('🛑 [Campaign Scheduler] Stopped.');
}

export function isCampaignSchedulerRunning() {
  return state.isRunning;
}

export function getCampaignSchedulerRuntime() {
  return {
    running: state.isRunning,
    last_tick_at: state.lastTickAt,
    last_error: state.lastError
  };
}

function isItemFinished(item, campaign) {
  const actualNeedsSocial = campaign.enable_social_post === 1 || campaign.post_facebook_draft === 1 || campaign.post_youtube_draft === 1 || campaign.post_tiktok_draft === 1;

  if (
    item.scrape_status === 'failed' ||
    item.analyze_status === 'failed' ||
    item.tts_status === 'failed' ||
    item.visual_status === 'failed' ||
    item.ffmpeg_status === 'failed' ||
    (actualNeedsSocial && item.social_post_status === 'failed')
  ) {
    return true;
  }

  const scrapeSuccess = item.scrape_status === 'downloaded' || item.scrape_status === 'skipped' || item.scrape_status === 'ready' || !item.scrape_status;
  if (!scrapeSuccess) return false;

  const analyzeSuccess = item.analyze_status === 'analyzed' || item.analyze_status === 'skipped' || !item.analyze_status;
  if (!analyzeSuccess) return false;

  const ttsSuccess = item.tts_status === 'completed' || item.tts_status === 'skipped';
  if (!ttsSuccess) return false;

  const visualSuccess = item.visual_status === 'completed' || item.visual_status === 'skipped';
  if (!visualSuccess) return false;

  const ffmpegSuccess = item.ffmpeg_status === 'completed' || item.ffmpeg_status === 'skipped';
  if (!ffmpegSuccess) return false;

  if (actualNeedsSocial) {
    return item.social_post_status === 'completed' || item.social_post_status === 'skipped';
  }

  return true;
}

function isPillarItemFinished(item, campaign) {
  const actualNeedsSocial = campaign.enable_social_post === 1 || campaign.post_facebook_draft === 1 || campaign.post_youtube_draft === 1 || campaign.post_tiktok_draft === 1;

  if (
    item.generation_status === 'failed' ||
    item.tts_status === 'failed' ||
    item.visual_status === 'failed' ||
    item.ffmpeg_status === 'failed' ||
    (actualNeedsSocial && item.social_post_status === 'failed')
  ) {
    return true;
  }

  const generationSuccess = item.generation_status === 'completed';
  if (!generationSuccess) return false;

  const ttsSuccess = item.tts_status === 'completed' || item.tts_status === 'skipped';
  if (!ttsSuccess) return false;

  const visualSuccess = item.visual_status === 'completed' || item.visual_status === 'skipped';
  if (!visualSuccess) return false;

  const ffmpegSuccess = item.ffmpeg_status === 'completed' || item.ffmpeg_status === 'skipped';
  if (!ffmpegSuccess) return false;

  if (actualNeedsSocial) {
    return item.social_post_status === 'completed' || item.social_post_status === 'skipped';
  }

  return true;
}

function isInstantItemFinished(item, campaign) {
  const needsSocial = campaign.post_youtube_draft || campaign.post_tiktok_draft || campaign.post_facebook_draft;
  const actualNeedsSocial = needsSocial && campaign.enable_social_post !== 0;

  if (
    item.generation_status === 'failed' ||
    item.tts_status === 'failed' ||
    item.visual_status === 'failed' ||
    item.ffmpeg_status === 'failed' ||
    (actualNeedsSocial && item.social_post_status === 'failed')
  ) {
    return true;
  }

  const generationSuccess = item.generation_status === 'completed';
  if (!generationSuccess) return false;

  const ttsSuccess = item.tts_status === 'completed' || item.tts_status === 'skipped';
  if (!ttsSuccess) return false;

  const visualSuccess = item.visual_status === 'completed' || item.visual_status === 'skipped';
  if (!visualSuccess) return false;

  const ffmpegSuccess = item.ffmpeg_status === 'completed' || item.ffmpeg_status === 'skipped';
  if (!ffmpegSuccess) return false;

  if (actualNeedsSocial) {
    return item.social_post_status === 'completed' || item.social_post_status === 'skipped';
  }

  return true;
}



export async function tickCampaignScheduler() {
  if (!state.isRunning) return;
  state.lastTickAt = new Date().toISOString();
  state.lastError = null;

  // Reload database caches dynamically on each tick to align multi-process settings
  try {
    const { loadDbCaches } = await import('./db.js');
    await loadDbCaches();
  } catch (cacheErr) {
    console.error('[Campaign Scheduler] Failed to reload DB caches:', cacheErr.message);
  }

  const db = getDb();
  const { tenantContext } = await import('./tenant-context.js');

  await tenantContext.run('__none__', async () => {

  // --- DECONSTRUCT LAB QUEUE RUNNER ---
  const deconstructActive = await getSetting('deconstruct_scheduler_active') !== 'false';
  if (deconstructActive) {
    try {
      const activeBatches = await db.prepare("SELECT id, tenant_id FROM re_deconstruct_batches WHERE status = 'processing'").all();
      for (const batch of activeBatches) {
        const tenantId = batch.tenant_id || 'default_tenant';
        await tenantContext.run(tenantId, async () => {
          // Kunci Pengaman: Pastikan tidak ada video lain dalam batch ini yang sedang diproses
          const activeCount = (await db.prepare(
            "SELECT COUNT(*)::int as cnt FROM re_deconstructed_assets WHERE batch_id = ? AND tenant_id = ? AND status IN ('downloading', 'uploading', 'analyzing')"
          ).get(batch.id, tenantId))?.cnt || 0;

          if (activeCount > 0) {
            return; // Tunggu video aktif selesai terlebih dahulu
          }

          const nextAsset = await db.prepare(
            "SELECT id FROM re_deconstructed_assets WHERE status = 'pending_download' AND batch_id = ? AND tenant_id = ? ORDER BY created_at ASC LIMIT 1"
          ).get(batch.id, tenantId);

          if (nextAsset) {
            const taskKey = `deconstruct_${nextAsset.id}`;
            if (!state.activeTasks.has(taskKey)) {
              console.log(`[Deconstruct Scheduler] Batch ${batch.id} has pending asset ${nextAsset.id}. Running step...`);
              const { processDeconstruct } = await import('./scheduler-processors.js');
              runStep(nextAsset.id, 'deconstruct_run', processDeconstruct, taskKey);
            }
          } else {
            const total = (await db.prepare('SELECT COUNT(*)::int as cnt FROM re_deconstructed_assets WHERE batch_id = ? AND tenant_id = ?').get(batch.id, tenantId))?.cnt || 0;
            const processed = (await db.prepare("SELECT COUNT(*)::int as cnt FROM re_deconstructed_assets WHERE batch_id = ? AND tenant_id = ? AND status IN ('deconstructed', 'failed')").get(batch.id, tenantId))?.cnt || 0;
            
            if (processed >= total && total > 0) {
              console.log(`[Deconstruct Scheduler] Batch ${batch.id} is fully completed (${processed}/${total}). Updating status to completed.`);
              await db.prepare("UPDATE re_deconstruct_batches SET status = 'completed', processed_videos = ? WHERE id = ? AND tenant_id = ?").run(processed, batch.id, tenantId);
            }
          }
        });
      }
    } catch (dbErr) {
      console.error('[Deconstruct Scheduler Error]:', dbErr.message);
    }
  }

  // --- PRODUCT BRIDGING INJECTOR TICKING ENGINE ---
  const bridgeSchedulerActive = await getSetting('bridge_injector_scheduler_active') !== 'false';
  if (bridgeSchedulerActive) {
    try {
      const activeBridgeCampaigns = await db.prepare("SELECT id FROM bridge_injector_campaigns WHERE status IN ('polling_t2i', 'generating_i2v')").all();
      for (const camp of activeBridgeCampaigns) {
        console.log(`[Bridge Injector Scheduler] Polling status for campaign ${camp.id}...`);
        fetch(`http://localhost:3000/api/v2/bridge-injector/poll-status?campaignId=${camp.id}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              console.log(`[Bridge Injector Scheduler] Successful poll for ${camp.id}: status is now ${data.data.status}`);
            } else {
              console.error(`[Bridge Injector Scheduler] Poll error for ${camp.id}: ${data.error}`);
            }
          })
          .catch(err => {
            console.error(`[Bridge Injector Scheduler] Connection error polling status for ${camp.id}:`, err.message);
          });
      }
    } catch (dbErr) {
      console.error('[Bridge Injector Scheduler Error]:', dbErr.message);
    }
  }


  
  // Ambil semua kampanye running (RE Campaign) jika skeduler aktif
  const reSchedulerActive = await getSetting('re_campaigns_scheduler_active') !== 'false';
  const campaigns = reSchedulerActive
    ? await db.prepare("SELECT * FROM re_campaigns WHERE status = 'running'").all()
    : [];
  for (const campaign of campaigns) {
    const tenantId = campaign.tenant_id || 'default_tenant';
    const reLogFile = path.join(process.cwd(), 'public', `re_campaign_logs_${tenantId}.txt`);
    await tenantContext.run(tenantId, async () => {
      await logContextStorage.run(reLogFile, async () => {
      const items = await listReCampaignItems(campaign.id);
      // Ambil nilai pause point kampanye (null = autopilot penuh)
      const pauseAt = campaign.scheduler_pause_at || null;
      
      // Initialize nextAllowedTime map if not exists
      if (!state.nextAllowedTime) {
        state.nextAllowedTime = {};
      }

      // Transition finished items to 'completed' workflow_status
      for (const item of items) {
        if (item.workflow_status === 'production_processing' && isItemFinished(item, campaign)) {
          updateReCampaignItem(item.id, { workflow_status: 'completed' });
          item.workflow_status = 'completed';
        }
      }

      // Cari item pertama yang belum selesai dan tidak tertahan di review untuk diproses
      let hasActiveItem = false;
      for (const item of items) {
        if (isItemFinished(item, campaign)) {
          continue;
        }

        const taskKey = `re_${item.id}`;
        // Jika item ini sedang diproses di thread lain, tunggu (jangan lanjut ke item berikutnya)
        if (state.activeTasks.has(taskKey)) {
          hasActiveItem = true;
          break;
        }

        // Jika item ini tertahan di review, skip tahapan produksi tapi JANGAN stop loop (terus cari item lain untuk discovery)
        if (item.workflow_status === 'ready_for_review') {
          continue;
        }

        // Di sini kita memproses item!
        hasActiveItem = true;

        // Jika item ini akan mulai diproses (Scrape masih 'pending'), cek jeda aman
        if (item.scrape_status === 'pending') {
          const isFirstItemInCampaign = items[0].id === item.id;
          
          if (!isFirstItemInCampaign) {
            const allowedTime = state.nextAllowedTime[campaign.id];
            const now = Date.now();
            
            if (!allowedTime) {
              const COOLDOWN_MS = 30_000; // 30 seconds safe delay
              state.nextAllowedTime[campaign.id] = now + COOLDOWN_MS;
              console.log(`⏳ [Campaign Scheduler] Campaign "${campaign.campaign_name}": Memberikan jeda aman 30 detik sebelum memproses URL berikutnya (Item #${item.id}).`);
              break;
            }
            
            if (now < allowedTime) {
              const remainingSecs = Math.ceil((allowedTime - now) / 1000);
              console.log(`⏳ [Campaign Scheduler] Campaign "${campaign.campaign_name}": Menunggu jeda aman... sisa ${remainingSecs} detik.`);
              break;
            }
            
            // Jeda aman selesai, hapus tracker
            delete state.nextAllowedTime[campaign.id];
          }
        }
        
        // 1. Scrape Stage
        if (item.scrape_status === 'pending') {
          runStep(item.id, 're_scraper', processReScraper, taskKey);
          break;
        }
        
        // 2. Analyze Stage
        if (item.scrape_status === 'downloaded' && item.analyze_status === 'pending') {
          runStep(item.id, 're_analyzer', processReAnalyzer, taskKey);
          break;
        }
        
        // 3. TTS Stage
        if (item.analyze_status === 'analyzed' && item.tts_status === 'pending') {
          if (item.workflow_status === 'ready_for_review') {
            continue;
          }
          if (pauseAt === 'tts') {
            console.log(`⛔ [Campaign Scheduler] Paused before TTS for item #${item.id} — campaign "${campaign.campaign_name}". Menunggu approval manual.`);
            continue;
          }
          runStep(item.id, 're_tts', processReTts, taskKey);
          break;
        }
        
        // 4. Visuals Stage
        if ((item.tts_status === 'completed' || item.tts_status === 'skipped') && item.visual_status === 'pending') {
          if (pauseAt === 'visuals') {
            console.log(`⛔ [Campaign Scheduler] Paused before G-Labs for item #${item.id} — campaign "${campaign.campaign_name}". Review T2V prompt terlebih dahulu.`);
            continue;
          }
          runStep(item.id, 're_glabs', processReGlabs, taskKey);
          break;
        }
        // Phase B: Polling
        if (item.visual_status === 'processing') {
          runStep(item.id, 're_glabs_poll', processReGlabs, taskKey);
          break;
        }
        
        // 5. FFmpeg Stage
        if ((item.visual_status === 'completed' || item.visual_status === 'skipped') && item.ffmpeg_status === 'pending') {
          if (pauseAt === 'ffmpeg') {
            console.log(`⛔ [Campaign Scheduler] Paused before FFmpeg for item #${item.id} — campaign "${campaign.campaign_name}". Review klip visual terlebih dahulu.`);
            continue;
          }
          runStep(item.id, 're_ffmpeg', processReFfmpeg, taskKey);
          break;
        }
        
        // 6. Social Post Stage
        if ((item.ffmpeg_status === 'completed' || item.ffmpeg_status === 'skipped') && item.social_post_status === 'pending') {
          if (pauseAt === 'social') {
            console.log(`⛔ [Campaign Scheduler] Paused before Social Post for item #${item.id} — campaign "${campaign.campaign_name}". Konfirmasi sebelum posting.`);
            continue;
          }
          runStep(item.id, 're_social_poster', processReSocialPoster, taskKey);
          break;
        }
      }

      if (!hasActiveItem) {
        // Jika semua item sudah selesai/gagal, lakukan deteksi auto-retry pass
        const needsSocial = campaign.post_youtube_draft || campaign.post_tiktok_draft || campaign.post_facebook_draft;
        const actualNeedsSocial = needsSocial && campaign.enable_social_post !== 0;

        const failedItem = items.find(item => {
          const isFailed = item.scrape_status === 'failed' ||
                           item.analyze_status === 'failed' ||
                           item.tts_status === 'failed' ||
                           item.visual_status === 'failed' ||
                           item.ffmpeg_status === 'failed' ||
                           (actualNeedsSocial && item.social_post_status === 'failed');
          const retryCount = item.retry_count !== undefined ? Number(item.retry_count) : 0;
          return isFailed && retryCount < 3;
        });

        if (failedItem) {
          let failedStep = null;
          const updateFields = {
            retry_count: (failedItem.retry_count !== undefined ? Number(failedItem.retry_count) : 0) + 1
          };

          if (failedItem.scrape_status === 'failed') {
            failedStep = 'scrape';
            updateFields.scrape_status = 'pending';
            updateFields.local_video_path = null;
            updateFields.analyze_status = 'pending';
            updateFields.result_json = null;
            updateFields.tts_status = 'pending';
            updateFields.tts_batch_id = null;
            updateFields.visual_status = 'pending';
            updateFields.visual_tasks_json = '[]';
            updateFields.visual_clip_paths = null;
            updateFields.ffmpeg_status = 'pending';
            updateFields.ffmpeg_output_path = null;
            updateFields.upload_status = 'pending';
            updateFields.drive_link = null;
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          } else if (failedItem.analyze_status === 'failed') {
            failedStep = 'analyze';
            updateFields.analyze_status = 'pending';
            updateFields.result_json = null;
            updateFields.tts_status = 'pending';
            updateFields.tts_batch_id = null;
            updateFields.visual_status = 'pending';
            updateFields.visual_clip_paths = null;
            updateFields.ffmpeg_status = 'pending';
            updateFields.ffmpeg_output_path = null;
            updateFields.upload_status = 'pending';
            updateFields.drive_link = null;
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          } else if (failedItem.tts_status === 'failed') {
            failedStep = 'tts';
            updateFields.tts_status = 'pending';
            updateFields.tts_batch_id = null;
            updateFields.visual_status = 'pending';
            updateFields.visual_clip_paths = null;
            updateFields.ffmpeg_status = 'pending';
            updateFields.ffmpeg_output_path = null;
            updateFields.upload_status = 'pending';
            updateFields.drive_link = null;
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          } else if (failedItem.visual_status === 'failed') {
            failedStep = 'visuals';
            updateFields.visual_status = 'pending';
            updateFields.visual_clip_paths = null;
            updateFields.ffmpeg_status = 'pending';
            updateFields.ffmpeg_output_path = null;
            updateFields.upload_status = 'pending';
            updateFields.drive_link = null;
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          } else if (failedItem.ffmpeg_status === 'failed') {
            failedStep = 'ffmpeg';
            updateFields.ffmpeg_status = 'pending';
            updateFields.ffmpeg_output_path = null;
            updateFields.upload_status = 'pending';
            updateFields.drive_link = null;
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          } else if (actualNeedsSocial && failedItem.social_post_status === 'failed') {
            failedStep = 'social';
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          }

          if (failedStep) {
            updateReCampaignItem(failedItem.id, updateFields);
            console.log(`🔄 [Campaign Scheduler] Campaign "${campaign.campaign_name}": Memulai Auto-Retry #${updateFields.retry_count} untuk Item #${failedItem.id} pada langkah ${failedStep.toUpperCase()}.`);
            return;
          }
        }
      }
    });
   });
  }

  // --- PILLAR CAMPAIGN TICKING ENGINE (v8.5) ---
  const opcSchedulerActive = await getSetting('opc_campaigns_scheduler_active') !== 'false';
  const pillarCampaigns = opcSchedulerActive
    ? await db.prepare("SELECT * FROM pillar_campaigns WHERE status = 'running'").all()
    : [];
  for (const campaign of pillarCampaigns) {
    const tenantId = campaign.tenant_id || 'default_tenant';
    const opcLogFile = path.join(process.cwd(), 'public', `opc_logs_${tenantId}.txt`);
    await tenantContext.run(tenantId, async () => {
      await logContextStorage.run(opcLogFile, async () => {
      const items = await listPillarCampaignItems(campaign.id);
      const pauseAt = campaign.scheduler_pause_at || null;
      let hasActiveItem = false;

      // Transition finished items to 'completed' workflow_status
      for (const currentItem of items) {
        if (currentItem.workflow_status === 'production_processing' && isPillarItemFinished(currentItem, campaign)) {
          if (campaign.auto_sync_contentflow) {
            try {
              const { syncApprovedOpcItemToContentFlow } = await import('./content-automation-contentflow.js');
              await syncApprovedOpcItemToContentFlow({ itemId: currentItem.id });
              await updatePillarCampaignItem(currentItem.id, { workflow_status: 'completed' });
              currentItem.workflow_status = 'completed';
            } catch (error) {
              console.error(`[OPC ContentFlow] Item #${currentItem.id} sync tertunda:`, error.message);
            }
          } else {
            await updatePillarCampaignItem(currentItem.id, { workflow_status: 'completed', contentflow_sync_status: 'skipped' });
            currentItem.workflow_status = 'completed';
          }
        }
      }

      for (const currentItem of items) {
        if (isPillarItemFinished(currentItem, campaign)) {
          continue;
        }

        hasActiveItem = true;
        const taskKey = `pillar_${currentItem.id}`;
        // Jika item ini sedang diproses di thread lain, tunggu (jangan lanjut ke item berikutnya)
        if (state.activeTasks.has(taskKey)) {
          continue;
        }
        
        // 0. Product Sourcing Stage
        if (currentItem.generation_status === 'pending_sourcing') {
          // Check if all previous items have completed Fase 1
          const itemIdx = items.findIndex(item => item.id === currentItem.id);
          const prevItemsInFase1 = items.slice(0, itemIdx).some(item => 
            item.generation_status !== 'completed'
          );
          if (prevItemsInFase1) {
            continue; // Wait for previous items to complete Fase 1
          }
          runStep(currentItem.id, 'pillar_sourcing', processRowProductSourcing, taskKey);
          continue;
        }

        // 1. Generation Stage
        if (currentItem.generation_status === 'pending') {
          // Check if all previous items have completed Fase 1
          const itemIdx = items.findIndex(item => item.id === currentItem.id);
          const prevItemsInFase1 = items.slice(0, itemIdx).some(item => 
            item.generation_status !== 'completed'
          );
          if (prevItemsInFase1) {
            continue; // Wait for previous items to complete Fase 1
          }
          runStep(currentItem.id, 'pillar_generator', processPillarGenerator, taskKey);
          continue;
        }
        
        // 2. TTS Stage
        if (currentItem.generation_status === 'completed' && currentItem.tts_status === 'pending') {
          if (currentItem.workflow_status === 'ready_for_review') {
            continue;
          }
          if (pauseAt === 'tts') {
            console.log(`⛔ [Campaign Scheduler] Paused before TTS for OPC item #${currentItem.id} — campaign "${campaign.campaign_name}". Menunggu approval manual.`);
            continue;
          }
          runStep(currentItem.id, 'pillar_tts', processPillarTts, taskKey);
          continue;
        }
        
        // 3. Visuals Stage — Phase A: Submission
        if ((currentItem.tts_status === 'completed' || currentItem.tts_status === 'skipped') && currentItem.visual_status === 'pending') {
          if (pauseAt === 'visuals') {
            console.log(`⛔ [Campaign Scheduler] Paused before G-Labs for OPC item #${currentItem.id} — campaign "${campaign.campaign_name}". Review storyboard & prompt.`);
            continue;
          }
          runStep(currentItem.id, 'pillar_glabs', processPillarGlabs, taskKey);
          continue;
        }
        // Visuals Stage — Phase B: Polling (non-blocking)
        if (currentItem.visual_status === 'processing') {
          runStep(currentItem.id, 'pillar_glabs_poll', processPillarGlabs, taskKey);
        }
        
        // 4. FFmpeg Muxing Stage
        if ((currentItem.visual_status === 'completed' || currentItem.visual_status === 'skipped') && currentItem.ffmpeg_status === 'pending') {
          if (pauseAt === 'ffmpeg') {
            console.log(`⛔ [Campaign Scheduler] Paused before FFmpeg for OPC item #${currentItem.id} — campaign "${campaign.campaign_name}". Review visual clip.`);
            continue;
          }
          runStep(currentItem.id, 'pillar_ffmpeg', processPillarFfmpeg, taskKey);
          continue;
        }
        
        // 5. Social Post Stage
        if ((currentItem.ffmpeg_status === 'completed' || currentItem.ffmpeg_status === 'skipped') && currentItem.social_post_status === 'pending') {
          if (pauseAt === 'social') {
            console.log(`⛔ [Campaign Scheduler] Paused before Social Post for OPC item #${currentItem.id} — campaign "${campaign.campaign_name}". Konfirmasi sebelum posting.`);
            continue;
          }
          runStep(currentItem.id, 'pillar_social_poster', processPillarSocialPoster, taskKey);
          continue;
        }
      }
      
      if (!hasActiveItem) {
        // Jika semua item sudah selesai/gagal, lakukan deteksi auto-retry pass untuk OPC
        const needsSocial = campaign.post_youtube_draft || campaign.post_tiktok_draft || campaign.post_facebook_draft;
        const actualNeedsSocial = needsSocial && campaign.enable_social_post !== 0;

        const failedItem = items.find(item => {
          const isFailed = item.generation_status === 'failed' ||
                           item.tts_status === 'failed' ||
                           item.visual_status === 'failed' ||
                           item.ffmpeg_status === 'failed' ||
                           (actualNeedsSocial && item.social_post_status === 'failed');
          const retryCount = item.retry_count !== undefined ? Number(item.retry_count) : 0;
          return isFailed && retryCount < 3;
        });

        if (failedItem) {
          let failedStep = null;
          const updateFields = {
            retry_count: (failedItem.retry_count !== undefined ? Number(failedItem.retry_count) : 0) + 1
          };

          if (failedItem.generation_status === 'failed') {
            failedStep = 'generate';
            let isPendingSourcing = false;
            if (failedItem.row_creative_payload) {
              try {
                const payloadObj = JSON.parse(failedItem.row_creative_payload);
                if (payloadObj.source_product_url && (!payloadObj.product_name || payloadObj.product_name.trim() === '')) {
                  isPendingSourcing = true;
                }
              } catch (_) {}
            }
            updateFields.generation_status = isPendingSourcing ? 'pending_sourcing' : 'pending';
            updateFields.result_json = null;
            updateFields.tts_status = 'pending';
            updateFields.tts_batch_id = null;
            updateFields.visual_status = 'pending';
            updateFields.visual_tasks_json = '[]';
            updateFields.visual_clip_paths = null;
            updateFields.ffmpeg_status = 'pending';
            updateFields.ffmpeg_output_path = null;
            updateFields.upload_status = 'pending';
            updateFields.drive_link = null;
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          } else if (failedItem.tts_status === 'failed') {
            failedStep = 'tts';
            updateFields.tts_status = 'pending';
            updateFields.tts_batch_id = null;
            updateFields.visual_status = 'pending';
            updateFields.visual_clip_paths = null;
            updateFields.ffmpeg_status = 'pending';
            updateFields.ffmpeg_output_path = null;
            updateFields.upload_status = 'pending';
            updateFields.drive_link = null;
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          } else if (failedItem.visual_status === 'failed') {
            failedStep = 'visuals';
            updateFields.visual_status = 'pending';
            updateFields.visual_clip_paths = null;
            updateFields.ffmpeg_status = 'pending';
            updateFields.ffmpeg_output_path = null;
            updateFields.upload_status = 'pending';
            updateFields.drive_link = null;
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          } else if (failedItem.ffmpeg_status === 'failed') {
            failedStep = 'ffmpeg';
            updateFields.ffmpeg_status = 'pending';
            updateFields.ffmpeg_output_path = null;
            updateFields.upload_status = 'pending';
            updateFields.drive_link = null;
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          } else if (actualNeedsSocial && failedItem.social_post_status === 'failed') {
            failedStep = 'social';
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          }

          if (failedStep) {
            updatePillarCampaignItem(failedItem.id, updateFields);
            console.log(`🔄 [Campaign Scheduler] OPC Campaign "${campaign.campaign_name}": Memulai Auto-Retry #${updateFields.retry_count} untuk Item #${failedItem.id} pada langkah ${failedStep.toUpperCase()}.`);
            return;
          }
        }
      }
    });
   });
  }

  // --- INSTANT CAMPAIGN TICKING ENGINE (v9.0) ---
  const instantCampaigns = await db.prepare("SELECT * FROM instant_campaigns WHERE status = 'running' AND local_scheduler = 1").all();
  for (const campaign of instantCampaigns) {
    const tenantId = campaign.tenant_id || 'default_tenant';
    const instantLogFile = path.join(process.cwd(), 'public', `instant_factory_logs_${tenantId}.txt`);
    await tenantContext.run(tenantId, async () => {
      await logContextStorage.run(instantLogFile, async () => {
      const items = await listInstantCampaignItems(campaign.id);
      const pauseAt = campaign.scheduler_pause_at || null;
      
      // Cari item pertama yang belum selesai
      const currentItem = items.find(item => !isInstantItemFinished(item, campaign));
      
      if (currentItem) {
        const taskKey = `instant_${currentItem.id}`;
        // Jika item ini sedang diproses di thread lain, tunggu (jangan lanjut ke item berikutnya)
        if (state.activeTasks.has(taskKey)) {
          return;
        }
        
        // 0. Product Sourcing Stage
        if (currentItem.generation_status === 'pending_sourcing') {
          runStep(currentItem.id, 'instant_sourcing', processInstantRowProductSourcing, taskKey);
          return;
        }

        // 1. Generation Stage
        if (currentItem.generation_status === 'pending') {
          runStep(currentItem.id, 'instant_generator', processInstantGenerator, taskKey);
          return;
        }
        
        // 2. TTS Stage
        if (currentItem.generation_status === 'completed' && currentItem.tts_status === 'pending') {
          if (pauseAt === 'tts') {
            console.log(`⛔ [Campaign Scheduler] Paused before TTS for Instant item #${currentItem.id} — campaign "${campaign.product_name}". Menunggu approval manual.`);
            return;
          }
          runStep(currentItem.id, 'instant_tts', processInstantTts, taskKey);
          return;
        }
        
        // 3. Visuals Stage — Phase A: Submission
        if ((currentItem.tts_status === 'completed' || currentItem.tts_status === 'skipped') && currentItem.visual_status === 'pending') {
          if (pauseAt === 'visuals') {
            console.log(`⛔ [Campaign Scheduler] Paused before G-Labs for Instant item #${currentItem.id} — campaign "${campaign.product_name}". Review storyboard & prompt.`);
            return;
          }
          runStep(currentItem.id, 'instant_glabs', processInstantGlabs, taskKey);
          return;
        }
        // Visuals Stage — Phase B: Polling (non-blocking)
        if (currentItem.visual_status === 'processing') {
          runStep(currentItem.id, 'instant_glabs_poll', processInstantGlabs, taskKey);
        }
        
        // 4. FFmpeg Muxing Stage
        if ((currentItem.visual_status === 'completed' || currentItem.visual_status === 'skipped') && currentItem.ffmpeg_status === 'pending') {
          if (pauseAt === 'ffmpeg') {
            console.log(`⛔ [Campaign Scheduler] Paused before FFmpeg for Instant item #${currentItem.id} — campaign "${campaign.product_name}". Review visual clip.`);
            return;
          }
          runStep(currentItem.id, 'instant_ffmpeg', processInstantFfmpeg, taskKey);
          return;
        }
        
        // 5. Social Post Stage
        if ((currentItem.ffmpeg_status === 'completed' || currentItem.ffmpeg_status === 'skipped') && currentItem.social_post_status === 'pending') {
          if (pauseAt === 'social') {
            console.log(`⛔ [Campaign Scheduler] Paused before Social Post for Instant item #${currentItem.id} — campaign "${campaign.product_name}". Konfirmasi sebelum posting.`);
            return;
          }
          runStep(currentItem.id, 'instant_social_poster', processInstantSocialPoster, taskKey);
          return;
        }
      } else {
        // Jika semua item sudah selesai/gagal, lakukan deteksi auto-retry pass untuk IFC
        const needsSocial = campaign.post_youtube_draft || campaign.post_tiktok_draft || campaign.post_facebook_draft;
        const actualNeedsSocial = needsSocial && campaign.enable_social_post !== 0;

        const failedItem = items.find(item => {
          const isFailed = item.generation_status === 'failed' ||
                           item.tts_status === 'failed' ||
                           item.visual_status === 'failed' ||
                           item.ffmpeg_status === 'failed' ||
                           (actualNeedsSocial && item.social_post_status === 'failed');
          const retryCount = item.retry_count !== undefined ? Number(item.retry_count) : 0;
          return isFailed && retryCount < 3;
        });

        if (failedItem) {
          let failedStep = null;
          const updateFields = {
            retry_count: (failedItem.retry_count !== undefined ? Number(failedItem.retry_count) : 0) + 1
          };

          if (failedItem.generation_status === 'failed') {
            failedStep = 'generate';
            let isPendingSourcing = false;
            if (failedItem.row_creative_payload) {
              try {
                const payloadObj = JSON.parse(failedItem.row_creative_payload);
                if (payloadObj.product_image_url && (payloadObj.product_image_url.startsWith('http://') || payloadObj.product_image_url.startsWith('https://')) && !payloadObj.product_ref_image_path) {
                  isPendingSourcing = true;
                }
              } catch (_) {}
            }
            updateFields.generation_status = isPendingSourcing ? 'pending_sourcing' : 'pending';
            updateFields.result_json = null;
            updateFields.tts_status = 'pending';
            updateFields.tts_batch_id = null;
            updateFields.visual_status = 'pending';
            updateFields.visual_tasks_json = '[]';
            updateFields.visual_clip_paths = null;
            updateFields.ffmpeg_status = 'pending';
            updateFields.ffmpeg_output_path = null;
            updateFields.upload_status = 'pending';
            updateFields.drive_link = null;
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          } else if (failedItem.tts_status === 'failed') {
            failedStep = 'tts';
            updateFields.tts_status = 'pending';
            updateFields.tts_batch_id = null;
            updateFields.visual_status = 'pending';
            updateFields.visual_clip_paths = null;
            updateFields.ffmpeg_status = 'pending';
            updateFields.ffmpeg_output_path = null;
            updateFields.upload_status = 'pending';
            updateFields.drive_link = null;
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          } else if (failedItem.visual_status === 'failed') {
            failedStep = 'visuals';
            updateFields.visual_status = 'pending';
            updateFields.visual_clip_paths = null;
            updateFields.ffmpeg_status = 'pending';
            updateFields.ffmpeg_output_path = null;
            updateFields.upload_status = 'pending';
            updateFields.drive_link = null;
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          } else if (failedItem.ffmpeg_status === 'failed') {
            failedStep = 'ffmpeg';
            updateFields.ffmpeg_status = 'pending';
            updateFields.ffmpeg_output_path = null;
            updateFields.upload_status = 'pending';
            updateFields.drive_link = null;
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          } else if (actualNeedsSocial && failedItem.social_post_status === 'failed') {
            failedStep = 'social';
            updateFields.social_post_status = 'pending';
            updateFields.social_links_json = null;
          }

          if (failedStep) {
            updateInstantCampaignItem(failedItem.id, updateFields);
            console.log(`🔄 [Campaign Scheduler] IFC Campaign "${campaign.product_name}": Memulai Auto-Retry #${updateFields.retry_count} untuk Item #${failedItem.id} pada langkah ${failedStep.toUpperCase()}.`);
            return;
          }
        }
      }
    });
   });
  }

  // --- SHEETS AUTOPILOT SCHEDULER TICK (v10.5) ---
  const now = Date.now();
  if (!state.lastSheetsSyncTime) state.lastSheetsSyncTime = 0;
  if (state.isSheetsSyncRunning === undefined) state.isSheetsSyncRunning = false;

  const isSchedulerActive = await getSetting('sheets_autopilot_scheduler_active') === 'true';

  if (isSchedulerActive && now - state.lastSheetsSyncTime >= 15_000 && !state.isSheetsSyncRunning) {
    state.isSheetsSyncRunning = true;
    console.log('🤖 [Campaign Scheduler] Starting scheduled Sheets Autopilot sync worker...');
    runSyncWorker()
      .then(() => {
        state.lastSheetsSyncTime = Date.now();
        console.log('🤖 [Campaign Scheduler] Scheduled Sheets Autopilot sync finished.');
      })
      .catch(err => {
        console.error('🤖 [Campaign Scheduler] Sheets Autopilot sync failed:', err.message);
      })
      .finally(() => {
        state.isSheetsSyncRunning = false;
      });
  }

  // --- MULTIPLIER LAB SCHEDULER TICK ---
  if (!state.lastMultiplierSyncTime) state.lastMultiplierSyncTime = 0;
  if (state.isMultiplierSyncRunning === undefined) state.isMultiplierSyncRunning = false;

  const isMultiplierActive = await getSetting('multiplier_scheduler_active') === 'true';

  if (now - state.lastMultiplierSyncTime >= 10_000 && !state.isMultiplierSyncRunning && isMultiplierActive) {
    state.isMultiplierSyncRunning = true;
    const { processNextMultiplierTask, logToMultiplier } = await import('./re-multiplier-worker.js');
    
    logToMultiplier('=== MESIN MULTIPLIER SINKRONISASI MULAI ===');
    processNextMultiplierTask()
      .then(() => {
        state.lastMultiplierSyncTime = Date.now();
        logToMultiplier('=== MESIN MULTIPLIER SINKRONISASI SELESAI ===');
      })
      .catch(err => {
        logToMultiplier(`[Scheduler Error] Multiplier task failed: ${err.message}`);
      })
      .finally(() => {
        state.isMultiplierSyncRunning = false;
      });
  }

  // --- RECIPE LABS SCHEDULER TICK (v9.7.6) ---
  const recipeSchedulerActive = await getSetting('recipe_scheduler_active') === 'true';
  if (recipeSchedulerActive) {
    const recipeCampaigns = await db.prepare("SELECT * FROM recipe_campaigns WHERE status = 'processing'").all();
    
    if (recipeCampaigns.length > 0) {
      for (const campaign of recipeCampaigns) {
        const tenantId = campaign.tenant_id || 'default_tenant';
        const recipeLogFile = path.join(process.cwd(), 'public', `recipe_logs_${tenantId}.txt`);
        await tenantContext.run(tenantId, async () => {
          await logContextStorage.run(recipeLogFile, async () => {
          const items = await db.prepare("SELECT * FROM recipe_items WHERE campaign_id = ?").all(campaign.id);
          
          // Find first item that is not completed or failed
          const currentItem = items.find(item => item.status !== 'completed' && item.status !== 'failed');
          
          if (currentItem) {
            const taskKey = `recipe_${currentItem.id}`;
            if (state.activeTasks.has(taskKey)) {
              return;
            }
            
            // 1. Text Generation Stage
            if (currentItem.status === 'pending_gemini') {
              runStep(currentItem.id, 'recipe_generator', processRecipeGenerator, taskKey);
              return;
            }
            
            // 2. G-Labs Stage (Static only, Video skips to pending_export)
            if (currentItem.status === 'pending_glabs') {
              runStep(currentItem.id, 'recipe_glabs', processRecipeGLabs, taskKey);
              return;
            }
            
            // 3. Export Stage
            if (currentItem.status === 'pending_export') {
              runStep(currentItem.id, 'recipe_exporter', processRecipeExporter, taskKey);
              return;
            }
          }
        });
       });
      }
    }
  }

  // --- PRODUCT BULK ENRICHMENT TICK (v10.14.0) ---
  if (!state.lastProductBulkTime) state.lastProductBulkTime = 0;
  if (state.isProductBulkRunning === undefined) state.isProductBulkRunning = false;

  if (now - state.lastProductBulkTime >= 15_000 && !state.isProductBulkRunning) {
    state.isProductBulkRunning = true;
    try {
      const { processProductBulkEnrichment } = await import('./product-bulk-worker.js');
      await processProductBulkEnrichment();
      state.lastProductBulkTime = Date.now();
    } catch (err) {
      console.error('[Scheduler Error] Product bulk worker failed:', err.message);
    } finally {
      state.isProductBulkRunning = false;
    }
  }

  // --- PRODUCT BRIDGING BULK CAMPAIGN TICK ---
  if (bridgeSchedulerActive) {
    try {
      await tickBridgeBulkCampaigns(db);
    } catch (bulkErr) {
      console.error('[Bridge Bulk Scheduler Engine Error]:', bulkErr.message);
    }
  }
  });
}

async function runStep(itemId, name, processor, taskKey = itemId) {
  state.activeTasks.add(taskKey);

  const db = getDb();
  let tenantId = 'default_tenant';
  try {
    if (name.startsWith('re_')) {
      const item = await db.prepare("SELECT campaign_id FROM re_campaign_items WHERE id = ?").get(itemId);
      if (item) {
        const campaign = await db.prepare("SELECT tenant_id FROM re_campaigns WHERE id = ?").get(item.campaign_id);
        if (campaign) tenantId = campaign.tenant_id || 'default_tenant';
      }
    } else if (name.startsWith('deconstruct_')) {
      const asset = await db.prepare("SELECT tenant_id FROM re_deconstructed_assets WHERE id = ?").get(itemId);
      if (asset) tenantId = asset.tenant_id || 'default_tenant';
    } else if (name.startsWith('pillar_')) {
      const item = await db.prepare("SELECT campaign_id FROM pillar_campaign_items WHERE id = ?").get(itemId);
      if (item) {
        const campaign = await db.prepare("SELECT tenant_id FROM pillar_campaigns WHERE id = ?").get(item.campaign_id);
        if (campaign) tenantId = campaign.tenant_id || 'default_tenant';
      }
    } else if (name.startsWith('instant_')) {
      const item = await db.prepare("SELECT campaign_id FROM instant_campaign_items WHERE id = ?").get(itemId);
      if (item) {
        const campaign = await db.prepare("SELECT tenant_id FROM instant_campaigns WHERE id = ?").get(item.campaign_id);
        if (campaign) tenantId = campaign.tenant_id || 'default_tenant';
      }
    } else if (name.startsWith('recipe_')) {
      const item = await db.prepare("SELECT campaign_id FROM recipe_items WHERE id = ?").get(itemId);
      if (item) {
        const campaign = await db.prepare("SELECT tenant_id FROM recipe_campaigns WHERE id = ?").get(item.campaign_id);
        if (campaign) tenantId = campaign.tenant_id || 'default_tenant';
      }
    } else if (name.startsWith('bridge_')) {
      const item = await db.prepare("SELECT campaign_id FROM bridge_injector_items WHERE id = ?").get(itemId);
      if (item) {
        const campaign = await db.prepare("SELECT tenant_id FROM bridge_injector_campaigns WHERE id = ?").get(item.campaign_id);
        if (campaign) tenantId = campaign.tenant_id || 'default_tenant';
      }
    } else if (name.startsWith('strategic_')) {
      const campaign = await db.prepare("SELECT tenant_id FROM strategic_campaigns WHERE id = ?").get(itemId);
      if (campaign) tenantId = campaign.tenant_id || 'default_tenant';
    }
  } catch (err) {
    console.error(`[Campaign Scheduler] Error fetching tenantId for runStep:`, err.message);
  }

  let logFile = null;
  if (name.startsWith('re_')) {
    logFile = path.join(process.cwd(), 'public', `re_campaign_logs_${tenantId}.txt`);
  } else if (name.startsWith('deconstruct_')) {
    logFile = path.join(process.cwd(), 'public', `deconstruct_logs_${tenantId}.txt`);
  } else if (name.startsWith('pillar_')) {
    logFile = path.join(process.cwd(), 'public', `opc_logs_${tenantId}.txt`);
  } else if (name.startsWith('instant_')) {
    logFile = path.join(process.cwd(), 'public', `instant_factory_logs_${tenantId}.txt`);
  } else if (name.startsWith('recipe_')) {
    logFile = path.join(process.cwd(), 'public', `recipe_logs_${tenantId}.txt`);
  } else if (name.startsWith('bridge_')) {
    logFile = path.join(process.cwd(), 'public', `bridge_injector_logs_${tenantId}.txt`);
  } else if (name.startsWith('strategic_')) {
    logFile = path.join(process.cwd(), 'public', `strategic_campaign_logs_${tenantId}.txt`);
  }

  const execute = async () => {
    const { tenantContext } = await import('./tenant-context.js');
    await tenantContext.run(tenantId, async () => {
      let progressLabel = `item #${itemId}`;
      let prefixLabel = '[Campaign Scheduler]';
      if (name.startsWith('deconstruct_')) {
        prefixLabel = '[Deconstruct Scheduler]';
        try {
          const asset = await db.prepare("SELECT batch_id FROM re_deconstructed_assets WHERE id = ?").get(itemId);
          if (asset) {
            const allBatchAssets = await db.prepare("SELECT id FROM re_deconstructed_assets WHERE batch_id = ? ORDER BY created_at ASC, id ASC").all(asset.batch_id);
            const idx = allBatchAssets.findIndex(a => a.id === itemId);
            if (idx !== -1) {
              progressLabel = `[Video ${idx + 1}/${allBatchAssets.length}]`;
            }
          }
        } catch (_) {}
      }

      console.log(`🚀 ${prefixLabel} Starting step [${name}] for ${progressLabel}...`);
      try {
        const payload = { item_id: itemId };
        const mockJob = { id: -1 };
        const stageMap = { pillar_tts: 'tts', pillar_glabs: 'video', pillar_ffmpeg: 'ffmpeg_upload' };
        let result;
        if (stageMap[name]) {
          const item = await db.prepare('SELECT start_frame_revision FROM pillar_campaign_items WHERE id=?').get(itemId);
          const { executeIdempotentStage } = await import('./pillar-stage-execution-service.js');
          result = await executeIdempotentStage({ itemId, stage: stageMap[name], revision: Number(item?.start_frame_revision || 1) }, async () => {
            const output = await processor(payload, mockJob);
            return { success: true, output: output ?? null };
          });
        } else {
          result = await processor(payload, mockJob);
        }

        let outputLabel = '';
        if (name.startsWith('deconstruct_')) {
          outputLabel = 'Processed';
        } else {
          outputLabel = typeof result === 'object' ? JSON.stringify(result) : String(result);
        }

        console.log(`✅ ${prefixLabel} Finished step [${name}] for ${progressLabel}: ${outputLabel}`);
      } catch (e) {
        console.error(`❌ ${prefixLabel} Error in step [${name}] for ${progressLabel}:`, e.message);
      } finally {
        state.activeTasks.delete(taskKey);
      }
    });
  };

  if (logFile) {
    logContextStorage.run(logFile, execute);
  } else {
    await execute();
  }
}

// Bulk Product Bridging Processors & Helpers
const fileToBase64 = (filePath) => {
  if (!filePath) return null;
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return null;
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    let absolutePath = filePath;
    if (!path.isAbsolute(filePath) || !fs.existsSync(filePath)) {
      const relativePart = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      absolutePath = path.join(process.cwd(), 'public', relativePart);
    }
    
    if (!fs.existsSync(absolutePath)) {
      console.warn(`[fileToBase64] File not found: ${filePath} (resolved: ${absolutePath})`);
      return null;
    }
    
    const buffer = fs.readFileSync(absolutePath);
    let mimeType = 'image/png';
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      mimeType = 'image/jpeg';
    } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      mimeType = 'image/png';
    } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      mimeType = 'image/webp';
    }
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.error('[fileToBase64 Error]:', err.message);
    return null;
  }
};


async function wrapProcessor(itemId, db, processorFn) {
  try {
    await processorFn();
  } catch (err) {
    console.error(`❌ [Bridge Bulk Process Error on item #${itemId}]:`, err.message);
    await db.prepare("UPDATE bridge_injector_items SET workflow_status = 'failed', error_message = ? WHERE id = ?").run(err.message, itemId);
  }
}

async function processBridgeBulkDownload(itemId, db) {
  const item = await db.prepare("SELECT * FROM bridge_injector_items WHERE id = ?").get(itemId);
  if (!item) return;

  let downloadUrl = item.original_script_url.trim();
  
  let isNextcloudFolder = false;
  if ((downloadUrl.includes('/s/') || downloadUrl.includes('/index.php/s/')) && !downloadUrl.endsWith('/download')) {
    isNextcloudFolder = true;
  }

  // Auto-resolve Nextcloud share link to direct download if not scanning folder
  if (!isNextcloudFolder) {
    if (downloadUrl.includes('/index.php/s/') && !downloadUrl.endsWith('/download')) {
      downloadUrl = downloadUrl.replace(/\/+$/, '') + '/download';
    } else if (downloadUrl.includes('/s/') && !downloadUrl.includes('/index.php/s/') && !downloadUrl.endsWith('/download')) {
      downloadUrl = downloadUrl.replace(/\/+$/, '') + '/download';
    }
  }

  let originalScriptContent = '';
  let localClip1 = null;
  let localClip2 = null;
  let localClip3 = null;
  let localAudioClip1 = null;

  if (isNextcloudFolder) {
    console.log(`[Bridge Bulk Scheduler] Scanning Nextcloud Shared Folder: ${downloadUrl}`);
    const { createClient } = await import('webdav');
    const fs = await import('fs');
    const path = await import('path');

    const urlObj = new URL(downloadUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    const tokenMatch = downloadUrl.match(/\/s\/([a-zA-Z0-9_-]+)/);
    if (!tokenMatch) {
      throw new Error(`Format URL Nextcloud share tidak valid: ${downloadUrl}`);
    }
    const token = tokenMatch[1];
    const webdavUrl = `${baseUrl.replace(/\/+$/, '')}/public.php/webdav`;

    const client = createClient(webdavUrl, {
      username: token,
      password: ''
    });

    const files = await client.getDirectoryContents('/');
    console.log(`[Bridge Bulk Scheduler] Found ${files.length} items in Nextcloud shared folder.`);

    const mdFile = files.find(f => f.filename.toLowerCase().endsWith('.md'));
    if (!mdFile) {
      throw new Error(`Tidak ditemukan file naskah .md di folder Nextcloud share: ${downloadUrl}`);
    }
    console.log(`[Bridge Bulk Scheduler] Downloading script: ${mdFile.basename}`);
    const mdBuffer = await client.getFileContents(mdFile.filename);
    originalScriptContent = mdBuffer.toString('utf8');

    const campaignId = item.campaign_id;
    const itemDir = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', `bulk_${campaignId}_${itemId}`);
    fs.mkdirSync(itemDir, { recursive: true });

    const downloadNextcloudFile = async (matcherFn, destName) => {
      const fileObj = files.find(matcherFn);
      if (!fileObj) {
        console.log(`[Bridge Bulk Scheduler] [WARNING] File matching ${destName} not found in Nextcloud folder.`);
        return null;
      }
      console.log(`[Bridge Bulk Scheduler] Downloading ${fileObj.basename} -> ${destName}`);
      const fileBuffer = await client.getFileContents(fileObj.filename);
      const destPath = path.join(itemDir, destName);
      fs.writeFileSync(destPath, fileBuffer);
      return `/uploads/bridge-injector/bulk_${campaignId}_${itemId}/${destName}`;
    };

    const isVideoFile = (filename) => {
      const ext = filename.split('.').pop().toLowerCase();
      return ['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(ext);
    };

    const isAudioFile = (filename) => {
      const ext = filename.split('.').pop().toLowerCase();
      return ['mp3', 'wav', 'aac', 'm4a', 'ogg'].includes(ext);
    };

    const matcherClip1 = f => isVideoFile(f.filename) && (f.basename.toLowerCase().includes('clip_1') || f.basename.toLowerCase().includes('clip1') || f.basename.toLowerCase().endsWith('1.mp4'));
    const matchedClip1File = files.find(matcherClip1);
    if (matchedClip1File) {
      const originalBase = matchedClip1File.basename.substring(0, matchedClip1File.basename.lastIndexOf('.')) || matchedClip1File.basename;
      await db.prepare("UPDATE bridge_injector_items SET original_clip1_filename = ? WHERE id = ?").run(originalBase, itemId);
    }

    localClip1 = await downloadNextcloudFile(matcherClip1, 'video_clip_1.mp4');
    localClip2 = await downloadNextcloudFile(f => isVideoFile(f.filename) && (f.basename.toLowerCase().includes('clip_2') || f.basename.toLowerCase().includes('clip2') || f.basename.toLowerCase().endsWith('2.mp4')), 'video_clip_2.mp4');
    localClip3 = await downloadNextcloudFile(f => isVideoFile(f.filename) && (f.basename.toLowerCase().includes('clip_3') || f.basename.toLowerCase().includes('clip3') || f.basename.toLowerCase().endsWith('3.mp4')), 'video_clip_3.mp4');

    localAudioClip1 = await downloadNextcloudFile(f => isAudioFile(f.filename) && (f.basename.toLowerCase().includes('audio_clip_1') || f.basename.toLowerCase().includes('audio_clip1') || f.basename.toLowerCase().includes('clip_1')), 'audio_clip_1_lama.mp3');
  } else {
    console.log(`[Bridge Bulk Scheduler] Downloading script from direct URL: ${downloadUrl}`);
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`Gagal download naskah.md: HTTP ${res.status}`);
    originalScriptContent = await res.text();
  }

  console.log(`[Bridge Bulk Scheduler] Resolving product from URL: ${item.product_url}`);
  const sanitizedUrl = item.product_url.trim().toLowerCase().replace(/\/$/, "");
  
  const matchedProduct = await db.prepare(`
    SELECT id FROM product_extractions 
    WHERE LOWER(REPLACE(source_url, '/', '')) = ? 
       OR LOWER(REPLACE(input_source, '/', '')) = ?
    LIMIT 1
  `).get(sanitizedUrl.replace(/\//g, ''), sanitizedUrl.replace(/\//g, ''));

  if (!matchedProduct) {
    throw new Error(`Produk dengan URL "${item.product_url}" tidak ditemukan di database.`);
  }

  await db.prepare(`
    UPDATE bridge_injector_items 
    SET original_script_content = ?, 
        target_product_id = ?, 
        local_clip1_path = ?,
        local_clip2_path = ?,
        local_clip3_path = ?,
        local_audio_clip1_path = ?,
        download_status = 'completed' 
    WHERE id = ?
  `).run(originalScriptContent, matchedProduct.id, localClip1, localClip2, localClip3, localAudioClip1, itemId);

  console.log(`[Bridge Bulk Scheduler] Download and product resolution complete for item #${itemId}.`);
}

async function processBridgeBulkGemini(itemId, db) {
  const item = await db.prepare("SELECT * FROM bridge_injector_items WHERE id = ?").get(itemId);
  if (!item || !item.target_product_id) return;

  const campaign = await db.prepare("SELECT * FROM bridge_injector_campaigns WHERE id = ?").get(item.campaign_id);
  if (!campaign) return;

  console.log(`[Bridge Bulk Scheduler] Running Gemini script injection for item #${itemId}...`);
  
  const productData = await db.prepare("SELECT * FROM product_extractions WHERE id = ?").get(item.target_product_id);
  if (!productData) {
    throw new Error("Product data not found in DB even after resolution");
  }



  const resolvedInstruction = item.custom_instruction || campaign.custom_instruction || '';
  const prompt = buildProductBridgingInjectorPrompt(item.original_script_content, productData, resolvedInstruction);
  const model = await getGeminiModel();
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const parsed = parseGeminiJSON(responseText);

  const {
    injected_vo_1,
    injected_vo_2,
    injected_vo_3,
    injected_vo_4,
    clip2_t2i_prompt,
    clip2_i2v_prompt
  } = parsed;

  if (!injected_vo_1 || !injected_vo_2 || !injected_vo_3 || !injected_vo_4 || !clip2_t2i_prompt || !clip2_i2v_prompt) {
    throw new Error('Hasil Gemini AI tidak lengkap.');
  }

  let safeVo1 = injected_vo_1;
  let safeVo2 = injected_vo_2;
  let safeVo3 = injected_vo_3;
  let safeVo4 = injected_vo_4;
  let complianceStatus = 'skipped';
  let complianceScore = 0;
  let complianceLog = null;

  if (campaign.enable_vo_audit === 1 || campaign.enable_vo_audit !== 0) {
    try {
      console.log(`[Bridge Bulk Scheduler] Running TikTok safe VO audit for item #${itemId}...`);
      const fullOriginalVo = [injected_vo_1, injected_vo_2, injected_vo_3, injected_vo_4].filter(Boolean).join('\n');
      const { auditScriptForTikTok } = await import('./tiktok-compliance-service.js');
      const auditResult = await auditScriptForTikTok(fullOriginalVo, '');
      if (auditResult.revised_script && Array.isArray(auditResult.revised_script)) {
        if (auditResult.revised_script[0]) safeVo1 = auditResult.revised_script[0];
        if (auditResult.revised_script[1]) safeVo2 = auditResult.revised_script[1];
        if (auditResult.revised_script[2]) safeVo3 = auditResult.revised_script[2];
        if (auditResult.revised_script[3]) safeVo4 = auditResult.revised_script[3];
      }
      complianceStatus = auditResult.verdict || 'pass';
      complianceScore = auditResult.risk_score || 0;
      complianceLog = auditResult;
    } catch (err) {
      console.error('[Bridge Bulk Scheduler] Compliance audit error:', err.message);
    }
  }

  const originalVoArray = [{ narration: injected_vo_1 }, { narration: injected_vo_2 }, { narration: injected_vo_3 }, { narration: injected_vo_4 }];
  const safeVoArray = [{ narration: safeVo1 }, { narration: safeVo2 }, { narration: safeVo3 }, { narration: safeVo4 }];

  const fs = require('fs');
  const path = require('path');
  const outputDir = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', `bulk_${campaign.id}_${itemId}`);
  fs.mkdirSync(outputDir, { recursive: true });
  
  const mdContent = `# ${campaign.campaign_name} - Item ${itemId} Naskah Bridging Product
  
## Klip 1: Hook (Original)
${safeVo1}

## Klip 2: Product (New Injected)
${safeVo2}

## Klip 3: Continuation
${safeVo3}

## Klip 4: CTA
${safeVo4}
`;

  const mdFilePath = path.join(outputDir, 'naskah_bridging.md');
  fs.writeFileSync(mdFilePath, mdContent);
  const relativeMdPath = `/uploads/bridge-injector/bulk_${campaign.id}_${itemId}/naskah_bridging.md`;

  await db.prepare(`
    UPDATE bridge_injector_items 
    SET injected_vo_1 = ?, injected_vo_2 = ?, injected_vo_3 = ?, injected_vo_4 = ?,
        clip2_t2i_prompt = ?, clip2_i2v_prompt = ?, injected_script_md_path = ?,
        original_voiceover = ?, tiktok_safe_voiceover = ?, compliance_status = ?,
        compliance_score = ?, compliance_log_json = ?, selected_vo_version = 'original',
        gemini_status = 'completed'
    WHERE id = ?
  `).run(
    safeVo1, safeVo2, safeVo3, safeVo4,
    clip2_t2i_prompt, clip2_i2v_prompt, relativeMdPath,
    JSON.stringify(originalVoArray), JSON.stringify(safeVoArray), complianceStatus,
    complianceScore, complianceLog ? JSON.stringify(complianceLog) : null,
    itemId
  );

  console.log(`[Bridge Bulk Scheduler] Gemini script generation successful for item #${itemId}.`);
}

async function processBridgeBulkT2i(itemId, db) {
  const item = await db.prepare("SELECT * FROM bridge_injector_items WHERE id = ?").get(itemId);
  if (!item || !item.clip2_t2i_prompt) return;

  console.log(`[Bridge Bulk Scheduler] Submitting T2I task to G-Labs for item #${itemId}...`);
  
  const { generateImage } = await import('./webhook-client.js');
  const { getSetting } = await import('./db.js');

  let productBase64 = null;
  if (item.target_product_id) {
    const product = await db.prepare('SELECT photo_url, active_photo, clean_photo_url, cleaned_photo_url, generated_photo_url FROM product_extractions WHERE id = ?').get(item.target_product_id);
    if (product) {
      const activePhotoField = product.active_photo || 'photo_url';
      const photoPath = product[activePhotoField] || product.photo_url || product.generated_photo_url;
      if (photoPath) {
        productBase64 = fileToBase64(photoPath);
      }
    }
  }

  const imageModel = await getSetting('webhook_image_model') || 'nano_banana_pro';
  const res = await generateImage({
    prompt: item.clip2_t2i_prompt,
    model: imageModel,
    aspect_ratio: '9:16',
    reference_images: productBase64 ? [productBase64] : undefined
  });

  if (res && res.task_id) {
    await db.prepare("UPDATE bridge_injector_items SET clip2_t2i_task_id = ?, t2i_status = 'processing' WHERE id = ?").run(res.task_id, itemId);
    console.log(`[Bridge Bulk Scheduler] G-Labs T2I task registered. Task ID: ${res.task_id}`);
  } else {
    throw new Error('G-Labs did not return a task_id');
  }
}

async function processBridgeBulkT2iPoll(itemId, db) {
  const item = await db.prepare("SELECT * FROM bridge_injector_items WHERE id = ?").get(itemId);
  if (!item || !item.clip2_t2i_task_id) return;

  console.log(`[Bridge Bulk Scheduler] Polling G-Labs T2I task ${item.clip2_t2i_task_id} for item #${itemId}...`);
  const { getTaskStatus, getFileUrl } = await import('./webhook-client.js');

  const statusRes = await getTaskStatus(item.clip2_t2i_task_id);
  const status = (statusRes?.status || '').toLowerCase();

  if (status === 'completed') {
    const files = statusRes.results || statusRes.files || [];
    let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp')) || files[0];

    if (imageFile) {
      if (imageFile.startsWith('http://') || imageFile.startsWith('https://')) {
        imageFile = imageFile.split('/').pop();
      }
      const downloadUrl = getFileUrl(imageFile);
      const ext = imageFile.split('.').pop() || 'png';
      
      const safeFilename = `clip2_start_frame.${ext}`;
      const localRelPath = `/uploads/bridge-injector/bulk_${item.campaign_id}_${itemId}/${safeFilename}`;
      
      const path = require('path');
      const localAbsPath = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', `bulk_${item.campaign_id}_${itemId}`, safeFilename);

      console.log(`[Bridge Bulk Scheduler] T2I finished. Downloading image: ${downloadUrl}`);
      
      const fs = require('fs');
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.mkdirSync(path.dirname(localAbsPath), { recursive: true });
      fs.writeFileSync(localAbsPath, buffer);

      await db.prepare(`
        UPDATE bridge_injector_items 
        SET clip2_t2i_image_path = ?, t2i_status = 'completed', workflow_status = 'ready_for_review'
        WHERE id = ?
      `).run(localRelPath, itemId);

      console.log(`[Bridge Bulk Scheduler] Start frame saved to: ${localRelPath}. Item #${itemId} is ready for review.`);
    }
  } else if (status === 'failed') {
    throw new Error('G-Labs reported T2I task failed.');
  }
}

async function processBridgeBulkI2v(itemId, db) {
  const item = await db.prepare("SELECT * FROM bridge_injector_items WHERE id = ?").get(itemId);
  if (!item || !item.clip2_t2i_image_path) return;

  console.log(`[Bridge Bulk Scheduler] Submitting I2V task to G-Labs for item #${itemId}...`);
  const { generateVideo } = await import('./webhook-client.js');

  const fs = require('fs');
  const path = require('path');
  const imageAbsPath = path.join(process.cwd(), 'public', item.clip2_t2i_image_path);
  if (!fs.existsSync(imageAbsPath)) {
    throw new Error(`Start frame image not found locally at: ${imageAbsPath}`);
  }
  const buffer = fs.readFileSync(imageAbsPath);
  let mimeType = 'image/png';
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    mimeType = 'image/jpeg';
  }
  const startFrameBase64 = `data:${mimeType};base64,${buffer.toString('base64')}`;

  const res = await generateVideo({
    prompt: item.clip2_i2v_prompt,
    model: 'veo_31_lite',
    aspect_ratio: '9:16',
    mode: 'start_image',
    reference_images: [startFrameBase64]
  });

  if (res && res.task_id) {
    await db.prepare(`
      UPDATE bridge_injector_items 
      SET clip2_i2v_task_id = ?, i2v_status = 'processing', workflow_status = 'generating_video' 
      WHERE id = ?
    `).run(res.task_id, itemId);
    console.log(`[Bridge Bulk Scheduler] G-Labs I2V task registered. Task ID: ${res.task_id}`);
  } else {
    throw new Error('G-Labs did not return task_id for I2V');
  }
}

async function processBridgeBulkI2vPoll(itemId, db) {
  const item = await db.prepare("SELECT * FROM bridge_injector_items WHERE id = ?").get(itemId);
  if (!item || !item.clip2_i2v_task_id) return;

  console.log(`[Bridge Bulk Scheduler] Polling G-Labs I2V task ${item.clip2_i2v_task_id} for item #${itemId}...`);
  const { getTaskStatus, getFileUrl } = await import('./webhook-client.js');

  const statusRes = await getTaskStatus(item.clip2_i2v_task_id);
  const status = (statusRes?.status || '').toLowerCase();

  if (status === 'completed') {
    const files = statusRes.results || statusRes.files || [];
    let videoFile = files.find(f => f.endsWith('.mp4') || f.endsWith('.mkv')) || files[0];

    if (videoFile) {
      if (videoFile.startsWith('http://') || videoFile.startsWith('https://')) {
        videoFile = videoFile.split('/').pop();
      }
      const downloadUrl = getFileUrl(videoFile);
      
      const safeFilename = 'clip2_video.mp4';
      const localRelPath = `/uploads/bridge-injector/bulk_${item.campaign_id}_${itemId}/${safeFilename}`;
      
      const path = require('path');
      const localAbsPath = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', `bulk_${item.campaign_id}_${itemId}`, safeFilename);

      console.log(`[Bridge Bulk Scheduler] I2V finished. Downloading video: ${downloadUrl}`);
      
      const fs = require('fs');
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.mkdirSync(path.dirname(localAbsPath), { recursive: true });
      fs.writeFileSync(localAbsPath, buffer);

      let nextStatus = 'uploading';
      if (Number(item.enable_tts) === 1) {
        nextStatus = 'rendering_tts';
      } else if (Number(item.enable_ffmpeg) === 1) {
        nextStatus = 'muxing_ffmpeg';
      }

      await db.prepare(`
        UPDATE bridge_injector_items 
        SET clip2_video_path = ?, i2v_status = 'completed', workflow_status = ? 
        WHERE id = ?
      `).run(localRelPath, nextStatus, itemId);

      console.log(`[Bridge Bulk Scheduler] Video saved to: ${localRelPath}`);
    }
  } else if (status === 'failed') {
    throw new Error('G-Labs reported I2V task failed.');
  }
}

async function processBridgeBulkTts(itemId, db) {
  const item = await db.prepare("SELECT * FROM bridge_injector_items WHERE id = ?").get(itemId);
  if (!item) return;

  const campaign = await db.prepare("SELECT * FROM bridge_injector_campaigns WHERE id = ?").get(item.campaign_id);
  if (!campaign) return;

  if (item.enable_tts === 0) {
    await db.prepare("UPDATE bridge_injector_items SET tts_status = 'skipped' WHERE id = ?").run(itemId);
    console.log(`[Bridge Bulk TTS] TTS is disabled for item ${item.id}. Skipping.`);
    return;
  }

  await db.prepare("UPDATE bridge_injector_items SET tts_status = 'processing' WHERE id = ?").run(itemId);

  try {
    const fs = await import('fs');
    const path = await import('path');
    const { generateMinimaxVO } = await import('./minimax-tts.js');
    const { generateGeminiExact8sAudio } = await import('./gemini-8s-tts.js');

    const provider = item.voice_provider || 'gemini';
    const persona = item.voice_persona || 'Kore';
    const speed = item.voice_speed !== undefined ? Number(item.voice_speed) : 1.0;
    const volume = item.voice_volume !== undefined ? Number(item.voice_volume) : 1.0;

    const campaignId = item.campaign_id;
    const itemDir = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', `bulk_${campaignId}_${itemId}`);
    fs.mkdirSync(itemDir, { recursive: true });

    const clipsToGenerate = [
      { index: 2, text: item.injected_vo_2 },
      { index: 3, text: item.injected_vo_3 },
      { index: 4, text: item.injected_vo_4 }
    ];

    for (const clip of clipsToGenerate) {
      if (!clip.text) {
        console.log(`[Bridge Bulk TTS] Clip ${clip.index} has no voiceover text. Skipping.`);
        continue;
      }

      const ext = provider === 'minimax' ? 'mp3' : 'wav';
      const outputFileName = `audio_clip_${clip.index}_baru.${ext}`;
      const localPath = path.join(itemDir, outputFileName);

      console.log(`[Bridge Bulk TTS] Generating TTS for Clip ${clip.index} using ${provider} (${persona})...`);

      if (provider === 'minimax') {
        await generateMinimaxVO(clip.text, persona, localPath, {
          speed,
          volume,
          model: campaign.tts_model_quality || 'speech-2.8-turbo',
          language: campaign.target_language || 'id-ID'
        });
      } else {
        await generateGeminiExact8sAudio(clip.text, persona, localPath);
      }

      if (provider !== 'minimax') {
        console.log(`[Bridge Bulk TTS] Pacing delay: waiting 8s...`);
        await new Promise(resolve => setTimeout(resolve, 8000));
      }
    }

    let nextStatus = 'uploading';
    if (Number(item.enable_ffmpeg) === 1) {
      nextStatus = 'muxing_ffmpeg';
    }

    await db.prepare(`
      UPDATE bridge_injector_items 
      SET tts_status = 'completed', workflow_status = ? 
      WHERE id = ?
    `).run(nextStatus, itemId);

    console.log(`[Bridge Bulk TTS] Completed TTS generation for item #${itemId}.`);
  } catch (err) {
    console.error(`[Bridge Bulk TTS] Error:`, err.message);
    await db.prepare("UPDATE bridge_injector_items SET tts_status = 'failed', error_message = ? WHERE id = ?").run(err.message, itemId);
    throw err;
  }
}

async function processBridgeBulkFfmpeg(itemId, db) {
  const item = await db.prepare("SELECT * FROM bridge_injector_items WHERE id = ?").get(itemId);
  if (!item) return;

  if (item.enable_ffmpeg === 0) {
    await db.prepare("UPDATE bridge_injector_items SET ffmpeg_status = 'skipped' WHERE id = ?").run(itemId);
    console.log(`[Bridge Bulk FFmpeg] FFmpeg is disabled for item ${item.id}. Skipping.`);
    return;
  }

  await db.prepare("UPDATE bridge_injector_items SET ffmpeg_status = 'processing' WHERE id = ?").run(itemId);

  try {
    const fs = await import('fs');
    const path = await import('path');
    const { execSync } = await import('child_process');
    const { processVideoMuxing } = await import('./video-studio-processor.js');

    const campaignId = item.campaign_id;
    const itemDir = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', `bulk_${campaignId}_${itemId}`);
    fs.mkdirSync(itemDir, { recursive: true });

    const resolveLocal = (relPath) => relPath ? path.join(process.cwd(), 'public', relPath) : null;

    const bridgeAtClip = Number(item.bridge_at_clip || 2);
    let clip1Video, clip2Video, clip3Video, clip4Video;

    if (bridgeAtClip === 3) {
      clip1Video = resolveLocal(item.local_clip1_path);
      clip2Video = resolveLocal(item.local_clip2_path);
      clip3Video = resolveLocal(item.clip2_video_path);
      clip4Video = resolveLocal(item.local_clip3_path);
    } else if (bridgeAtClip === 4) {
      clip1Video = resolveLocal(item.local_clip1_path);
      clip2Video = resolveLocal(item.local_clip2_path);
      clip3Video = resolveLocal(item.local_clip3_path);
      clip4Video = resolveLocal(item.clip2_video_path);
    } else { // bridgeAtClip === 2
      clip1Video = resolveLocal(item.local_clip1_path);
      clip2Video = resolveLocal(item.clip2_video_path);
      clip3Video = resolveLocal(item.local_clip2_path);
      clip4Video = resolveLocal(item.local_clip3_path);
    }

    const clip1Audio = resolveLocal(item.local_audio_clip1_path);
    const provider = item.voice_provider || 'gemini';
    const ext = provider === 'minimax' ? 'mp3' : 'wav';
    const clip2Audio = path.join(itemDir, `audio_clip_2_baru.${ext}`);
    const clip3Audio = path.join(itemDir, `audio_clip_3_baru.${ext}`);
    const clip4Audio = path.join(itemDir, `audio_clip_4_baru.${ext}`);

    const hasAudioTrack = (filePath) => {
      try {
        const stdout = execSync(`ffprobe -v error -select_streams a -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${filePath}"`).toString().trim();
        return stdout.length > 0;
      } catch (e) {
        return false;
      }
    };

    const tempClip1 = path.join(itemDir, 'temp_clip1.mp4');
    const tempClip2 = path.join(itemDir, 'temp_clip2.mp4');
    const tempClip3 = path.join(itemDir, 'temp_clip3.mp4');
    const tempClip4 = path.join(itemDir, 'temp_clip4.mp4');

    const sfxVol = item.ffmpeg_sfx_volume !== undefined ? Number(item.ffmpeg_sfx_volume) : 0.0;
    const bgmVol = item.ffmpeg_bgm_volume !== undefined ? Number(item.ffmpeg_bgm_volume) : 0.0;
    const vScale = item.ffmpeg_video_scale !== undefined ? Number(item.ffmpeg_video_scale) : 1.0;

    // 1. Process Clip 1
    if (clip1Video && fs.existsSync(clip1Video)) {
      console.log(`[Bridge Bulk FFmpeg] Processing Clip 1: ${clip1Video}`);
      let clip1AudioToUse = clip1Audio;
      if (!clip1AudioToUse || !fs.existsSync(clip1AudioToUse)) {
        if (hasAudioTrack(clip1Video)) {
          clip1AudioToUse = path.join(itemDir, 'clip1_extracted_audio.wav');
          execSync(`ffmpeg -y -i "${clip1Video}" -vn -acodec pcm_s16le -ar 44100 -ac 2 "${clip1AudioToUse}"`);
        } else {
          clip1AudioToUse = path.join(itemDir, 'clip1_silent_audio.wav');
          execSync(`ffmpeg -y -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t 5 "${clip1AudioToUse}"`);
        }
      }

      await processVideoMuxing({
        videoPath: JSON.stringify([clip1Video]),
        audioPath: clip1AudioToUse,
        syncOption: 'shortest',
        bgmPath: null,
        bgmVolume: 0,
        sfxVolume: sfxVol,
        videoScale: vScale,
        outputPath: tempClip1
      });
    } else {
      throw new Error("Video Clip 1 asli tidak ditemukan.");
    }

    // 2. Process Clip 2 (Product)
    if (clip2Video && fs.existsSync(clip2Video)) {
      console.log(`[Bridge Bulk FFmpeg] Processing Clip 2 (Product): ${clip2Video}`);
      if (Number(item.enable_tts) === 1 && fs.existsSync(clip2Audio)) {
        let resolvedSync = item.ffmpeg_sync_option || 'smart_sync';
        if (resolvedSync === 'smart_sync') {
          const { determineSmartSyncOption } = await import('./smart-sync-engine.js');
          resolvedSync = await determineSmartSyncOption({
            videoPath: clip2Video,
            audioPath: clip2Audio,
            currentClipIndex: 2,
            bridgeAtClip: bridgeAtClip
          });
        }

        await processVideoMuxing({
          videoPath: JSON.stringify([clip2Video]),
          audioPath: clip2Audio,
          syncOption: resolvedSync,
          bgmPath: null,
          bgmVolume: 0,
          sfxVolume: sfxVol,
          videoScale: vScale,
          outputPath: tempClip2
        });
      } else {
        const clip2SilentAudio = path.join(itemDir, 'clip2_silent_audio.wav');
        execSync(`ffmpeg -y -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t 5 "${clip2SilentAudio}"`);
        await processVideoMuxing({
          videoPath: JSON.stringify([clip2Video]),
          audioPath: clip2SilentAudio,
          syncOption: 'shortest',
          bgmPath: null,
          bgmVolume: 0,
          sfxVolume: sfxVol,
          videoScale: vScale,
          outputPath: tempClip2
        });
      }
    } else {
      throw new Error("Video Clip 2 baru (dari G-Labs) tidak ditemukan.");
    }

    // 3. Process Clip 3
    if (clip3Video && fs.existsSync(clip3Video)) {
      console.log(`[Bridge Bulk FFmpeg] Processing Clip 3: ${clip3Video}`);
      if (Number(item.enable_tts) === 1 && fs.existsSync(clip3Audio)) {
        let resolvedSync = item.ffmpeg_sync_option || 'smart_sync';
        if (resolvedSync === 'smart_sync') {
          const { determineSmartSyncOption } = await import('./smart-sync-engine.js');
          resolvedSync = await determineSmartSyncOption({
            videoPath: clip3Video,
            audioPath: clip3Audio,
            currentClipIndex: 3,
            bridgeAtClip: bridgeAtClip
          });
        }

        await processVideoMuxing({
          videoPath: JSON.stringify([clip3Video]),
          audioPath: clip3Audio,
          syncOption: resolvedSync,
          bgmPath: null,
          bgmVolume: 0,
          sfxVolume: sfxVol,
          videoScale: vScale,
          outputPath: tempClip3
        });
      } else {
        const clip3SilentAudio = path.join(itemDir, 'clip3_silent_audio.wav');
        execSync(`ffmpeg -y -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t 5 "${clip3SilentAudio}"`);
        await processVideoMuxing({
          videoPath: JSON.stringify([clip3Video]),
          audioPath: clip3SilentAudio,
          syncOption: 'shortest',
          bgmPath: null,
          bgmVolume: 0,
          sfxVolume: sfxVol,
          videoScale: vScale,
          outputPath: tempClip3
        });
      }
    } else {
      throw new Error("Video Clip 2 asli tidak ditemukan.");
    }

    // 4. Process Clip 4
    if (clip4Video && fs.existsSync(clip4Video)) {
      console.log(`[Bridge Bulk FFmpeg] Processing Clip 4: ${clip4Video}`);
      if (Number(item.enable_tts) === 1 && fs.existsSync(clip4Audio)) {
        let resolvedSync = item.ffmpeg_sync_option || 'smart_sync';
        if (resolvedSync === 'smart_sync') {
          const { determineSmartSyncOption } = await import('./smart-sync-engine.js');
          resolvedSync = await determineSmartSyncOption({
            videoPath: clip4Video,
            audioPath: clip4Audio,
            currentClipIndex: 4,
            bridgeAtClip: bridgeAtClip
          });
        }

        await processVideoMuxing({
          videoPath: JSON.stringify([clip4Video]),
          audioPath: clip4Audio,
          syncOption: resolvedSync,
          bgmPath: null,
          bgmVolume: 0,
          sfxVolume: sfxVol,
          videoScale: vScale,
          outputPath: tempClip4
        });
      } else {
        const clip4SilentAudio = path.join(itemDir, 'clip4_silent_audio.wav');
        execSync(`ffmpeg -y -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t 5 "${clip4SilentAudio}"`);
        await processVideoMuxing({
          videoPath: JSON.stringify([clip4Video]),
          audioPath: clip4SilentAudio,
          syncOption: 'shortest',
          bgmPath: null,
          bgmVolume: 0,
          sfxVolume: sfxVol,
          videoScale: vScale,
          outputPath: tempClip4
        });
      }
    } else {
      throw new Error("Video Clip 3 asli tidak ditemukan.");
    }

    console.log(`[Bridge Bulk FFmpeg] Concatenating clips sequentially...`);
    const listFilePath = path.join(itemDir, 'concat_list.txt');
    const finalVideoPath = path.join(itemDir, 'bridging_video_final.mp4');

    const concatContent = [
      `file '${tempClip1}'`,
      `file '${tempClip2}'`,
      `file '${tempClip3}'`,
      `file '${tempClip4}'`
    ].join('\n');

    fs.writeFileSync(listFilePath, concatContent);

    execSync(`ffmpeg -y -f concat -safe 0 -i "${listFilePath}" -c copy "${finalVideoPath}"`);
    console.log(`[Bridge Bulk FFmpeg] Concatenation complete: ${finalVideoPath}`);

    await db.prepare(`
      UPDATE bridge_injector_items 
      SET ffmpeg_status = 'completed', workflow_status = 'uploading' 
      WHERE id = ?
    `).run(itemId);

    console.log(`[Bridge Bulk FFmpeg] Completed FFmpeg processing for item #${itemId}.`);
  } catch (err) {
    console.error(`[Bridge Bulk FFmpeg] Error:`, err.message);
    await db.prepare("UPDATE bridge_injector_items SET ffmpeg_status = 'failed', error_message = ? WHERE id = ?").run(err.message, itemId);
    throw err;
  }
}

async function processBridgeBulkSync(itemId, db) {
  const item = await db.prepare("SELECT * FROM bridge_injector_items WHERE id = ?").get(itemId);
  if (!item) return;

  const campaign = await db.prepare("SELECT * FROM bridge_injector_campaigns WHERE id = ?").get(item.campaign_id);
  if (!campaign) return;

  const fs = await import('fs');
  const path = await import('path');
  const { getNextcloudClient, checkAndCreateFolder, getOrCreatePublicShareLink } = await import('./nextcloud-helper.js');
  const { getCloudFolderPath, getCloudMasterFileName, getCloudVoFileName, getCloudClipFileName, getCloudThumbFileName } = await import('./cloud-naming-helper.js');
  const { generateVideoId } = await import('./id-generator.js');

  const campaignId = item.campaign_id;
  const itemDir = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', `bulk_${campaignId}_${itemId}`);

  // Generate Video ID dan standar folder cloud Nextcloud
  const accountName = item.account_name || campaign.account_name || 'umum';
  
  // Dapatkan sequence row number
  const rowCounter = await db.prepare("SELECT COUNT(*) as cnt FROM bridge_injector_items WHERE campaign_id = ? AND id <= ?").get(campaignId, itemId);
  const sequence = rowCounter ? rowCounter.cnt : 1;

  const videoId = generateVideoId({
    accountName: accountName,
    modulePrefix: 'bridge',
    campaignId: campaignId,
    sequence: sequence
  });

  const remoteFolderPath = getCloudFolderPath({
    accountName: accountName,
    campaignId: campaignId,
    videoId: videoId
  });

  console.log(`[Bridge Bulk Scheduler] Syncing files to standardized Nextcloud folder: ${remoteFolderPath}...`);

  // Pastikan folder target dibuat di Nextcloud via client admin global
  const uploadClient = getNextcloudClient();
  await checkAndCreateFolder(remoteFolderPath);
  const uploadRoot = remoteFolderPath.replace(/\/+$/, '') + '/';

  // Helper asinkron untuk upload file
  const uploadFile = async (localPath, remoteName) => {
    if (!fs.existsSync(localPath)) return;
    const readStream = fs.createReadStream(localPath);
    const targetPath = `${uploadRoot}${remoteName}`.replace(/\/+/g, '/');

    try {
      await uploadClient.putFileContents(targetPath, readStream, { overwrite: true });
      console.log(`[Bridge Bulk Scheduler] Sukses mengunggah ${remoteName} ke Nextcloud: ${targetPath}`);
    } catch (err) {
      console.error(`[Bridge Bulk Scheduler] Gagal mengunggah ${remoteName} ke path ${targetPath}:`, err.message);
      throw err;
    }
  };

  // 1. Upload Clip 1 Asli (Lama)
  if (item.local_clip1_path) {
    const absPath = path.join(process.cwd(), 'public', item.local_clip1_path);
    const clip1Name = getCloudClipFileName({ videoId, type: 'scene', clipNo: 1, ext: 'mp4' });
    await uploadFile(absPath, clip1Name);
  }

  // 2. Upload Clip 2 Visual (Baru dari G-Labs)
  if (item.clip2_video_path) {
    const absPath = path.join(process.cwd(), 'public', item.clip2_video_path);
    const clip2Name = getCloudClipFileName({ videoId, type: 'scene', clipNo: 2, ext: 'mp4' });
    await uploadFile(absPath, clip2Name);
  }

  // 3. Upload Clip 3 Asli (Lama)
  if (item.local_clip2_path) {
    const absPath = path.join(process.cwd(), 'public', item.local_clip2_path);
    const clip3Name = getCloudClipFileName({ videoId, type: 'scene', clipNo: 3, ext: 'mp4' });
    await uploadFile(absPath, clip3Name);
  }

  // 4. Upload Clip 4 Asli (Lama)
  if (item.local_clip3_path) {
    const absPath = path.join(process.cwd(), 'public', item.local_clip3_path);
    const clip4Name = getCloudClipFileName({ videoId, type: 'scene', clipNo: 4, ext: 'mp4' });
    await uploadFile(absPath, clip4Name);
  }

  // 5. Upload Audio TTS (Baru) jika diaktifkan
  if (Number(item.enable_tts) === 1) {
    const provider = item.voice_provider || 'gemini';
    const ext = provider === 'minimax' ? 'mp3' : 'wav';
    
    for (const cNum of [2, 3, 4]) {
      const absAudioPath = path.join(itemDir, `audio_clip_${cNum}_baru.${ext}`);
      const voName = getCloudClipFileName({ videoId, type: 'vo', clipNo: cNum, ext: ext });
      await uploadFile(absAudioPath, voName);
    }
  }

  // 6. Upload Naskah MD (Baru)
  if (item.injected_script_md_path) {
    const absMdPath = path.join(process.cwd(), 'public', item.injected_script_md_path);
    await uploadFile(absMdPath, `${videoId}_naskah_baru.md`);
  }

  // 7. Upload Start Frame Clip 2 Image
  if (item.clip2_t2i_image_path) {
    const absImagePath = path.join(process.cwd(), 'public', item.clip2_t2i_image_path);
    const imageExt = item.clip2_t2i_image_path.split('.').pop() || 'png';
    const thumbName = getCloudThumbFileName(videoId, imageExt);
    await uploadFile(absImagePath, thumbName);
  }

  // 8. Upload Video Output Final
  const absFinalVideoPath = path.join(itemDir, 'bridging_video_final.mp4');
  const finalVideoName = getCloudMasterFileName(videoId, 'mp4');
  await uploadFile(absFinalVideoPath, finalVideoName);

  // Dapatkan Public Share Link untuk folder baru ini
  let folderShareUrl = '';
  try {
    folderShareUrl = await getOrCreatePublicShareLink(remoteFolderPath);
  } catch (shareErr) {
    console.warn(`[Bridge Bulk Scheduler] Gagal membuat public share link: ${shareErr.message}`);
  }

  await db.prepare(`
    UPDATE bridge_injector_items 
    SET sync_status = 'completed', workflow_status = 'completed', nextcloud_url = ?
    WHERE id = ?
  `).run(folderShareUrl || null, itemId);

  console.log(`[Bridge Bulk Scheduler] Nextcloud sync completed for item #${itemId}. Share Link: ${folderShareUrl}`);

  // Hapus berkas lokal temporer setelah upload selesai untuk menghemat kapasitas disk
  // Kita hanya menghapus file video besar (.mp4) dan audio (.wav/.mp3), tetapi menyimpan start frame (.jpg/.png) dan naskah (.md)
  try {
    if (fs.existsSync(itemDir)) {
      const files = fs.readdirSync(itemDir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (ext === '.mp4' || ext === '.wav' || ext === '.mp3' || file === 'concat_list.txt') {
          // Kecualikan file start frame visual asli jika ada
          if (file !== 'clip2_start_frame.jpg' && file !== 'clip2_start_frame.png') {
            fs.unlinkSync(path.join(itemDir, file));
          }
        }
      }
      console.log(`[Bridge Bulk Scheduler] Cleaned up local large media files (retaining start frame & script) for item #${itemId}`);
    }
  } catch (cleanErr) {
    console.warn(`[Bridge Bulk Scheduler] Failed to cleanup local large files for item #${itemId}: ${cleanErr.message}`);
  }

  // Auto Sync ke Content Flow setelah Nextcloud sync selesai
  try {
    const { syncBridgeCampaignToContentFlow } = await import('./contentflow-ingest.js');
    await syncBridgeCampaignToContentFlow(item.campaign_id);
    console.log(`[Bridge Bulk Scheduler] Auto-synced campaign ${item.campaign_id} to ContentFlow.`);
  } catch (cfErr) {
    console.error(`[Bridge Bulk Scheduler] Auto-sync to ContentFlow failed for campaign ${item.campaign_id}:`, cfErr.message);
  }
}

async function tickBridgeBulkCampaigns(db) {
  const activeBulkCampaigns = await db.prepare("SELECT * FROM bridge_injector_campaigns WHERE campaign_type = 'bulk' AND status = 'running'").all();
  
  for (const campaign of activeBulkCampaigns) {
    const tenantId = campaign.tenant_id || 'default_tenant';
    const { tenantContext } = await import('./tenant-context.js');
    await tenantContext.run(tenantId, async () => {
      try {
        const items = await db.prepare("SELECT * FROM bridge_injector_items WHERE campaign_id = ? ORDER BY id ASC").all(campaign.id);
        if (items.length === 0) return;

        const allFinished = items.every(item => ['completed', 'failed'].includes(item.workflow_status));
        if (allFinished) {
          const hasFailed = items.some(item => item.workflow_status === 'failed');
          const finalStatus = hasFailed ? 'failed' : 'completed';
          await db.prepare("UPDATE bridge_injector_campaigns SET status = ? WHERE id = ?").run(finalStatus, campaign.id);
          console.log(`[Bridge Bulk Scheduler] Campaign "${campaign.campaign_name}" (ID: ${campaign.id}) finished with status: ${finalStatus}`);
          return;
        }

      // Phase 1: Sequential processing
      let activePhase1Item = items.find(item => ['pending', 'processing'].includes(item.workflow_status));
      if (activePhase1Item) {
        const item = activePhase1Item;
        const taskKey = `bridge_bulk_${item.id}`;

        if (!state.activeTasks.has(taskKey)) {
          if (item.workflow_status === 'pending') {
            await db.prepare("UPDATE bridge_injector_items SET workflow_status = 'processing' WHERE id = ?").run(item.id);
            item.workflow_status = 'processing';
          }

          if (item.download_status === 'pending') {
            runStep(item.id, 'bridge_download', () => wrapProcessor(item.id, db, () => processBridgeBulkDownload(item.id, db)), taskKey);
          } else if (item.download_status === 'completed' && item.gemini_status === 'pending') {
            runStep(item.id, 'bridge_gemini', () => wrapProcessor(item.id, db, () => processBridgeBulkGemini(item.id, db)), taskKey);
          } else if (item.gemini_status === 'completed' && item.t2i_status === 'pending') {
            runStep(item.id, 'bridge_t2i', () => wrapProcessor(item.id, db, () => processBridgeBulkT2i(item.id, db)), taskKey);
          } else if (item.t2i_status === 'processing') {
            runStep(item.id, 'bridge_t2i_poll', () => wrapProcessor(item.id, db, () => processBridgeBulkT2iPoll(item.id, db)), taskKey);
          }
        }
      }

      // Phase 2: Parallel processing
      const activePhase2Items = items.filter(item => ['approved', 'generating_video', 'rendering_tts', 'muxing_ffmpeg', 'uploading'].includes(item.workflow_status));
      for (const item of activePhase2Items) {
        const taskKey = `bridge_bulk_${item.id}`;
        if (!state.activeTasks.has(taskKey)) {
          if (item.workflow_status === 'approved' && item.i2v_status === 'pending') {
            runStep(item.id, 'bridge_i2v', () => wrapProcessor(item.id, db, () => processBridgeBulkI2v(item.id, db)), taskKey);
          } else if (item.workflow_status === 'generating_video' && item.i2v_status === 'processing') {
            runStep(item.id, 'bridge_i2v_poll', () => wrapProcessor(item.id, db, () => processBridgeBulkI2vPoll(item.id, db)), taskKey);
          } else if (item.workflow_status === 'rendering_tts' && item.tts_status === 'pending') {
            runStep(item.id, 'bridge_tts', () => wrapProcessor(item.id, db, () => processBridgeBulkTts(item.id, db)), taskKey);
          } else if (item.workflow_status === 'muxing_ffmpeg' && item.ffmpeg_status === 'pending') {
            runStep(item.id, 'bridge_ffmpeg', () => wrapProcessor(item.id, db, () => processBridgeBulkFfmpeg(item.id, db)), taskKey);
          } else if (item.workflow_status === 'uploading' && item.sync_status === 'pending') {
            runStep(item.id, 'bridge_sync', () => wrapProcessor(item.id, db, () => processBridgeBulkSync(item.id, db)), taskKey);
          }
        }
      }

      } catch (campaignError) {
        console.error(`[Bridge Bulk Scheduler] Error in campaign ${campaign.id}:`, campaignError.message);
      }
    });
  }
}
