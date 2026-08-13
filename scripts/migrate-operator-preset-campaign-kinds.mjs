import { pgQuery, getPgPool } from '../lib/db-pg.js';
import { resolvePresetCampaignKinds } from '../lib/operator-presets.js';

const apply = process.argv.includes('--apply');
const rows = (await pgQuery("SELECT tenant_id,setting_value FROM tenant_settings WHERE setting_key='operator_presets_json' ORDER BY tenant_id")).rows;
const report = [];
for (const row of rows) {
  let presets = {};
  try { presets = JSON.parse(row.setting_value || '{}'); } catch { report.push({ tenant: row.tenant_id, key: '[invalid-json]', action: 'blocked' }); continue; }
  let changed = false;
  for (const [key, preset] of Object.entries(presets)) {
    if (Array.isArray(preset.campaign_kinds)) continue;
    const resolved = resolvePresetCampaignKinds({ key, label: preset.label, config: preset });
    report.push({ tenant: row.tenant_id, key, kinds: resolved.kinds.join(','), reason: resolved.reason, action: apply ? 'migrated' : 'would-migrate' });
    if (apply) { presets[key] = { ...preset, campaign_kinds: resolved.kinds, revision: Number(preset.revision || 0) + 1 }; changed = true; }
  }
  if (changed) await pgQuery(`UPDATE tenant_settings SET setting_value=$1 WHERE tenant_id=$2 AND setting_key='operator_presets_json'`, [JSON.stringify(presets), row.tenant_id]);
}
console.table(report);
await getPgPool().end();
