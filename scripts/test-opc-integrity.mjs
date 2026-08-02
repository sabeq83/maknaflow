import assert from 'node:assert/strict';
import { loadStagingEnv } from './local-staging/env.js';

Object.assign(process.env, loadStagingEnv());
const { pgQuery, withPgTransaction, closePgPool } = await import('../lib/db-pg.js');
const { getDemographicLabel, getVisualOverrideLabel, parseVisualOverrides } = await import('../lib/campaign-config-labels.js');

const campaignId = 'opc_260802_zr0a5x';
const before = await pgQuery('SELECT COUNT(*)::int AS count FROM pillar_campaign_items WHERE campaign_id = $1', [campaignId]);
let insertedId;
await assert.rejects(
  withPgTransaction(async () => {
    const inserted = await pgQuery(`
      INSERT INTO pillar_campaign_items (campaign_id, row_creative_payload, generation_status)
      VALUES ($1, $2, 'pending') RETURNING id
    `, [campaignId, JSON.stringify({ regression_test: true })]);
    insertedId = inserted.rows[0].id;
    throw new Error('EXPECTED_ROLLBACK');
  }),
  /EXPECTED_ROLLBACK/
);
const after = await pgQuery('SELECT COUNT(*)::int AS count FROM pillar_campaign_items WHERE campaign_id = $1', [campaignId]);
assert.equal(after.rows[0].count, before.rows[0].count, 'transaction rollback harus menghapus item uji');
const leaked = await pgQuery('SELECT id FROM pillar_campaign_items WHERE id = $1', [insertedId]);
assert.equal(leaked.rowCount, 0, 'ID item uji tidak boleh tersisa');

const campaign = (await pgQuery(`
  SELECT account_name, brand_profile_id, target_demographic, visual_overrides_json
  FROM pillar_campaigns WHERE id = $1
`, [campaignId])).rows[0];
assert.ok(campaign.brand_profile_id, 'brand_profile_id wajib terisi');
assert.equal(campaign.account_name, 'nutribake');
assert.equal(getDemographicLabel(campaign.target_demographic), 'Ibu Rumah Tangga & Keluarga (Ramah / Mengayomi)');
const vso = parseVisualOverrides(campaign.visual_overrides_json);
assert.equal(getVisualOverrideLabel('subject', vso.subject_demographic), "Wanita Gamis Syar'i");
assert.equal(process.env.ENABLE_CAMPAIGN_SCHEDULER, 'true');
assert.equal(process.env.ENABLE_SCHEDULER_WORKER, 'true');

console.log(JSON.stringify({ success: true, rollback_verified: true, item_sequence_verified: true, campaign_config_verified: true }, null, 2));
await closePgPool();
