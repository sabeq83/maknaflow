import { structuredLog } from './structured-logger.js';

function getHermesHeaders(config) {
  return {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

function sanitizeConfig(config) {
  return { ...config, apiKey: '***REDACTED***' };
}

function validateHermesBaseUrl(config) {
  let url;
  try { url = new URL(config.baseUrl); }
  catch { throw new Error('Hermes base URL tidak valid.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Hermes base URL tidak valid atau tidak diizinkan.');
  const explicit = String(process.env.HERMES_ALLOWED_HOSTS || '').split(',').map(value => value.trim()).filter(Boolean);
  const local = ['127.0.0.1', 'localhost', '::1'];
  const tailscale = /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(url.hostname);
  if (![...local, ...explicit].includes(url.hostname) && !tailscale) {
    throw new Error(`Hermes host tidak diizinkan: ${url.hostname}`);
  }
  if (!config.apiKey || config.apiKey === 'test-key') throw new Error('Hermes API key belum dikonfigurasi.');
  return url.origin;
}

async function boundedErrorBody(res) {
  const text = await res.text().catch(() => '');
  return text.replace(/Bearer\s+[^\s"']+/gi, 'Bearer ***REDACTED***').slice(0, 500);
}

export async function createHermesRun(config, payload, idempotencyKey) {
  const url = `${validateHermesBaseUrl(config)}/v1/runs`;
  const headers = getHermesHeaders(config);
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  structuredLog('info', 'hermes_client_create_run', { url, config: sanitizeConfig(config), idempotencyKey });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 30000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errBody = await boundedErrorBody(res);
      throw new Error(`Hermes create run HTTP ${res.status}: ${errBody}`);
    }

    return await res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    structuredLog('error', 'hermes_client_create_run_failed', { error: error.message });
    throw error;
  }
}

export async function getHermesRun(config, runId) {
  const url = `${validateHermesBaseUrl(config)}/v1/runs/${encodeURIComponent(runId)}`;
  const headers = getHermesHeaders(config);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 30000);

  try {
    const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errBody = await boundedErrorBody(res);
      throw new Error(`Hermes get run HTTP ${res.status}: ${errBody}`);
    }

    return await res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function stopHermesRun(config, runId) {
  const url = `${validateHermesBaseUrl(config)}/v1/runs/${encodeURIComponent(runId)}/stop`;
  const headers = getHermesHeaders(config);

  const res = await fetch(url, { method: 'POST', headers });
  if (!res.ok) {
    const errBody = await boundedErrorBody(res);
    throw new Error(`Hermes stop run HTTP ${res.status}: ${errBody}`);
  }
  return await res.json();
}

export async function getHermesReadiness(config) {
  const url = `${validateHermesBaseUrl(config)}/health/detailed`;
  try {
    const res = await fetch(url, { method: 'GET', headers: getHermesHeaders(config) });
    return res.ok;
  } catch {
    return false;
  }
}
