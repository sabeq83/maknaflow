import { 
  getDb, 
  updateMultiplierTask, 
  getNextPendingMultiplierTask, 
  getPendingMultiplierTasks,
  getTtsBatchWithClips, 
  createTtsBatch, 
  createTtsClip, 
  updateTtsClip,
  insertGlabsTask,
  updateGlabsTaskStatus,
  getSetting
} from './db';
import { getGeminiModel } from './gemini';
import { buildMultiplierPhase2Prompt } from './prompts';
import { parseGeminiJSON } from './json-parser';
import { generateMinimaxVO } from './minimax-tts';
import { generateVideo, generateImage, getTaskStatus, getFileUrl } from './webhook-client';
import fs from 'fs';
import path from 'path';

// Helper to convert file to base64
const fileToBase64 = (filePath) => {
  const absolutePath = filePath.startsWith('/') ? path.join(process.cwd(), 'public', filePath) : filePath;
  if (!fs.existsSync(absolutePath)) return null;
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
};


let _logWriteCounter = 0;
const MAX_LOG_BYTES = 200_000;   // 200 KB
const KEEP_LOG_LINES = 500;      // baris terbaru yang dipertahankan
const LOG_CHECK_INTERVAL = 50;   // periksa setiap 50 kali tulis

function maybeTruncateLog(logFile) {
  try {
    const stat = fs.statSync(logFile);
    if (stat.size > MAX_LOG_BYTES) {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      const kept = lines.slice(-KEEP_LOG_LINES);
      const truncated =
        `[AUTO-TRUNCATED: ${new Date().toISOString()} — menjaga ${KEEP_LOG_LINES} baris terbaru]\n` +
        kept.join('\n') + '\n';
      fs.writeFileSync(logFile, truncated);
    }
  } catch (err) {
    console.error('Failed to truncate log:', err.message);
  }
}

export function logToMultiplier(message) {
  try {
    const logDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const { getActiveTenantId } = require('./tenant-context.js');
    const tenantId = getActiveTenantId();
    const logFile = path.join(logDir, `multiplier_logs_${tenantId}.txt`);
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const logMessage = `[${timestamp}] ${message}\n`;
    console.info(`[Multiplier Log] ${message}`);
    fs.appendFileSync(logFile, logMessage);
    _logWriteCounter++;
    if (_logWriteCounter % LOG_CHECK_INTERVAL === 0) {
      maybeTruncateLog(logFile);
    }
  } catch (err) {
    console.error('Failed to write multiplier log:', err.message);
  }
}

export async function processNextMultiplierTask() {
  const task = await getNextPendingMultiplierTask();
  if (!task) return;

  const tenantId = task.tenant_id || 'default_tenant';
  const { tenantContext } = await import('./tenant-context.js');

  await tenantContext.run(tenantId, async () => {
    logToMultiplier(`[Multiplier Worker] Starting processing for task ${task.id} (Tenant: ${tenantId}, Status: ${task.status})`);

    try {
      if (task.status === 'pending_resolution') {
        await handleProductResolution(task);
      } else if (task.status === 'resolving_product') {
        // Re-run if got interrupted
        await handleProductResolution(task);
      } else if (task.status === 'remaking') {
        await handleStoryboardRemake(task);
      } else if (task.status === 'generating_t2i') {
        await handleT2iGeneration(task);
      } else if (task.status === 'generating_audio') {
        await handleAudioGeneration(task);
      } else if (task.status === 'generating_visuals') {
        await handleVisualGeneration(task);
      } else if (task.status === 'ffmpeg_muxing') {
        await handleFFmpegMuxing(task);
      }
    } catch (error) {
      console.error(`[Multiplier Worker] Error processing task ${task.id}:`, error.message);
      await updateMultiplierTask(task.id, { status: 'failed', error_message: error.message });
    }
  });
}

