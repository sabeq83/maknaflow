import { sanitizeErrorMessage } from './publishing-contract.js';

export function redactCredentials(message) {
  if (!message) return '';
  let str = typeof message === 'string' ? message : (message.message || String(message));
  return str
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic ***REDACTED***')
    .replace(/(accessKey|secretKey|Authorization|api_key|token|password|client_secret)=([^\s&"'`]+)/gi, '$1=***REDACTED***')
    .replace(/(accessKey|secretKey|Authorization|api_key|token|password|client_secret):[^\s&"'`]+/gi, '$1: ***REDACTED***')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***REDACTED***');
}

export class ReplizApiError extends Error {
  constructor(message, { status = 500, code = null, logId = null } = {}) {
    super(redactCredentials(message));
    this.name = 'ReplizApiError';
    this.status = status;
    this.code = code;
    this.logId = logId;
  }
}

export function extractReplizScheduleState(response) {
  const schedule = response?.data || response?.schedule || response || {};
  
  // Safe ID resolution
  const id = schedule.id ? String(schedule.id) : (schedule._id ? String(schedule._id) : (schedule.scheduleId ? String(schedule.scheduleId) : null));
  const rawStatus = String(schedule.status || schedule.state || 'unknown').toLowerCase();
  
  // Safe Error Resolution
  const rawError = schedule.errorMessage || schedule.error || schedule.failureReason || schedule.reason || '';
  const errorMessage = rawError ? sanitizeErrorMessage(redactCredentials(rawError)) : '';
  const errorCode = schedule.errorCode || schedule.code || null;
  const providerLogId = schedule.logId || schedule.log_id || schedule.logID || null;
  
  // Safe Post ID
  let postId = schedule.postId || schedule.externalId || schedule.post_id || null;
  if (postId && typeof postId === 'object') {
    if (postId.type === 'schedule') {
      postId = null; // Still in scheduling phase
    } else {
      postId = postId.id || postId.postId || String(postId);
    }
  }

  // Safe Account details
  let account = null;
  if (schedule.account && typeof schedule.account === 'object') {
    account = {
      id: schedule.account.id ? String(schedule.account.id) : (schedule.account._id ? String(schedule.account._id) : null),
      username: String(schedule.account.username || schedule.account.name || ''),
      generatedId: String(schedule.account.generatedId || schedule.account.pageId || ''),
      isConnected: schedule.account.isConnected !== false
    };
  }

  return {
    id,
    status: rawStatus,
    errorMessage,
    errorCode: errorCode ? String(errorCode) : null,
    providerLogId: providerLogId ? String(providerLogId) : null,
    postId: postId ? String(postId) : null,
    permalink: schedule.permalink || schedule.publishedUrl || null,
    account
  };
}

async function callRepliz(credentials, method, path, body = null) {
  const { apiUrl = 'https://api.repliz.com', accessKey, secretKey } = credentials || {};
  if (!accessKey || !secretKey) {
    throw new ReplizApiError('Repliz credentials (access key and secret key) are missing.', { status: 401 });
  }

  const url = `${apiUrl.replace(/\/+$/, '')}${path}`;
  const authHeader = 'Basic ' + Buffer.from(`${accessKey}:${secretKey}`).toString('base64');
  
  const headers = {
    'Authorization': authHeader,
    'Content-Type': 'application/json'
  };

  const options = {
    method,
    headers,
    signal: AbortSignal.timeout(30000)
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (parseErr) {
      throw new ReplizApiError(`Invalid JSON response: ${text.slice(0, 100)}`, { status: res.status });
    }

    if (!res.ok) {
      const errMsg = json?.error || json?.message || json?.errorMessage || `HTTP ${res.status} ${res.statusText}`;
      const errCode = json?.errorCode || json?.code || null;
      const logId = json?.logId || json?.log_id || null;
      throw new ReplizApiError(errMsg, { status: res.status, code: errCode, logId });
    }

    return json;
  } catch (err) {
    if (err instanceof ReplizApiError) throw err;
    const msg = redactCredentials(err.message || String(err));
    throw new ReplizApiError(`Repliz API Error: ${msg}`, { status: err.status || 500, code: err.code || null });
  }
}

export async function listReplizAccounts(credentials) {
  const result = await callRepliz(credentials, 'GET', '/public/account?page=1&limit=100');
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.docs)) return result.docs;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

export async function getReplizAccount(credentials, accountId) {
  const result = await callRepliz(credentials, 'GET', `/public/account/${accountId}`);
  return result?.data || result;
}

export async function createReplizSchedule(credentials, payload) {
  return await callRepliz(credentials, 'POST', '/public/schedule', payload);
}

export async function getReplizSchedule(credentials, scheduleId) {
  return await callRepliz(credentials, 'GET', `/public/schedule/${scheduleId}`);
}

export async function retryReplizSchedule(credentials, scheduleId) {
  return await callRepliz(credentials, 'PUT', `/public/schedule/${scheduleId}/retry`);
}

export async function deleteReplizSchedule(credentials, scheduleId) {
  return await callRepliz(credentials, 'DELETE', `/public/schedule/${scheduleId}`);
}

