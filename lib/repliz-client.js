import { sanitizeErrorMessage } from './publishing-contract.js';

function redactCredentials(message) {
  if (!message) return '';
  return message
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic ***REDACTED***')
    .replace(/(accessKey|secretKey|Authorization):[^\s&"'`]+/gi, '$1: ***REDACTED***');
}

async function callRepliz(credentials, method, path, body = null) {
  const { apiUrl = 'https://api.repliz.com', accessKey, secretKey } = credentials;
  if (!accessKey || !secretKey) {
    throw new Error('Repliz credentials (access key and secret key) are missing.');
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
    signal: AbortSignal.timeout(10000)
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
      throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
    }

    if (!res.ok) {
      const errMsg = json?.error || json?.message || `HTTP ${res.status} ${res.statusText}`;
      throw new Error(errMsg);
    }

    return json;
  } catch (err) {
    const msg = redactCredentials(err.message || String(err));
    const cleanErr = new Error(`Repliz API Error: ${msg}`);
    if (err.status) cleanErr.status = err.status;
    throw cleanErr;
  }
}

export async function listReplizAccounts(credentials) {
  const result = await callRepliz(credentials, 'GET', '/public/account?page=1&limit=100');
  return Array.isArray(result) ? result : (result?.data || []);
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
