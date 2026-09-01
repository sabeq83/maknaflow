import { structuredLog } from './structured-logger.js';

export async function performHermesAuthPreflight(config = {}) {
  const baseUrl = (config.baseUrl || process.env.MAKNA_OPERATOR_BASE_URL || 'http://127.0.0.1:5020').replace(/\/+$/, '');
  const token = config.token || process.env.MAKNA_OPERATOR_API_TOKEN || '';
  const maxRetries = Math.max(1, Math.min(5, Number(config.maxRetries || 3)));
  const timeoutMs = Math.max(1000, Number(config.timeoutMs || 5000));
  const fetchImpl = config.fetch || globalThis.fetch;

  if (!token) {
    structuredLog('error', 'MAKNA_OPERATOR_AUTH_INVALID', {
      reason: 'MISSING_TOKEN',
      status: 401,
      target_url: `${baseUrl}/api/operator/v2/whoami`
    });
    return {
      status: 'invalid',
      code: 401,
      error: 'Token otentikasi Hermes kosong atau belum dikonfigurasi.'
    };
  }

  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(`${baseUrl}/api/operator/v2/whoami`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timer);

      if (response.status === 200) {
        let body;
        try {
          body = await response.json();
        } catch (_) {
          structuredLog('error', 'MAKNA_OPERATOR_AUTH_INVALID', {
            reason: 'MALFORMED_JSON_RESPONSE',
            status: 200
          });
          return { status: 'invalid', code: 500, error: 'Respons whoami bukan format JSON yang valid.' };
        }

        const operator = body?.operator || {};
        const scopes = Array.isArray(operator.scopes) ? operator.scopes : [];
        const hasRead = scopes.includes('automation:read');
        const hasWrite = scopes.includes('automation:write');

        if (!hasRead || !hasWrite) {
          structuredLog('error', 'MAKNA_OPERATOR_AUTH_INVALID', {
            reason: 'INSUFFICIENT_SCOPES',
            status: 403,
            operator_id: operator.id,
            scopes
          });
          return {
            status: 'invalid',
            code: 403,
            error: `Scope tidak memadai. Diperlukan: automation:read & automation:write. Diberikan: ${scopes.join(',')}`
          };
        }

        structuredLog('info', 'MAKNA_OPERATOR_AUTH_READY', {
          operator_id: operator.id,
          tenant_id: operator.tenant_id,
          scopes
        });

        return {
          status: 'ready',
          code: 200,
          operator: {
            id: operator.id,
            tenantId: operator.tenant_id,
            scopes
          }
        };
      }

      if (response.status === 401 || response.status === 403) {
        structuredLog('error', 'MAKNA_OPERATOR_AUTH_INVALID', {
          status: response.status,
          target_url: `${baseUrl}/api/operator/v2/whoami`
        });
        return {
          status: 'invalid',
          code: response.status,
          error: `Otentikasi operator ditolak dengan status HTTP ${response.status}.`
        };
      }

      // 5xx or unexpected status -> retry with backoff
      lastError = new Error(`HTTP_${response.status}`);
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('aborted');
      lastError = isTimeout ? new Error('TIMEOUT') : err;
    }

    if (attempt < maxRetries) {
      const backoffMs = Math.min(5000, 500 * Math.pow(2, attempt - 1));
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }

  structuredLog('error', 'MAKNA_OPERATOR_UNAVAILABLE', {
    attempts: attempt,
    last_error: lastError?.message || 'UNKNOWN_ERROR',
    target_url: `${baseUrl}/api/operator/v2/whoami`
  });

  return {
    status: 'unavailable',
    code: 503,
    error: `MAKNA Operator Server tidak dapat dihubungi (${lastError?.message || 'TIMEOUT'}).`
  };
}