// -------------------------------------------------------------
// STAGE 1: Product Resolution (Scraping and DNA Extraction)
// -------------------------------------------------------------
async function handleProductResolution(task) {
  await updateMultiplierTask(task.id, { status: 'resolving_product' });

  const db = getDb();
  const bridging = JSON.parse(task.bridging_config_json || '{}');
  let productDNA = {};
  let resolvedProductId = task.target_product_id || null;

  const productSnapshot = task.product_snapshot_json ? (typeof task.product_snapshot_json === 'string' ? JSON.parse(task.product_snapshot_json) : task.product_snapshot_json) : null;

  if (productSnapshot) {
    logToMultiplier(`[Multiplier Worker] Using product snapshot for task ${task.id}: ${productSnapshot.product_name}`);
    productDNA = {
      product_name: productSnapshot.product_name,
      product_description: productSnapshot.product_description,
      unique_selling_point: productSnapshot.product_usp || productSnapshot.unique_selling_point || '',
      product_truth: productSnapshot.product_truth || productSnapshot.clean_photo_t2i_prompt || '',
      geometric_truth: productSnapshot.geometric_truth || '',
      clean_photo_t2i_prompt: productSnapshot.clean_photo_t2i_prompt || '',
      t2i_prompt: productSnapshot.t2i_prompt || ''
    };
    resolvedProductId = productSnapshot.product_id || resolvedProductId;
  } else if (bridging.bridgingMode === 'select_existing') {
    const product = await db.prepare('SELECT * FROM product_extractions WHERE id = ?').get(bridging.targetProductId || resolvedProductId);
    if (!product) throw new Error(`Product ID ${bridging.targetProductId || resolvedProductId} not found in database`);
    productDNA = {
      product_name: product.product_name || '',
      product_description: product.product_description || '',
      unique_selling_point: product.unique_selling_point || '',
      product_truth: product.product_truth || product.clean_photo_t2i_prompt || '',
      geometric_truth: product.geometric_truth || '',
      clean_photo_t2i_prompt: product.clean_photo_t2i_prompt || '',
      t2i_prompt: product.t2i_prompt || ''
    };
    resolvedProductId = product.id;
  } else if (bridging.bridgingMode === 'manual_input') {
    productDNA = {
      product_name: bridging.manualProductName || '',
      product_description: bridging.manualProductDesc || '',
      unique_selling_point: bridging.manualProductUsp || ''
    };
  } else if (bridging.bridgingMode === 'url_extract') {
    const url = task.target_product_url || bridging.productUrl;
    if (!url) throw new Error("Product URL is missing for url_extract mode");

    logToMultiplier(`[Multiplier Worker] Scraping and extracting DNA for URL: ${url}`);
    const { scrapeUrl } = await import('./url-scraper');
    const scraped = await scrapeUrl(url);
    const sourceContent = scraped.fullText;

    const { buildProductAgentPrompt } = await import('./prompts');
    const { parseGeminiJSON } = await import('./json-parser');

    const prompt = buildProductAgentPrompt(sourceContent, true);
    const model = await getGeminiModel();
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = parseGeminiJSON(responseText);
    const extracted = parsed.product_data || parsed;

    // Save permanently to local product extraction database
    const newProductId = `pe_mult_${Date.now()}`;
    await db.prepare(`
      INSERT INTO product_extractions (id, input_source, is_url, product_name, product_description, unique_selling_point, raw_response)
      VALUES (?, ?, 1, ?, ?, ?, ?)
    `).run(
      newProductId,
      url,
      extracted.product_name || '',
      extracted.product_description || '',
      typeof extracted.unique_selling_point === 'string'
        ? extracted.unique_selling_point
        : JSON.stringify(extracted.unique_selling_point || ''),
      responseText
    );

    productDNA = {
      product_name: extracted.product_name || '',
      product_description: extracted.product_description || '',
      unique_selling_point: extracted.unique_selling_point || ''
    };
    resolvedProductId = newProductId;

    // Self-healing download of product image if hybrid_lock is active
    const visualMode = bridging.visualMode || 'pure_t2v';
    const scrapedImageUrl = extracted.scraped_image_url || '';
    if (visualMode === 'hybrid_lock' && scrapedImageUrl) {
      try {
        const { downloadECommerceImage } = await import('./url-scraper');
        const safeFilename = `product_ref_multiplier_${task.id}_${Date.now()}.png`;
        const localImagePath = `/uploads/products/${safeFilename}`;
        const absoluteLocalPath = path.join(process.cwd(), 'public', 'uploads', 'products', safeFilename);
        const uploadsDir = path.dirname(absoluteLocalPath);
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        await downloadECommerceImage(scrapedImageUrl, absoluteLocalPath);
        bridging.productRefImagePath = localImagePath;
        bridging.productFilenameDeclare = safeFilename;
      } catch (err) {
        console.error(`[Multiplier Worker] Product image self-healing failed:`, err.message);
      }
    }
  }

  // Create campaign binding
  if (resolvedProductId) {
    try {
      const { createOrUpdateCampaignProductBinding } = await import('./campaign-product-binding.js');
      const { getActiveTenantId } = await import('./tenant-context.js');
      const tenantId = getActiveTenantId();
      const brandProfileId = bridging.brandProfileId || bridging.brand_profile_id || null;

      await createOrUpdateCampaignProductBinding({
        tenantId,
        sourceType: 'multiplier',
        sourceCampaignId: task.id,
        sourceItemId: null,
        brandProfileId,
        productId: resolvedProductId,
        explicitAffiliateOverride: null,
        affiliateRequired: false
      });
    } catch (bindErr) {
      console.error('[Multiplier Ingest Binding Warning]:', bindErr.message);
    }
  }

  // Update bridging config with resolved product data
  bridging.resolvedDNA = productDNA;
  await updateMultiplierTask(task.id, { 
    bridging_config_json: JSON.stringify(bridging),
    status: 'remaking'
  });
}

