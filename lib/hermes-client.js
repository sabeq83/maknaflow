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

export async function createHermesRun(config, payload, idempotencyKey) {
  if (!config.baseUrl.startsWith('http://') && !config.baseUrl.startsWith('https://')) {
    throw new Error(`Hermes base URL tidak valid atau tidak diizinkan: ${config.baseUrl}`);
  }

  const url = `${config.baseUrl}/v1/runs`;
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
      const errBody = await res.text().catch(() => '');
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
  const url = `${config.baseUrl}/v1/runs/${runId}`;
  const headers = getHermesHeaders(config);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 30000);

  try {
    const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Hermes get run HTTP ${res.status}: ${errBody}`);
    }

    return await res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function stopHermesRun(config, runId) {
  const url = `${config.baseUrl}/v1/runs/${runId}/stop`;
  const headers = getHermesHeaders(config);

  const res = await fetch(url, { method: 'POST', headers });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Hermes stop run HTTP ${res.status}: ${errBody}`);
  }
  return await res.json();
}

export async function getHermesReadiness(config) {
  const url = `${config.baseUrl}/health/detailed`;
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
