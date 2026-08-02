import pg from 'pg';
import { loadStagingEnv } from './local-staging/env.js';

const args = new Map(process.argv.slice(2).map((value, index, all) => value.startsWith('--') ? [value, all[index + 1]?.startsWith('--') ? true : all[index + 1]] : [null, null]).filter(([key]) => key));
const campaignId = args.get('--campaign');
const plannerId = args.get('--planner');
const apply = args.has('--apply');

if (!campaignId || !plannerId) {
  console.error('Usage: node scripts/repair-opc-campaign.mjs --campaign <id> --planner <id> [--apply]');
  process.exit(1);
}

const env = loadStagingEnv();
const client = new pg.Client({
  host: env.PGHOST, port: Number(env.PGPORT), user: env.PGUSER,
  password: env.PGPASSWORD, database: env.PGDATABASE
});

await client.connect();
try {
  const campaign = (await client.query('SELECT * FROM pillar_campaigns WHERE id = $1', [campaignId])).rows[0];
  const planner = (await client.query('SELECT * FROM content_planners WHERE id = $1', [plannerId])).rows[0];
  const rows = (await client.query('SELECT * FROM content_planner_rows WHERE planner_id = $1 ORDER BY sequence ASC', [plannerId])).rows;
  const itemCount = Number((await client.query('SELECT COUNT(*) AS count FROM pillar_campaign_items WHERE campaign_id = $1', [campaignId])).rows[0].count);
  if (!campaign) throw new Error(`Campaign ${campaignId} tidak ditemukan`);
  if (!planner || rows.length === 0) throw new Error(`Planner ${plannerId} atau rows tidak ditemukan`);
  if (itemCount !== 0) throw new Error(`Repair aman hanya untuk campaign tanpa item; ditemukan ${itemCount}`);

  const brand = (await client.query(`
    SELECT id, brand_name FROM brand_profiles
    WHERE tenant_id = $1 AND LOWER(brand_name) = LOWER($2) LIMIT 1
  `, [campaign.tenant_id, planner.account_name || ''])).rows[0];
  const summary = {
    mode: apply ? 'apply' : 'dry-run', campaign_id: campaignId, planner_id: plannerId,
    expected_items: rows.length, current_items: itemCount,
    brand_profile_id: brand?.id || campaign.brand_profile_id || null,
    account_name: brand?.brand_name || planner.account_name || campaign.account_name || null,
    target_demographic: campaign.target_demographic || 'ibu_rumah_tangga',
    is_bridging_active: planner.planner_focus === 'brand_editorial' ? 0 : campaign.is_bridging_active
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) process.exit(0);

  await client.query('BEGIN');
  await client.query('CREATE SEQUENCE IF NOT EXISTS pillar_campaign_items_id_seq');
  await client.query("ALTER TABLE pillar_campaign_items ALTER COLUMN id SET DEFAULT nextval('pillar_campaign_items_id_seq')");
  await client.query("SELECT setval('pillar_campaign_items_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM pillar_campaign_items), 0) + 1, 1), false)");
  await client.query('ALTER TABLE pillar_campaigns ADD COLUMN IF NOT EXISTS account_name TEXT');
  await client.query('ALTER TABLE pillar_campaigns ADD COLUMN IF NOT EXISTS source_planner_id TEXT');
  await client.query(`
    UPDATE pillar_campaigns SET brand_profile_id = $2, account_name = $3,
      source_planner_id = $4, target_demographic = COALESCE(target_demographic, $5), is_bridging_active = $6
    WHERE id = $1
  `, [campaignId, summary.brand_profile_id, summary.account_name, plannerId, summary.target_demographic, summary.is_bridging_active]);

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const payload = {
      row_number: index + 1,
      content_pillar: row.pillar || '', custom_hook: row.hook || '',
      visual_action_guideline: row.visual_action || '', content_subject: row.content_subject || row.context || '',
      product_name: row.product_reference || '', source_product_url: '', product_image_url: '',
      product_desc: '', product_usp: '', product_ref_image_path: null,
      visual_mode: campaign.visual_mode || 'hybrid_lock', generation_status: 'pending',
      narrative_mode: campaign.narrative_mode || 'Storytelling'
    };
    await client.query(`
      INSERT INTO pillar_campaign_items (campaign_id, row_creative_payload, generation_status)
      VALUES ($1, $2, 'pending')
    `, [campaignId, JSON.stringify(payload)]);
  }
  const repairedCount = Number((await client.query('SELECT COUNT(*) AS count FROM pillar_campaign_items WHERE campaign_id = $1', [campaignId])).rows[0].count);
  if (repairedCount !== rows.length) throw new Error(`Item count mismatch ${repairedCount}/${rows.length}`);
  await client.query('COMMIT');
  console.log(JSON.stringify({ success: true, campaign_id: campaignId, created_items: repairedCount }, null, 2));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