// -------------------------------------------------------------
// STAGE 2: Storyboard Remake via Gemini Phase 2
// -------------------------------------------------------------
async function handleStoryboardRemake(task) {
  const db = getDb();
  const asset = await db.prepare('SELECT * FROM re_deconstructed_assets WHERE id = ?').get(task.deconstruct_asset_id);
  if (!asset) throw new Error(`Source deconstruct asset ${task.deconstruct_asset_id} not found`);

  const originalStoryboard = JSON.parse(asset.original_storyboard_json || '[]');
  const bridging = JSON.parse(task.bridging_config_json || '{}');
  const aesthetics = JSON.parse(task.vso_config_json || '{}'); // UI stores aesthetics here
  const vso = aesthetics; // aesthetic configs and visual overrides are merged
  const audio = JSON.parse(task.audio_config_json || '{}');

  const productDNA = bridging.resolvedDNA || {
    product_name: bridging.manualProductName || '',
    product_description: bridging.manualProductDesc || '',
    unique_selling_point: bridging.manualProductUsp || ''
  };

  logToMultiplier(`[Multiplier Worker] Prompting Gemini for storyboard remake of task ${task.id}`);
  const prompt = buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, vso, audio);

  const model = await getGeminiModel();
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const { parseGeminiJSON } = await import('./json-parser');
  const parsed = parseGeminiJSON(responseText);

  const voiceover = parsed.storyboard || [];
  let safeVoiceover = voiceover;
  let complianceStatus = 'skipped';
  let complianceScore = 0;
  let complianceLog = null;

  if (task.enable_vo_audit === 1 || task.enable_vo_audit !== 0) {
    try {
      logToMultiplier(`[Multiplier Worker] Running TikTok safe VO compliance audit for task ${task.id}...`);
      const fullOriginalVo = voiceover.map(v => v.voice_over || v.narration || '').join('\n');
      const captionText = parsed.caption || '';
      const { auditScriptForTikTok } = await import('./tiktok-compliance-service');
      const auditResult = await auditScriptForTikTok(fullOriginalVo, captionText);

      safeVoiceover = voiceover.map((v, idx) => ({
        ...v,
        voice_over: (auditResult.revised_script && auditResult.revised_script[idx] !== undefined)
          ? auditResult.revised_script[idx]
          : (v.voice_over || v.narration || '')
      }));

      complianceStatus = auditResult.verdict || 'pass';
      
      const scoreMap = {
        'low': 10,
        'medium': 45,
        'high': 75,
        'critical': 95,
        'pass': 10,
        'fail': 80
      };
      const scoreStr = String(auditResult.risk_score || 'low').toLowerCase();
      complianceScore = scoreMap[scoreStr] !== undefined ? scoreMap[scoreStr] : (parseInt(scoreStr, 10) || 10);

      complianceLog = auditResult;
    } catch (err) {
      console.error('[Multiplier Worker] Compliance audit error:', err.message);
    }
  }

  const hasGlabs = audio.enableGlabs === 1 || audio.enableGlabs === true;
  const visualMode = bridging.visualMode || 'pure_t2v';
  const hasT2i = (hasGlabs && bridging.isBridgingActive && visualMode === 'hybrid_lock');
  const nextStatus = hasT2i ? 'generating_t2i' : 'waiting_approval';

  await updateMultiplierTask(task.id, {
    remake_storyboard_json: JSON.stringify(safeVoiceover),
    original_voiceover: JSON.stringify(voiceover),
    tiktok_safe_voiceover: JSON.stringify(safeVoiceover),
    compliance_status: complianceStatus,
    compliance_score: complianceScore,
    compliance_log_json: complianceLog ? JSON.stringify(complianceLog) : null,
    selected_vo_version: 'original',
    t2i_i2v_prompts_json: JSON.stringify(parsed.prompts || []),
    new_caption: parsed.caption || '',
    status: nextStatus
  });
}

