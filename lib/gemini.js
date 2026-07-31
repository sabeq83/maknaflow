import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, GoogleAICacheManager } from '@google/generative-ai/server';
import { getSetting, setSetting, getAvailableApiKey, incrementKeyUsage, markKeyExhausted, markApiKeyStatus } from './db.js';
import { getStitchedMasterKB } from './kb-stitcher.js';

/**
 * Resolve API key: pool first, then single key from settings as fallback.
 */
function resolveApiKey(explicitKey = null) {
  if (explicitKey) return explicitKey;
  
  const apiTier = getSetting('gemini_api_tier') || 'paid';
  if (apiTier === 'paid') {
    const singleKey = getSetting('gemini_api_key');
    if (!singleKey) {
      throw new Error('Gemini API Key belum dikonfigurasi. Silakan masukkan API Key di halaman Settings.');
    }
    return singleKey;
  } else {
    // Free Tier -> Use rotated free API key
    const keyEntry = getAvailableApiKey(1);
    if (keyEntry) {
      return keyEntry.api_key;
    }
    // Fallback to single key
    const singleKey = getSetting('gemini_api_key');
    if (!singleKey) {
      throw new Error('Gemini API Key belum dikonfigurasi. Silakan masukkan API Key di halaman Settings.');
    }
    return singleKey;
  }
}

export const GEMINI_MODELS = {
  PRIMARY: 'gemini-3.6-flash',
  FALLBACK_1: 'gemini-3.5-flash',
  FALLBACK_2: 'gemini-flash-latest',
  TTS: 'gemini-2.5-flash-preview-tts',
  SCRAPER: 'gemini-3.6-flash',
  COMPLIANCE: 'gemini-2.5-flash'
};

/**
 * Wraps a model instance to handle errors and fall back to gemini-2.5-flash / gemini-1.5-flash
 */
function makeModelResilient(model, apiKey, modelName = GEMINI_MODELS.PRIMARY, isExplicitKey = false) {
  const originalGenerateContent = model.generateContent.bind(model);
  
  model.generateContent = async function(request) {
    if (isExplicitKey) {
      const primaryModel = modelName;
      const fallbackModel = primaryModel === GEMINI_MODELS.PRIMARY 
        ? GEMINI_MODELS.FALLBACK_1 
        : (primaryModel === GEMINI_MODELS.FALLBACK_1 ? GEMINI_MODELS.FALLBACK_2 : null);
      const maxRetries = 4;
      
      let currentModel = primaryModel;
      let attempt = 0;
      
      while (true) {
        try {
          if (currentModel === primaryModel) {
            return await originalGenerateContent(request);
          } else {
            const genAI = new GoogleGenerativeAI(apiKey);
            const modelOptions = {
              model: fallbackModel,
              generationConfig: model.generationConfig
            };
            if (model.tools) {
              modelOptions.tools = model.tools;
            }
            const fallbackModelObj = genAI.getGenerativeModel(modelOptions);
            return await fallbackModelObj.generateContent(request);
          }
        } catch (error) {
          const is503 = error.status === 503 ||
                        error.message?.includes('503') ||
                        error.message?.toLowerCase().includes('service unavailable') ||
                        error.message?.toLowerCase().includes('high demand') ||
                        error.message?.toLowerCase().includes('overloaded');
                        
          if (is503 && attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 4000 + Math.random() * 1000;
            console.warn(`[Gemini-ResilientModel-Explicit] ${currentModel} returned 503 (high demand). Retrying in ${Math.round(delay/1000)}s (attempt ${attempt + 1}/${maxRetries})...`);
            attempt++;
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          
          if (currentModel === primaryModel && fallbackModel) {
            console.warn(`[Gemini-ResilientModel-Explicit] ${currentModel} failed (${error.message}). Swapping to fallback model ${fallbackModel}...`);
            currentModel = fallbackModel;
            attempt = 0;
            continue;
          }
          
          throw error;
        }
      }
    }

    // No explicit key -> Perform automatic key pool rotation on 429
    return await executeWithKeyPool(1, async (rotatedKey) => {
      const primaryModel = modelName;
      const fallbackModel = primaryModel === GEMINI_MODELS.PRIMARY 
        ? GEMINI_MODELS.FALLBACK_1 
        : (primaryModel === GEMINI_MODELS.FALLBACK_1 ? GEMINI_MODELS.FALLBACK_2 : null);
      const maxRetries = 4;
      
      let currentModel = primaryModel;
      let attempt = 0;
      
      while (true) {
        try {
          const genAI = new GoogleGenerativeAI(rotatedKey);
          const modelOptions = {
            model: currentModel === primaryModel ? primaryModel : fallbackModel,
            generationConfig: model.generationConfig
          };
          if (model.tools) {
            modelOptions.tools = model.tools;
          }
          const modelObj = genAI.getGenerativeModel(modelOptions);
          return await modelObj.generateContent(request);
        } catch (error) {
          const is503 = error.status === 503 ||
                        error.message?.includes('503') ||
                        error.message?.toLowerCase().includes('service unavailable') ||
                        error.message?.toLowerCase().includes('high demand') ||
                        error.message?.toLowerCase().includes('overloaded');
                        
          if (is503 && attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 4000 + Math.random() * 1000;
            console.warn(`[Gemini-ResilientModel-Rotated] ${currentModel} returned 503 (high demand). Retrying in ${Math.round(delay/1000)}s (attempt ${attempt + 1}/${maxRetries})...`);
            attempt++;
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          
          if (currentModel === primaryModel && fallbackModel) {
            console.warn(`[Gemini-ResilientModel-Rotated] ${currentModel} failed (${error.message}). Swapping to fallback model ${fallbackModel}...`);
            currentModel = fallbackModel;
            attempt = 0;
            continue;
          }
          
          throw error;
        }
      }
    });
  };
  
  return model;
}

export async function getGeminiModel(apiKey = null) {
  const key = resolveApiKey(apiKey);
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODELS.PRIMARY,
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 65535,
      responseMimeType: 'application/json',
    },
  });
  return makeModelResilient(model, key, GEMINI_MODELS.PRIMARY, apiKey !== null);
}

