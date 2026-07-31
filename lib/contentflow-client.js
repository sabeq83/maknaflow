import { getSetting } from './db.js';

const DEFAULT_CONTENTFLOW_URL = 'http://100.78.186.123:3001/api/v1/content/ingest';

/**
 * Retrieves Content Flow API Key from settings DB or environment variable
 */
export function getContentFlowApiKey() {
  const keyFromDb = getSetting('contentflow_api_key');
  if (keyFromDb && keyFromDb.trim()) {
    return keyFromDb.trim();
  }
  return process.env.CONTENTFLOW_API_KEY || '';
}

/**
 * Retrieves Content Flow API Endpoint URL from settings DB or environment variable
 */
export function getContentFlowApiUrl() {
  const urlFromDb = getSetting('contentflow_api_url');
  if (urlFromDb && urlFromDb.trim()) {
    return urlFromDb.trim();
  }
  return process.env.CONTENTFLOW_API_URL || DEFAULT_CONTENTFLOW_URL;
}

/**
 * Sends a single object or an array of objects to Content Flow Ingestion API
 * @param {Object|Array} payload - Ingestion data payload
 * @param {Object} options - Optional overrides (apiKey, apiUrl)
 */
export async function sendToContentFlow(payload, options = {}) {
  const apiKey = options.apiKey || getContentFlowApiKey();
  const apiUrl = options.apiUrl || getContentFlowApiUrl();

  if (!payload || (Array.isArray(payload) && payload.length === 0)) {
    throw new Error('Payload data kosong, tidak ada data untuk dikirim ke Content Flow.');
  }

  // 1. Jika API Key dikonfigurasi: Gunakan HTTP REST API Sync
  if (apiKey) {
    console.log(`[ContentFlowClient] Sending ingestion request via HTTP to ${apiUrl}...`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = responseData?.message || responseData?.error || `HTTP ${response.status} ${response.statusText}`;
      console.error('[ContentFlowClient Error]', errorMsg, responseData);
      throw new Error(`Content Flow API Error (${response.status}): ${errorMsg}`);
    }

    console.log('[ContentFlowClient Success]', responseData);

    return {
      success: true,
      status: response.status,
      data: responseData,
      processed_count: responseData?.processed_count || (Array.isArray(payload) ? payload.length : 1),
    };
  }

  // 2. Mode Satu Atap (Zero-Config Internal Direct Sync):
  // Jika API Key tidak ada, langsung simpan ke database lokal tanpa error/warning
  try {
    const { upsertContentFlowItem } = await import('./db.js');
    const items = Array.isArray(payload) ? payload : [payload];
    let count = 0;
    for (const item of items) {
      upsertContentFlowItem(item);
      count++;
    }
    console.log(`✅ [ContentFlow Sync] Integrated ${count} item(s) via Internal Direct Sync (Satu Atap).`);
    return {
      success: true,
      status: 200,
      mode: 'internal_direct_sync',
      processed_count: count,
    };
  } catch (err) {
    console.error('[ContentFlow Direct Sync Error]:', err.message);
    throw new Error(`Direct ContentFlow Ingest Error: ${err.message}`);
  }
}

/**
 * Test API connection with a lightweight check payload or ping
 */
export async function testContentFlowConnection(apiKeyOverride, apiUrlOverride) {
  const apiKey = apiKeyOverride || getContentFlowApiKey();
  const apiUrl = apiUrlOverride || getContentFlowApiUrl();

  if (!apiKey) {
    return { success: false, error: 'API Key belum diisi.' };
  }

  try {
    const testPayload = {
      account_name: 'TEST_CONNECTION',
      video_id: `VID-TEST-${Date.now()}`,
      hook: 'Test Connection Check from MAKNA Generator',
      nama_produk: 'MAKNA Test Item',
      pipeline_status: 'Pending Production',
      production_date: new Date().toISOString().split('T')[0]
    };

    const res = await sendToContentFlow(testPayload, { apiKey, apiUrl });
    return {
      success: true,
      message: 'Koneksi ke Content Flow API Berhasil!',
      details: res.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
