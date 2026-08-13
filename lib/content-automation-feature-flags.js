import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

export const PRODUCT_CAMPAIGN_FLAG_KEYS = Object.freeze({
  enabled: 'content_automation_product_campaign_enabled',
  pilotEnabled: 'content_automation_product_campaign_pilot_enabled'
});

const asBoolean = value => String(value).toLowerCase() === 'true';

export class ProductCampaignFeatureDisabledError extends Error {
  constructor(execution = false) {
    super(execution ? 'Eksekusi Product Campaign dinonaktifkan untuk tenant ini.' : 'Pembuatan Product Campaign dinonaktifkan untuk tenant ini.');
    this.name = 'ProductCampaignFeatureDisabledError';
    this.code = execution ? 'PRODUCT_CAMPAIGN_PILOT_DISABLED' : 'PRODUCT_CAMPAIGN_DISABLED';
    this.status = 403;
  }
}

export async function getProductCampaignFlags(tenantId = getActiveTenantId()) {
  const result = await pgQuery(
    `SELECT setting_key, setting_value FROM tenant_settings
     WHERE tenant_id=$1 AND setting_key=ANY($2::text[])`,
    [tenantId, Object.values(PRODUCT_CAMPAIGN_FLAG_KEYS)]
  );
  const values = Object.fromEntries(result.rows.map(row => [row.setting_key, row.setting_value]));
  return {
    enabled: asBoolean(values[PRODUCT_CAMPAIGN_FLAG_KEYS.enabled]),
    pilotEnabled: asBoolean(values[PRODUCT_CAMPAIGN_FLAG_KEYS.pilotEnabled])
  };
}

export async function saveProductCampaignFlags(input, user) {
  const tenantId = user.tenantId || getActiveTenantId();
  const current = await getProductCampaignFlags(tenantId);
  const next = {
    enabled: input.enabled === undefined ? current.enabled : Boolean(input.enabled),
    pilotEnabled: input.pilotEnabled === undefined ? current.pilotEnabled : Boolean(input.pilotEnabled)
  };
  for (const [name, key] of Object.entries(PRODUCT_CAMPAIGN_FLAG_KEYS)) {
    await pgQuery(
      `INSERT INTO tenant_settings(tenant_id,setting_key,setting_value) VALUES($1,$2,$3)
       ON CONFLICT(tenant_id,setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value`,
      [tenantId, key, String(next[name])]
    );
  }
  return next;
}

export async function assertProductCampaignEnabled({ execution = false, tenantId } = {}) {
  const flags = await getProductCampaignFlags(tenantId);
  if (!flags.enabled || (execution && !flags.pilotEnabled)) throw new ProductCampaignFeatureDisabledError(execution);
  return flags;
}