export async function getGeminiModelWithSearch(apiKey = null) {
  const key = resolveApiKey(apiKey);
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODELS.PRIMARY,
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
    tools: [{ googleSearch: {} }],
  });
  return makeModelResilient(model, key, GEMINI_MODELS.PRIMARY, apiKey !== null);
}

export async function uploadVideoToGemini(filePath, mimeType = 'video/mp4', apiKey = null) {
  const key = resolveApiKey(apiKey);
  const fileManager = new GoogleAIFileManager(key);

  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName: filePath.split('/').pop(),
  });

  // Poll until ACTIVE (with safety limit to prevent infinite loop)
  let file = await fileManager.getFile(uploadResult.file.name);
  let pollAttempts = 0;
  const maxPollAttempts = 40; // 40 * 3 seconds = 120 seconds max timeout
  while (file.state === 'PROCESSING') {
    pollAttempts++;
    if (pollAttempts > maxPollAttempts) {
      throw new Error('Timeout: Video processing stuck in PROCESSING state on Gemini server.');
    }
    await new Promise(r => setTimeout(r, 3000));
    file = await fileManager.getFile(uploadResult.file.name);
  }

  if (file.state === 'FAILED') {
    throw new Error('Gagal memproses video di Gemini. Coba lagi.');
  }

  return { fileUri: file.uri, mimeType: file.mimeType };
}

export async function generateWithVideo(fileUri, mimeType, prompt, apiKey = null) {
  const key = resolveApiKey(apiKey);
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
    },
  });

  const resilientModel = makeModelResilient(model, key, 'gemini-3.6-flash', apiKey !== null);
  const result = await resilientModel.generateContent([
    { fileData: { fileUri, mimeType } },
    { text: prompt },
  ]);
  return resilientModel.generateContent ? result.response.text() : result.response.text();
}

export async function testGeminiConnection(apiKey) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const resilientModel = makeModelResilient(model, apiKey, 'gemini-3.6-flash', true);
    const result = await resilientModel.generateContent('Say "Connection successful" in exactly 3 words.');
    const text = result.response.text();
    return { success: true, message: text };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ========================
// Scheduler V4: Multi-Key Pool Executor
// ========================

// In-memory registry for keys that hit 429 RPM/TPM limits (holds them for a short cooldown)
const rateLimitedKeys = new Map(); // keyId -> blockedUntil (timestamp)

/**
 * Execute a Gemini task using the key pool with automatic rotation on 429 errors.
 * @param {number} cost - API call cost (usually 1)
 * @param {function} executorFn - async function(apiKey) that performs the Gemini call
 * @returns {*} Result from executorFn
 * @throws Error if all keys are exhausted or if a non-429 error occurs
 */
