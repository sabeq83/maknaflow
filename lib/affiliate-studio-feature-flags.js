import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

export const AFFILIATE_STUDIO_FLAG_KEY = 'affiliate_studio_enabled';

export function parseAffiliateStudioFlag(value) {
  return String(value).toLowerCase() === 'true';
}

export async function getAffiliateStudioFlags(tenantId = getActiveTenantId()) {
  if (!tenantId || tenantId === '__none__') {
    const err = new Error('Invalid tenant ID');
    err.code = 'INVALID_TENANT_ID';
    err.status = 400;
    throw err;
  }
  const result = await pgQuery(
    `SELECT setting_value FROM tenant_settings
     WHERE tenant_id = $1 AND setting_key = $2`,
    [tenantId, AFFILIATE_STUDIO_FLAG_KEY]
  );
  if (result.rows.length === 0) {
    return { enabled: false };
  }
  const val = result.rows[0].setting_value;
  return { enabled: parseAffiliateStudioFlag(val) };
}

export async function saveAffiliateStudioFlags(input, user) {
  const tenantId = user?.tenantId || getActiveTenantId();
  if (!tenantId || tenantId === '__none__') {
    const err = new Error('Invalid tenant ID');
    err.code = 'INVALID_TENANT_ID';
    err.status = 400;
    throw err;
  }
  if (input === null || typeof input !== 'object' || !('enabled' in input)) {
    const err = new Error('Missing enabled field');
    err.code = 'BAD_REQUEST';
    err.status = 400;
    throw err;
  }
  
  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== 'enabled') {
    const err = new Error('Invalid input shape');
    err.code = 'BAD_REQUEST';
    err.status = 400;
    throw err;
  }
  if (typeof input.enabled !== 'boolean') {
    const err = new Error('enabled must be a boolean');
    err.code = 'BAD_REQUEST';
    err.status = 400;
    throw err;
  }

  const enabledStr = String(input.enabled);
  await pgQuery(
    `INSERT INTO tenant_settings (tenant_id, setting_key, setting_value)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, setting_key)
     DO UPDATE SET setting_value = EXCLUDED.setting_value`,
    [tenantId, AFFILIATE_STUDIO_FLAG_KEY, enabledStr]
  );
  return { enabled: input.enabled };
}
