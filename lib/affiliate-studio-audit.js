import { pgQuery } from './db-pg.js';

export async function recordAffiliateStudioAuditEvent({
  tenantId, actorUserId, eventType, event
}) {
  if (!tenantId || tenantId === '__none__') {
    const err = new Error('Invalid tenant ID for audit');
    err.code = 'INVALID_TENANT_ID';
    err.status = 400;
    throw err;
  }

  const sanitizedEvent = event ? JSON.parse(JSON.stringify(event)) : {};
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object') {
      const sensitiveKeys = ['token', 'cookie', 'session', 'credential', 'password', 'key', 'auth', 'header', 'authorization', 'api_key', 'secret'];
      for (const k of Object.keys(obj)) {
        if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) {
          delete obj[k];
        } else {
          sanitize(obj[k]);
        }
      }
    }
  };
  sanitize(sanitizedEvent);

  return pgQuery(
    `INSERT INTO tenant_audit_events
      (actor_user_id, tenant_id, event_type, event_json)
     VALUES ($1, $2, $3, $4)`,
    [actorUserId, tenantId, eventType, JSON.stringify(sanitizedEvent)]
  );
}