export async function executeWithKeyPool(cost, executorFn) {
  const apiTier = getSetting('gemini_api_tier') || 'paid';
  if (apiTier === 'paid') {
    const singleKey = getSetting('gemini_api_key');
    if (!singleKey) {
      throw new Error('Gemini API Key belum dikonfigurasi. Silakan masukkan API Key di halaman Settings.');
    }
    
    let lastError;
    const maxPaidAttempts = 4;
    for (let attempt = 0; attempt < maxPaidAttempts; attempt++) {
      try {
        return await executorFn(singleKey);
      } catch (error) {
        lastError = error;
        const isTemporary = error.status === 503 || 
                            error.status === 429 || 
                            error.message?.includes('503') || 
                            error.message?.includes('429') || 
                            error.message?.toLowerCase().includes('service unavailable') || 
                            error.message?.toLowerCase().includes('high demand') || 
                            error.message?.toLowerCase().includes('exhausted') || 
                            error.message?.toLowerCase().includes('quota') ||
                            error.message?.toLowerCase().includes('resource_exhausted');
        if (isTemporary && attempt < maxPaidAttempts - 1) {
          const delay = Math.pow(2, attempt) * 4000 + Math.random() * 1000;
          console.warn(`[Gemini-Paid] Request failed due to temporary error (503/429). Retrying in ${Math.round(delay/1000)}s (attempt ${attempt + 1}/${maxPaidAttempts})...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  const triedKeyIds = new Set();
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const now = Date.now();
    const excludedIds = [];
    
    // Clean up expired rate limit cooldowns and collect active ones
    for (const [keyId, blockedUntil] of rateLimitedKeys.entries()) {
      if (blockedUntil > now) {
        excludedIds.push(keyId);
      } else {
        rateLimitedKeys.delete(keyId);
      }
    }

    const allExcluded = Array.from(new Set([...excludedIds, ...triedKeyIds]));
    const keyEntry = getAvailableApiKey(cost, allExcluded);

    if (!keyEntry) {
      // If no keys are available in the pool (they are either exhausted in DB or on cooldown),
      // fallback to the single key from settings as a last resort.
      console.warn('[Gemini-KeyPool] No free keys available in pool. Trying fallback settings key...');
      const singleKey = getSetting('gemini_api_key');
      if (singleKey) {
        let lastFallbackErr;
        const maxFallbackAttempts = 4;
        for (let fallbackAttempt = 0; fallbackAttempt < maxFallbackAttempts; fallbackAttempt++) {
          try {
            return await executorFn(singleKey);
          } catch (fallbackError) {
            lastFallbackErr = fallbackError;
            const isTemporary = fallbackError.status === 503 || 
                                fallbackError.status === 429 || 
                                fallbackError.message?.includes('503') || 
                                fallbackError.message?.includes('429') || 
                                fallbackError.message?.toLowerCase().includes('service unavailable') || 
                                fallbackError.message?.toLowerCase().includes('high demand') || 
                                fallbackError.message?.toLowerCase().includes('exhausted') || 
                                fallbackError.message?.toLowerCase().includes('quota') ||
                                fallbackError.message?.toLowerCase().includes('resource_exhausted');
            if (isTemporary && fallbackAttempt < maxFallbackAttempts - 1) {
              const delay = Math.pow(2, fallbackAttempt) * 4000 + Math.random() * 1000;
              console.warn(`[Gemini-KeyPool-Fallback] Fallback key failed (429/503). Retrying in ${Math.round(delay/1000)}s (attempt ${fallbackAttempt + 1}/${maxFallbackAttempts})...`);
              await new Promise(r => setTimeout(r, delay));
              continue;
            }
            throw fallbackError;
          }
        }
        throw lastFallbackErr;
      }
      throw new Error('QUOTA_EXHAUSTED: Semua API Key habis untuk hari ini dan tidak ada fallback key.');
    }

    triedKeyIds.add(keyEntry.id);

    try {
      const result = await executorFn(keyEntry.api_key);
      incrementKeyUsage(keyEntry.id, cost);
      return result;
    } catch (error) {
      const is429 = error.status === 429 || 
                    error.message?.includes('429') || 
                    error.message?.includes('Resource has been exhausted') ||
                    error.message?.includes('Quota exceeded') ||
                    error.message?.includes('RESOURCE_EXHAUSTED');

      const is503 = error.status === 503 ||
                    error.message?.includes('503') ||
                    error.message?.toLowerCase().includes('service unavailable') ||
                    error.message?.toLowerCase().includes('high demand') ||
                    error.message?.toLowerCase().includes('overloaded');

      if (is429 || is503) {
        if (is503) {
          console.warn(`[Gemini-KeyPool] Key ${keyEntry.key_name} still returned 503 after internal retries/fallback. Rotating key...`);
        } else {
          const errorStr = (error.message || '').toLowerCase();
          const isDailyLimit = errorStr.includes('daily') || 
                               errorStr.includes('per day') || 
                               errorStr.includes('requests per day') ||
                               errorStr.includes('rpd') ||
                               errorStr.includes('free_tier') ||                   // Google free tier quota ID
                               errorStr.includes('free tier') ||                   // human-readable variant
                               errorStr.includes('requestsperdayper') ||           // quotaId substring
                               errorStr.includes('generate_content_free_tier');    // Google metric name

          if (isDailyLimit) {
            console.warn(`[Gemini-KeyPool] Key ${keyEntry.key_name} exceeded daily quota. Marking as exhausted in DB.`);
            markKeyExhausted(keyEntry.id);
          } else {
            console.warn(`[Gemini-KeyPool] Key ${keyEntry.key_name} hit temporary rate limit. Placing on 45s cooldown.`);
            rateLimitedKeys.set(keyEntry.id, Date.now() + 45000);
          }
        }
        
        // Continue to the next iteration to rotate keys
        continue;
      }
      
      const isInvalidKey = error.status === 400 || 
                           error.status === 403 || 
                           error.message?.includes('API_KEY_INVALID') || 
                           error.message?.includes('API key not valid') ||
                           error.message?.includes('PERMISSION_DENIED') ||
                           error.message?.toLowerCase().includes('key expired') ||
                           error.message?.toLowerCase().includes('api key revoked');

      if (isInvalidKey) {
        console.warn(`[Gemini-KeyPool] ⚠️ Key ${keyEntry.key_name} (ID: ${keyEntry.id}) terdeteksi MATI/REVOKED oleh Google API. Menonaktifkan key dari pool...`);
        try {
          markApiKeyStatus(keyEntry.id, 'INVALID', 0);
        } catch (e) {}
        continue;
      }

      // For any other error, throw immediately
      throw error;
    }
  }

  throw new Error('QUOTA_EXHAUSTED: Semua API Key yang dicoba dalam pool gagal karena rate limit atau high demand.');
}

/**
 * Call Gemini 2.5 TTS API for text-to-speech.
 * @param {string} text - The input text to read
 * @param {string} voicePersona - The name of the Google prebuilt voice persona
 * @param {object} config - Configuration options (speed, volume)
 * @returns {Buffer} Raw PCM 16-bit linear mono 24kHz audio buffer
 */
export async function callGeminiTtsApi(text, voicePersona, config = {}) {
  return await executeWithKeyPool(1, async (apiKey) => {
    // Incorporate speed & volume instructions via Natural Language Prompting
    let speedDesc = "";
    if (config.speed && Number(config.speed) !== 1.0) {
      speedDesc = `Read this at ${config.speed}x speed. `;
    }
    let volumeDesc = "";
    if (config.volume && Number(config.volume) !== 1.0) {
      volumeDesc = `Read this at ${config.volume}x volume. `;
    }
    const textPrompt = `${speedDesc}${volumeDesc}${text}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          parts: [{ text: textPrompt }]
        }
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voicePersona
            }
          }
        }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini TTS API HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    const inlineData = part?.inlineData;

    if (!inlineData || !inlineData.data) {
      throw new Error('Gemini TTS API returned no audio inlineData. Response: ' + JSON.stringify(result));
    }

    return Buffer.from(inlineData.data, 'base64');
  });
}

