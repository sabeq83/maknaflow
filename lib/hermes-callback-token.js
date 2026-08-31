import crypto from 'crypto';

function signingSecret() {
  const secret = process.env.MAKNA_HERMES_CALLBACK_SIGNING_SECRET || '';
  if (secret.length < 32) throw new Error('MAKNA_HERMES_CALLBACK_SIGNING_SECRET wajib minimal 32 karakter.');
  return secret;
}

export function createHermesCallbackToken({ taskId, runId, tenantId, expiresInSeconds = 7200 }) {
  const payload = Buffer.from(JSON.stringify({
    aud: 'makna-hermes-research-callback',
    task_id: taskId,
    run_id: runId,
    tenant_id: tenantId,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyHermesCallbackToken(token, expectedTaskId) {
  const [payload, suppliedSignature] = String(token || '').split('.');
  if (!payload || !suppliedSignature) throw Object.assign(new Error('Callback token tidak valid.'), { status: 401 });
  const expectedSignature = crypto.createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  const left = Buffer.from(suppliedSignature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw Object.assign(new Error('Callback token tidak valid.'), { status: 401 });
  }
  let claims;
  try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch { throw Object.assign(new Error('Callback token tidak valid.'), { status: 401 }); }
  if (claims.aud !== 'makna-hermes-research-callback' || claims.task_id !== expectedTaskId) {
    throw Object.assign(new Error('Callback token audience/task tidak sesuai.'), { status: 403 });
  }
  if (!Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) {
    throw Object.assign(new Error('Callback token kedaluwarsa.'), { status: 401 });
  }
  return claims;
}
