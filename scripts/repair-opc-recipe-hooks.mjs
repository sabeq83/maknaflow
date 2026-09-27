import pg from 'pg';

const args = process.argv.slice(2);
const valueOf = flag => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const campaignId = valueOf('--campaign');
const confirmation = valueOf('--confirm-campaign');
const schema = valueOf('--schema') || process.env.PG_SEARCH_PATH || 'staging';
const apply = args.includes('--apply');

if (!campaignId || !/^opc_[a-z0-9_]+$/i.test(campaignId)) {
  throw new Error('Gunakan --campaign <opc_id> dengan ID kampanye yang valid.');
}
if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`Schema tidak valid: ${schema}`);
if (apply && confirmation !== campaignId) {
  throw new Error(`Apply wajib memakai --confirm-campaign ${campaignId}.`);
}
for (const key of ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE']) {
  if (!process.env[key]) throw new Error(`${key} wajib tersedia di environment.`);
}

const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  options: `-c search_path=${schema}`
});

const parseJson = (value, fallback) => {
  try { return typeof value === 'string' ? JSON.parse(value) : value ?? fallback; }
  catch { return fallback; }
};

function repairItem(item) {
  const payload = parseJson(item.row_creative_payload, {});
  const expectedHook = String(payload.hook || payload.custom_hook || '').trim();
  if (!expectedHook) throw new Error(`Item ${item.id} tidak memiliki hook pada row_creative_payload.`);

  const result = parseJson(item.result_json, {});
  const storyboard = Array.isArray(result.storyboard) ? result.storyboard : [];
  const scenes = Array.isArray(result.scenes) ? result.scenes : [];
  const plan = parseJson(item.new_video_plan_json, []);
  if (!storyboard[0] || !scenes[0] || !Array.isArray(plan) || !plan[0]) {
    throw new Error(`Item ${item.id} tidak memiliki representasi klip pertama yang lengkap.`);
  }

  const before = {
    storyboard: storyboard[0].voice_over || '',
    scenes: scenes[0].voice_over || '',
    plan: plan[0].new_vo || ''
  };
  storyboard[0] = { ...storyboard[0], scene_function: 'hook', voice_over: expectedHook };
  scenes[0] = { ...scenes[0], scene_function: 'hook', voice_over: expectedHook };
  plan[0] = { ...plan[0], new_vo: expectedHook };
  const changed = Object.values(before).some(value => value !== expectedHook);

  return {
    id: item.id,
    expectedHook,
    before,
    changed,
    resultJson: JSON.stringify({ ...result, storyboard, scenes }),
    newVideoPlanJson: JSON.stringify(plan)
  };
}

await client.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`repair-recipe-hooks:${campaignId}`]);
  const campaign = (await client.query(
    `SELECT id,source_planner_id,status FROM pillar_campaigns WHERE id=$1 ${apply ? 'FOR UPDATE' : ''}`,
    [campaignId]
  )).rows[0];
  if (!campaign) throw new Error('Campaign tidak ditemukan.');
  if (!campaign.source_planner_id) throw new Error('Campaign tidak memiliki source_planner_id.');
  const planner = (await client.query(
    'SELECT id,planner_focus FROM content_planners WHERE id=$1',
    [campaign.source_planner_id]
  )).rows[0];
  if (planner?.planner_focus !== 'recipe_campaign') {
    throw new Error(`Planner focus harus recipe_campaign, diterima ${planner?.planner_focus || 'missing'}.`);
  }

  const items = (await client.query(
    `SELECT id,row_creative_payload,result_json,new_video_plan_json
     FROM pillar_campaign_items WHERE campaign_id=$1 ORDER BY id ${apply ? 'FOR UPDATE' : ''}`,
    [campaignId]
  )).rows;
  if (!items.length) throw new Error('Campaign tidak memiliki item.');

  const repairs = items.map(repairItem);
  if (apply) {
    for (const repair of repairs.filter(entry => entry.changed)) {
      await client.query(
        'UPDATE pillar_campaign_items SET result_json=$2,new_video_plan_json=$3 WHERE id=$1',
        [repair.id, repair.resultJson, repair.newVideoPlanJson]
      );
    }
    await client.query('COMMIT');
  } else {
    await client.query('ROLLBACK');
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    schema,
    campaign_id: campaign.id,
    source_planner_id: campaign.source_planner_id,
    campaign_status: campaign.status,
    item_count: repairs.length,
    changed_count: repairs.filter(entry => entry.changed).length,
    unchanged_count: repairs.filter(entry => !entry.changed).length,
    items: repairs.map(entry => ({
      id: String(entry.id),
      changed: entry.changed,
      expected_hook: entry.expectedHook,
      previous_storyboard_vo: entry.before.storyboard
    }))
  }, null, 2));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({ success: false, message: error.message }, null, 2));
  process.exitCode = 1;
} finally {
  await client.end();
}