/**
 * Creates/refreshes the explicit context cache on Google servers using the stitched Master KB directive.
 */
export async function refreshGeminiContextCache(apiKey = null, modelName = GEMINI_MODELS.PRIMARY) {
  const key = resolveApiKey(apiKey);
  const masterSystemInstruction = getStitchedMasterKB();

  console.log(`[Cache Engine] Mendaftarkan Master KB to Google Server (Paid Tier) for model ${modelName}...`);
  
  try {
    const cacheManager = new GoogleAICacheManager(key);
    const cacheName = `makna_v7_master_cache_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    
    const cache = await cacheManager.create({
      model: modelName,
      displayName: cacheName,
      contents: [
        {
          role: 'user',
          parts: [{ text: masterSystemInstruction }]
        }
      ],
      ttlSeconds: 7200 // 2 Hour TTL
    });

    console.log(`[Cache Engine] Sukses! Cache ID Baru: ${cache.name}`);
    
    // Save to database SQLite settings with model-specific key
    const settingKey = `active_gemini_cache_id_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    setSetting(settingKey, cache.name);
    return cache.name;
  } catch (error) {
    console.error(`[Cache Engine] Gagal membuat cache untuk ${modelName}:`, error.message);
    throw error;
  }
}

/**
 * Splits a full prompt into a static system directive / KBs part and a dynamic inputs / tasks part.
 */