// Tahap Baru: Generasi Start Frame T2I (Akhir Fase 1)
async function handleT2iGeneration(task) {
  await updateMultiplierTask(task.id, { status: 'generating_t2i' });
  const bridging = JSON.parse(task.bridging_config_json || '{}');
  const aesthetics = JSON.parse(task.vso_config_json || '{}');
  const prompts = JSON.parse(task.t2i_i2v_prompts_json || '[]');
  const aspect_ratio = aesthetics.aspectRatio || '9:16';
  const imageModel = getSettingVal('webhook_image_model') || 'nano_banana_pro';

  let productBase64 = null;
  const imagePath = bridging.product_ref_image_path || bridging.productRefImagePath;
  if (imagePath) {
    productBase64 = fileToBase64(imagePath);
  }

  let t2iImages = [];
  const totalCount = prompts.length;

  for (let i = 0; i < totalCount; i++) {
    const clip = prompts[i];
    const clipIndex = clip.scene || clip.clip || (i + 1);
    const promptText = clip.t2i_prompt || '';

    if (!promptText) {
      t2iImages.push(null);
      continue;
    }

    logToMultiplier(`[Multiplier Worker] Generating T2I start frame for clip ${clipIndex}/${totalCount} of task ${task.id}...`);

    const t2iResult = await generateImage({
      prompt: promptText,
      model: imageModel,
      aspect_ratio,
      reference_images: productBase64 ? [productBase64] : undefined
    });

    if (!t2iResult?.task_id) {
      logToMultiplier(`[Multiplier Worker] Clip ${clipIndex} failed to submit`);
      t2iImages.push(null);
      continue;
    }

    let t2iImageUrl = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const t2iStatusResult = await getTaskStatus(t2iResult.task_id);
      if (t2iStatusResult?.status?.toLowerCase() === 'completed') {
        const files = t2iStatusResult.results || t2iStatusResult.files || [];
        let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
        if (imageFile && (imageFile.startsWith('http://') || imageFile.startsWith('https://'))) {
          imageFile = imageFile.split('/').pop();
        }
        if (imageFile) {
          t2iImageUrl = getFileUrl(imageFile);
        }
        break;
      } else if (t2iStatusResult?.status?.toLowerCase() === 'failed') {
        break;
      }
    }

    if (t2iImageUrl) {
      try {
        const targetDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        const localFilename = `generated_start_frame_${task.id}_clip${clipIndex}_${Date.now()}.png`;
        const localPath = path.join(targetDir, localFilename);
        
        const response = await fetch(t2iImageUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        fs.writeFileSync(localPath, Buffer.from(arrayBuffer));
        
        t2iImages.push(`/uploads/start_frames/${localFilename}`);
      } catch (err) {
        console.error(`[Multiplier Worker] Local save failed for clip ${clipIndex}:`, err.message);
        t2iImages.push(null);
      }
    } else {
      t2iImages.push(null);
    }

    // Safety Delay (5 seconds) to avoid G-Labs rate limit
    if (i < totalCount - 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  await updateMultiplierTask(task.id, {
    t2i_images_json: JSON.stringify(t2iImages),
    status: 'waiting_approval'
  });
}

// -------------------------------------------------------------
// STAGE 3: TTS Audio Generation and Merging
// -------------------------------------------------------------
async function handleAudioGeneration(task) {
  await updateMultiplierTask(task.id, { status: 'generating_audio' });

  const audioConfig = JSON.parse(task.audio_config_json || '{}');
  const storyboard = JSON.parse(task.remake_storyboard_json || '[]');

  const batchId = `multiplier_tts_${task.id}`;
  const provider = audioConfig.voiceProvider || 'minimax';
  const persona = audioConfig.voicePersona || 'Indonesian_SweetGirl';

  logToMultiplier(`[Multiplier Worker] Creating TTS batch ${batchId}`);
  await createTtsBatch({
    id: batchId,
    source_type: 'multiplier',
    source_ref_id: task.id,
    provider_active: provider,
    voice_persona: persona,
    config_speed: audioConfig.voiceSpeed || 1.0,
    config_volume: audioConfig.voiceVolume || 1.0,
    tts_model_quality: audioConfig.ttsModelQuality || 'speech-2.8-turbo'
  });

  const tempDir = path.join(process.cwd(), 'public', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const clipsAudioPaths = [];

  for (let c = 0; c < storyboard.length; c++) {
    const text = storyboard[c].narration_transcript || storyboard[c].voiceover || '';
    const ext = provider === 'minimax' ? 'mp3' : 'wav';
    const clipId = `clip_${task.id}_${c}`;
    const outputClipName = `tts_clip_mult_${task.id}_${c}.${ext}`;
    const localClipPath = path.join(tempDir, outputClipName);

    await createTtsClip({
      id: clipId,
      batch_id: batchId,
      clip_index: c,
      source_text: text,
      audio_path: `/temp/${outputClipName}`,
      status: 'pending'
    });

    logToMultiplier(`[Multiplier Worker] Rendering TTS clip ${c + 1}/${storyboard.length}`);
    if (provider === 'minimax') {
      await generateMinimaxVO(text, persona, localClipPath, {
        speed: audioConfig.voiceSpeed || 1.0,
        volume: audioConfig.voiceVolume || 1.0,
        model: audioConfig.ttsModelQuality || 'speech-2.8-turbo',
        language: audioConfig.targetLanguage || 'id-ID'
      });
    } else {
      const { generateGeminiExact8sAudio } = await import('./gemini-8s-tts');
      await generateGeminiExact8sAudio(text, persona, localClipPath);
    }

    await updateTtsClip(clipId, { status: 'completed' });
    clipsAudioPaths.push(localClipPath);
  }

  // Combine clips using FFmpeg
  const combinedAudioName = `tts_multiplier_combined_${task.id}.mp3`;
  const absoluteCombinedPath = path.join(tempDir, combinedAudioName);
  
  const { execSync } = await import('child_process');
  const filterString = clipsAudioPaths.map((_, index) => `[${index}:a]`).join('') + `concat=n=${clipsAudioPaths.length}:v=0:a=1[a]`;
  
  let cmd = `ffmpeg -y `;
  clipsAudioPaths.forEach(p => {
    cmd += `-i "${p}" `;
  });
  cmd += `-filter_complex "${filterString}" -map "[a]" "${absoluteCombinedPath}"`;
  
  logToMultiplier(`[Multiplier Worker] Concatenating TTS audio clips...`);
  execSync(cmd);

  audioConfig.combined_audio_path = `/temp/${combinedAudioName}`;
  const hasGlabs = audioConfig.enableGlabs === 1 || audioConfig.enableGlabs === true;
  const nextStatus = hasGlabs ? 'generating_visuals' : 'completed';
  await updateMultiplierTask(task.id, {
    audio_config_json: JSON.stringify(audioConfig),
    status: nextStatus
  });
}

// -------------------------------------------------------------
// STAGE 4: Visual Generation (G-Labs Local Webhook Integration)
// -------------------------------------------------------------
async function handleVisualGeneration(task) {
  const db = getDb();
  const bridging = JSON.parse(task.bridging_config_json || '{}');
  const aesthetics = JSON.parse(task.vso_config_json || '{}');
  const audioConfig = JSON.parse(task.audio_config_json || '{}');
  const prompts = JSON.parse(task.t2i_i2v_prompts_json || '[]');

  const enableGlabs = audioConfig.enableGlabs === 1 || audioConfig.enableGlabs === true;
  if (!enableGlabs) {
    logToMultiplier(`[Multiplier Worker] G-Labs visual generation is disabled. Skipping visuals stage.`);
    await updateMultiplierTask(task.id, { status: 'completed' });
    return;
  }

  const videoModel = aesthetics.videoModel || getSettingVal('webhook_video_model') || 'veo_31_lite';
  const imageModel = getSettingVal('webhook_image_model') || 'nano_banana_pro';
  const aspect_ratio = aesthetics.aspectRatio || '9:16';
  
  const visualMode = bridging.visualMode || 'pure_t2v';
  const bridgeAtClip = Number(bridging.bridgeAtClip) || 2;

  // Case A: Prompts not yet submitted to G-Labs
  if (!task.glabs_task_ids) {
    logToMultiplier(`[Multiplier Worker] Submitting video tasks to G-Labs for task ${task.id}`);
    await updateMultiplierTask(task.id, { status: 'generating_visuals' });

    const submittedTaskIds = [];

    for (let c = 1; c <= prompts.length; c++) {
      const promptObj = prompts[c - 1];
      const isHybridLockClip = (bridging.isBridgingActive && visualMode === 'hybrid_lock' && c === bridgeAtClip);
      
      let finalVideoTaskId = null;

      if (isHybridLockClip) {
        // Single pass hybrid lock using pre-generated start frame
        const i2vPromptText = promptObj.i2v_prompt || '';
        const t2iImageUrl = bridging.generatedStartFrameUrl;

        if (!t2iImageUrl) {
          throw new Error(`T2I start frame image URL is missing in bridging config for task ${task.id}`);
        }

        logToMultiplier(`[Multiplier Worker] Hybrid Lock Clip: Generating video from start frame for clip ${c}`);
        // Generate video from the pre-generated image
        const videoResult = await generateVideo({
          prompt: i2vPromptText,
          model: videoModel,
          aspect_ratio,
          mode: 'start_image',
          reference_images: [t2iImageUrl]
        });

        if (!videoResult?.task_id) {
          throw new Error(`I2V video generation failed to submit for clip ${c}`);
        }

        finalVideoTaskId = videoResult.task_id;
      } else {
        // Pure T2V or outside bridging range
        const t2vPromptText = promptObj.t2v_prompt || promptObj.prompt || '';
        logToMultiplier(`[Multiplier Worker] Submitting T2V video task for clip ${c}: ${t2vPromptText}`);
        const videoResult = await generateVideo({
          prompt: t2vPromptText,
          model: videoModel,
          aspect_ratio,
          mode: 'text_to_video'
        });

        if (!videoResult?.task_id) {
          throw new Error(`T2V video generation failed to submit for clip ${c}`);
        }

        finalVideoTaskId = videoResult.task_id;
      }

      // Track G-Labs task ID
      submittedTaskIds.push(finalVideoTaskId);
      await insertGlabsTask(finalVideoTaskId, task.id, c, prompts[c - 1].t2v_prompt || prompts[c - 1].prompt || '');
    }

    await updateMultiplierTask(task.id, {
      glabs_task_ids: JSON.stringify(submittedTaskIds)
    });
  } 
  // Case B: Task IDs are already submitted, poll them
  else {
    const taskIds = JSON.parse(task.glabs_task_ids);
    logToMultiplier(`[Multiplier Worker] Polling G-Labs visual task IDs for task ${task.id}:`, taskIds);

    const completedUrls = [];
    let allCompleted = true;
    let anyFailed = false;

    for (let i = 0; i < taskIds.length; i++) {
      const taskId = taskIds[i];
      const cached = await db.prepare('SELECT status, video_url FROM glabs_tasks WHERE task_id = ?').get(taskId);
      if (cached && cached.status === 'completed' && cached.video_url) {
        completedUrls[i] = cached.video_url;
        continue;
      }

      const taskResult = await getTaskStatus(taskId);
      const status = (taskResult?.status || '').toLowerCase();

      if (status === 'completed') {
        const files = taskResult.results || taskResult.files || [];
        let videoFile = files.find(f => f.endsWith('.mp4')) || files[0];
        if (videoFile && (videoFile.startsWith('http://') || videoFile.startsWith('https://'))) {
          videoFile = videoFile.split('/').pop();
        }
        if (videoFile) {
          const completedUrl = getFileUrl(videoFile);
          completedUrls[i] = completedUrl;
          await updateGlabsTaskStatus(taskId, 'completed', completedUrl);
        } else {
          allCompleted = false;
        }
      } else if (status === 'failed') {
        anyFailed = true;
        await updateGlabsTaskStatus(taskId, 'failed');
      } else {
        allCompleted = false;
      }
    }

    if (anyFailed) {
      throw new Error("One or more G-Labs video generation tasks failed.");
    }

    if (allCompleted && completedUrls.filter(Boolean).length === taskIds.length) {
      logToMultiplier(`[Multiplier Worker] All visual generation completed!`);

      // Download visual clips locally for FFmpeg processing
      const localPaths = [];
      const tempDir = path.join(process.cwd(), 'public', 'temp');
      const { downloadFromUrl } = await import('./video-downloader');

      for (let i = 0; i < completedUrls.length; i++) {
        const url = completedUrls[i];
        const filename = `mult_clip_${task.id}_${i}.mp4`;
        const localPath = path.join(tempDir, filename);
        if (!fs.existsSync(localPath)) {
          logToMultiplier(`[Multiplier Worker] Downloading visual clip ${i + 1} from ${url}`);
          await downloadFromUrl(url, localPath);
        }
        localPaths.push(localPath);
      }

      const hasFfmpeg = audioConfig.enableFfmpeg === 1 || audioConfig.enableFfmpeg === true;
      if (hasFfmpeg && audioConfig.combined_audio_path) {
        await updateMultiplierTask(task.id, { 
          status: 'ffmpeg_muxing',
          remake_storyboard_json: JSON.stringify(localPaths) // Store resolved local paths in storyboard_json temporarily or pass it directly
        });
      } else {
        // Just concatenate videos without voiceover
        const combinedVideoName = `multiplier_combined_no_vo_${task.id}.mp4`;
        const outputPath = path.join(tempDir, combinedVideoName);
        
        const { execSync } = await import('child_process');
        const listFilePath = path.join(tempDir, `mult_list_${task.id}.txt`);
        const listContent = localPaths.map(p => `file '${p}'`).join('\n');
        fs.writeFileSync(listFilePath, listContent);
        
        logToMultiplier(`[Multiplier Worker] Merging video clips without voiceover...`);
        execSync(`ffmpeg -y -f concat -safe 0 -i "${listFilePath}" -c copy "${outputPath}"`);
        
        await updateMultiplierTask(task.id, {
          ffmpeg_output_path: `/temp/${combinedVideoName}`,
          status: 'completed'
        });

        await uploadCompletedTaskToNextcloud(task.id, outputPath);
      }
    }
  }
}

// -------------------------------------------------------------
// STAGE 5: FFmpeg Muxing & Smart Sync Engine
// -------------------------------------------------------------
async function handleFFmpegMuxing(task) {
  await updateMultiplierTask(task.id, { status: 'ffmpeg_muxing' });

  const audioConfig = JSON.parse(task.audio_config_json || '{}');
  const bridging = JSON.parse(task.bridging_config_json || '{}');
  const aesthetics = JSON.parse(task.vso_config_json || '{}');

  const { processTtsStudioMuxing } = await import('./video-studio-processor');

  const tempDir = path.join(process.cwd(), 'public', 'temp');
  // Local downloaded visual clips were saved previously, let's find them
  const localPaths = [];
  const prompts = JSON.parse(task.t2i_i2v_prompts_json || '[]');
  for (let i = 0; i < prompts.length; i++) {
    localPaths.push(path.join(tempDir, `mult_clip_${task.id}_${i}.mp4`));
  }

  const finalOutputName = `multiplier_final_render_${task.id}.mp4`;
  const finalOutputPath = path.join(tempDir, finalOutputName);

  logToMultiplier(`[Multiplier Worker] Running FFmpeg Smart Sync Studio Muxing...`);
  await processTtsStudioMuxing({
    id: task.id,
    videoPath: JSON.stringify(localPaths),
    batchId: `multiplier_tts_${task.id}`,
    syncOption: audioConfig.ffmpegSyncOption || 'smart_sync',
    bgmPath: null,
    bgmVolume: 0,
    sfxVolume: audioConfig.ffmpegSfxVolume || 0,
    videoScale: audioConfig.ffmpegVideoScale || 1.0,
    outputPath: finalOutputPath,
    bridgeAtClip: Number(bridging.bridgeAtClip) || 2
  });

  await updateMultiplierTask(task.id, {
    ffmpeg_output_path: `/temp/${finalOutputName}`,
    status: 'completed'
  });

  await uploadCompletedTaskToNextcloud(task.id, finalOutputPath);

  logToMultiplier(`[Multiplier Worker] Task ${task.id} completely finished!`);
}

// Helper to retrieve settings
function getSettingVal(key) {
  return getSetting(key);
}

// Build Markdown Narrative Asset for Multiplier Lab
function buildMultiplierMarkdownContent(task) {
  const lines = [];
  lines.push(`# Multiplier Lab Remake - Task #${task.id}`);
  lines.push('');
  lines.push(`**Target Product URL:** ${task.target_product_url || 'Manual Input'}`);
  if (task.affiliate_url) lines.push(`**Affiliate URL:** ${task.affiliate_url}`);
  lines.push(`**Tanggal Proses:** ${new Date(task.created_at).toLocaleString('id-ID')}`);
  lines.push('');

  const bridging = JSON.parse(task.bridging_config_json || '{}');
  const vso = JSON.parse(task.vso_config_json || '{}');
  
  lines.push('---');
  lines.push('## ⚙️ Configuration Settings');
  lines.push('');
  lines.push(`- **Visual Style:** ${vso.visualStyle || 'Cinematic'}`);
  lines.push(`- **Narrative Mode:** ${vso.narrativeMode || 'Storytelling'}`);
  lines.push(`- **Face Visibility:** ${vso.faceVisibility || 'Faceless'}`);
  lines.push(`- **Words per Clip:** ${vso.wordsPerClip || '17-19 kata'}`);
  lines.push(`- **Visual Mode:** ${bridging.visualMode || 'pure_t2v'}`);
  lines.push(`- **Sandwich Protocol Bridging:** ${bridging.isBridgingActive ? 'Active' : 'Inactive'}`);
  if (bridging.isBridgingActive) {
    lines.push(`  - **Mulai Promosi pada Klip Ke-:** ${bridging.bridgeAtClip}`);
    lines.push(`  - **Durasi Promosi (Jumlah Klip):** ${bridging.bridgeDurationClips || 1}`);
  }
  lines.push('');

  if (task.new_caption) {
    lines.push('---');
    lines.push('## ✍️ Social Media Caption');
    lines.push('');
    lines.push(task.new_caption);
    lines.push('');
  }

  if (task.remake_storyboard_json) {
    lines.push('---');
    lines.push('## 📋 Storyboard & Narration');
    lines.push('');
    try {
      const storyboard = JSON.parse(task.remake_storyboard_json);
      const prompts = JSON.parse(task.t2i_i2v_prompts_json || '[]');
      storyboard.forEach((scene, index) => {
        lines.push(`### Adegan ${scene.scene || index + 1}`);
        lines.push(`**Visual Description:** ${scene.visual_description || ''}`);
        lines.push(`**Voiceover Narration:** "${scene.narration_transcript || scene.voiceover || ''}"`);
        
        const pObj = prompts[index];
        if (pObj) {
          lines.push(`- **T2V Prompt:** ${pObj.t2v_prompt || '-'}`);
          lines.push(`- **T2I Prompt:** ${pObj.t2i_prompt || '-'}`);
          lines.push(`- **I2V Motion:** ${pObj.i2v_prompt || '-'}`);
        }
        lines.push('');
      });
    } catch (e) {
      lines.push(`Failed to parse storyboard: ${e.message}`);
    }
  }

  return lines.join('\n');
}

// Upload Completed Video & MD Narrative to Nextcloud
async function uploadCompletedTaskToNextcloud(taskId, localVideoPath) {
  const storageProvider = getSettingVal('storage_provider') || 'gdrive';
  if (storageProvider !== 'nextcloud') return;

  try {
    const db = getDb();
    const task = await db.prepare('SELECT * FROM re_multiplier_tasks WHERE id = ?').get(taskId);
    if (!task) return;

    const { uploadFileToNextcloud, uploadBufferToNextcloud } = await import('./nextcloud-helper');
    
    let audioConfig = {};
    try {
      audioConfig = JSON.parse(task.audio_config_json || '{}');
    } catch(_) {}

    const targetFolder = audioConfig.nextcloudParentFolder || audioConfig.nextcloud_parent_folder || getSettingVal('nextcloud_target_folder') || '/MAKNA_Video_Generations';
    
    // Naming folder structure: Multiplier_Lab/Multiplier_{taskId}
    const batchFolderPath = `${targetFolder}/Multiplier_Lab/Multiplier_${task.id}`.replace(/\/+/g, '/');

    // 1. Upload narrative markdown
    logToMultiplier(`[Multiplier Worker] Uploading narrative .md to Nextcloud for task ${taskId}...`);
    const mdContent = buildMultiplierMarkdownContent(task);
    const remoteMdPath = `${batchFolderPath}/Multiplier_${task.id}.md`.replace(/\/+/g, '/');
    const uploadedMd = await uploadBufferToNextcloud(Buffer.from(mdContent, 'utf-8'), remoteMdPath);

    // 2. Upload video file
    logToMultiplier(`[Multiplier Worker] Uploading video to Nextcloud for task ${taskId}...`);
    const remoteVideoPath = `${batchFolderPath}/Multiplier_${task.id}.mp4`.replace(/\/+/g, '/');
    const uploadedVideo = await uploadFileToNextcloud(localVideoPath, remoteVideoPath);

    logToMultiplier(`[Multiplier Worker] Nextcloud upload completed for task ${taskId}`);
    await updateMultiplierTask(task.id, {
      nextcloud_video_url: uploadedVideo.fileUrl,
      nextcloud_md_url: uploadedMd.fileUrl
    });
  } catch (err) {
    console.error(`[Multiplier Worker] Nextcloud upload failed for task ${taskId}:`, err.message);
  }
}