export function splitPromptForCaching(fullPrompt) {
  const splitMarkers = [
    '[INPUT DATA',
    '[INPUT DATA (DARI STAGE 1)]',
    '[INPUT DATA (DARI STAGE 2)]',
    '[INPUT DATA (DARI STAGE 3)]',
    '## THE DECONSTRUCTION',
    '## SPESIFIKASI DAN ATURAN STRUKTUR'
  ];
  
  for (const marker of splitMarkers) {
    const index = fullPrompt.indexOf(marker);
    if (index !== -1) {
      const systemInstruction = fullPrompt.substring(0, index).trim();
      const prompt = fullPrompt.substring(index).trim();
      return { systemInstruction, prompt };
    }
  }
  
  return { systemInstruction: '', prompt: fullPrompt };
}

/**
 * Flexible Gemini API call with key selection and tier-based caching.
 */
async function executeContentGeneration(resolvedKey, params) {
  const { prompt, modelName = GEMINI_MODELS.PRIMARY, videoPayload = null, useSearch = false, timeoutMs: customTimeoutMs = null } = params;
  
  const primaryModel = modelName;
  const fallbackModel = primaryModel === GEMINI_MODELS.PRIMARY 
    ? GEMINI_MODELS.FALLBACK_1 
    : (primaryModel === GEMINI_MODELS.FALLBACK_1 ? GEMINI_MODELS.FALLBACK_2 : null);
  const maxRetries = 4;
  
  let currentModel = primaryModel;
  let attempt = 0;
  
  const callWithTimeout = async (promise, timeoutMs) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Request ke model ${currentModel} timed out (${timeoutMs/1000}s)`)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  };

  const timeoutMs = customTimeoutMs || (videoPayload ? 180000 : 60000);
  
  while (true) {
    const apiTier = getSetting('gemini_api_tier') || 'paid';
    const isCachingEnabled = getSetting('gemini_context_caching') || 'on';

    try {
      const cacheableModels = [GEMINI_MODELS.PRIMARY, GEMINI_MODELS.FALLBACK_1, GEMINI_MODELS.COMPLIANCE];
      const isCacheable = cacheableModels.includes(currentModel);

      // 1. FREE TIER, CACHING DISABLED, or GOOGLE SEARCH REQUIRED, or NON-CACHEABLE MODEL -> Standard API call (no caching)
      if (apiTier === 'free' || isCachingEnabled !== 'on' || useSearch || !isCacheable) {
        console.log(`[Gemini API] Menjalankan standard request menggunakan ${currentModel} ${useSearch ? '(Google Search aktif)' : ''}.`);
        const genAI = new GoogleGenerativeAI(resolvedKey);
        
        const modelOptions = {
          model: currentModel,
          generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: currentModel.includes('1.5') ? 8192 : 65535,
            responseMimeType: useSearch ? undefined : 'application/json',
          },
        };

        if (useSearch) {
          modelOptions.tools = [{ googleSearch: {} }];
        }

        const model = genAI.getGenerativeModel(modelOptions);

        const parts = [];
        if (videoPayload) {
          parts.push({ fileData: videoPayload });
        }
        parts.push({ text: prompt });

        const result = await callWithTimeout(model.generateContent(parts), timeoutMs);
        return result.response.text();
      }

      // 2. PAID TIER & CACHING ENABLED -> Use explicit context caching (stored Directive)
      const settingKey = `active_gemini_cache_id_${currentModel.replace(/[^a-zA-Z0-9]/g, '_')}`;
      let cacheId = getSetting(settingKey);

      // If no cache ID exists, create one synchronously
      if (!cacheId) {
        try {
          console.log(`[Cache Engine] No active cache ID found for ${currentModel}. Creating cache...`);
          cacheId = await refreshGeminiContextCache(resolvedKey, currentModel);
        } catch (err) {
          console.error(`[Cache Engine] Failed to create cache for ${currentModel}:`, err.message);
        }
      }

      const { prompt: dynamicPrompt } = splitPromptForCaching(prompt);

      if (cacheId) {
        try {
          console.log(`[Cache Engine] Executing cached generation using: ${cacheId}`);
          const genAI = new GoogleGenerativeAI(resolvedKey);
          
          // For gemini-2.5-flash / gemini-3.5-flash, cached models must be retrieved via getGenerativeModelFromCachedContent
          const model = genAI.getGenerativeModelFromCachedContent({ name: cacheId });

          const parts = [];
          if (videoPayload) {
            parts.push({ fileData: videoPayload });
          }
          parts.push({ role: 'user', parts: [{ text: dynamicPrompt }] });

          const result = await callWithTimeout(model.generateContent({
            contents: parts,
            generationConfig: {
              temperature: 0.9,
              topP: 0.95,
              topK: 40,
              responseMimeType: 'application/json',
            }
          }), timeoutMs);

          return result.response.text();
        } catch (err) {
          console.warn(`[Cache Engine] Caching request failed for ${currentModel}: ${err.message}. Falling back...`);
          
          // If the cache was not found (expired), trigger a background rebuild
          const errStr = (err.message || '').toUpperCase();
          if (errStr.includes('NOT_FOUND') || errStr.includes('NOT FOUND') || errStr.includes('404')) {
            console.log(`[Cache Engine] Cache expired for ${currentModel}. Triggering background rebuild...`);
            refreshGeminiContextCache(resolvedKey, currentModel).catch(e => console.error(`[Cache Engine] Background rebuild failed for ${currentModel}:`, e.message));
          }
        }
      }

      // Fallback: run standard request (sends full prompt)
      console.log(`[Gemini API] Running standard request fallback using ${currentModel}...`);
      const genAI = new GoogleGenerativeAI(resolvedKey);
      const model = genAI.getGenerativeModel({
        model: currentModel,
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 65535,
          responseMimeType: 'application/json',
        },
      });

      const parts = [];
      if (videoPayload) {
        parts.push({ fileData: videoPayload });
      }
      parts.push({ text: prompt });

      const result = await callWithTimeout(model.generateContent(parts), timeoutMs);
      return result.response.text();
    } catch (error) {
      const is503 = error.status === 503 ||
                    error.message?.includes('503') ||
                    error.message?.toLowerCase().includes('service unavailable') ||
                    error.message?.toLowerCase().includes('high demand') ||
                    error.message?.toLowerCase().includes('overloaded');
      
      if (is503 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 4000 + Math.random() * 1000;
        console.warn(`[Gemini-Retry] ${currentModel} returned 503 (high demand). Retrying same model in ${Math.round(delay/1000)}s (attempt ${attempt + 1}/${maxRetries})...`);
        attempt++;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      
      if (currentModel === primaryModel && fallbackModel) {
        console.warn(`[Gemini-Fallback] ${currentModel} failed (${error.message}). Swapping to fallback model ${fallbackModel}...`);
        currentModel = fallbackModel;
        attempt = 0;
        continue;
      }
      
      throw error;
    }
  }
}

export async function generateContentFlexible(params) {
  const { apiKey } = params;
  if (apiKey) {
    return await executeContentGeneration(apiKey, params);
  }
  return await executeWithKeyPool(1, async (resolvedKey) => {
    return await executeContentGeneration(resolvedKey, params);
  });
}

export async function callGeminiAPI(prompt, apiKey = null) {
  return await generateContentFlexible({ prompt, apiKey });
}

/**
 * Call Gemini 2.5 Flash to generate content with an image reference.
 * @param {Buffer} imageBuffer - The image file buffer.
 * @param {string} mimeType - The mime type of the image (e.g. image/png).
 * @param {string} prompt - The prompt text.
 * @param {Object} responseSchema - Optional JSON schema constraint.
 * @param {string} apiKey - Optional explicit API key.
 * @returns {Promise<string>}
 */
export async function generateWithImage(imageBuffer, mimeType, prompt, responseSchema = null, apiKey = null) {
  return await executeWithKeyPool(1, async (key) => {
    const genAI = new GoogleGenerativeAI(key);
    const modelOptions = {
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        responseMimeType: responseSchema ? 'application/json' : 'text/plain',
      }
    };
    if (responseSchema) {
      modelOptions.generationConfig.responseSchema = responseSchema;
    }
    const model = genAI.getGenerativeModel(modelOptions);
    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType
        }
      },
      { text: prompt }
    ]);
    return result.response.text();
  });
}
