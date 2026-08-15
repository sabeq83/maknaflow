import crypto from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';

const EXPECTED = Object.freeze({
  campaignId: 'opc_260815_ir4y96',
  plannerId: 'pln_65839439',
  tenantId: 'default_tenant',
  oldProductId: '292f7423-9096-45b8-bf74-07273d02171a',
  newProductId: 'pe_sync_1781148697786_165',
  brandProfileId: 'df382ce8-2145-4464-ae63-79375ff3aff2',
  expectedItemCount: 12,
  targetClipIndex: 3
});

const args = process.argv.slice(2);
const valueOf = flag => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const apply = args.includes('--apply');
const confirmation = valueOf('--confirm-campaign');
const schema = valueOf('--schema') || process.env.PG_SEARCH_PATH || 'public';
const campaignId = valueOf('--campaign') || EXPECTED.campaignId;

if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`Schema tidak valid: ${schema}`);
if (campaignId !== EXPECTED.campaignId) throw new Error(`Script hanya diizinkan untuk ${EXPECTED.campaignId}.`);
if (apply && confirmation !== EXPECTED.campaignId) {
  throw new Error(`Apply wajib memakai --confirm-campaign ${EXPECTED.campaignId}.`);
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
const assetId = () => `pcia_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
const bindingId = () => crypto.randomUUID();

function promptForClip(item, clipIndex) {
  const plan = parseJson(item.new_video_plan_json, []);
  const clips = Array.isArray(plan) ? plan : (plan?.clips || plan?.scenes || []);
  const clip = clips.find(entry => Number(entry.clip_index ?? entry.clipIndex ?? entry.index) === clipIndex) || clips[clipIndex - 1] || {};
  return clip.t2i_prompt || clip.image_prompt || clip.visual_prompt || clip.prompt || `Create canonical start frame for clip ${clipIndex}.`;
}

function withReferencePath(payloadValue, referencePath) {
  const payload = parseJson(payloadValue, {});
  return JSON.stringify({ ...payload, product_ref_image_path: referencePath });
}

await client.connect();
try {
  const campaign = (await client.query('SELECT * FROM pillar_campaigns WHERE id=$1', [campaignId])).rows[0];
  if (!campaign) throw new Error('Campaign target tidak ditemukan.');
  const planner = (await client.query('SELECT * FROM content_planners WHERE id=$1', [EXPECTED.plannerId])).rows[0];
  const oldProduct = (await client.query('SELECT id,tenant_id,product_name FROM product_extractions WHERE id=$1', [EXPECTED.oldProductId])).rows[0];
  const newProduct = (await client.query('SELECT * FROM product_extractions WHERE id=$1 AND tenant_id=$2', [EXPECTED.newProductId, EXPECTED.tenantId])).rows[0];
  const brandProduct = (await client.query(`SELECT * FROM brand_products
    WHERE tenant_id=$1 AND brand_profile_id=$2 AND product_id=$3 AND is_active=TRUE`,
  [EXPECTED.tenantId, EXPECTED.brandProfileId, EXPECTED.newProductId])).rows[0];
  const items = (await client.query('SELECT * FROM pillar_campaign_items WHERE campaign_id=$1 ORDER BY id', [campaignId])).rows;

  if (campaign.tenant_id !== EXPECTED.tenantId) throw new Error(`Tenant campaign mismatch: ${campaign.tenant_id}`);
  if (campaign.source_planner_id !== EXPECTED.plannerId) throw new Error(`Planner campaign mismatch: ${campaign.source_planner_id}`);
  if (planner?.tenant_id !== EXPECTED.tenantId || planner?.product_id !== EXPECTED.newProductId) throw new Error('Lineage planner tidak sesuai expected target.');
  if (!oldProduct || oldProduct.tenant_id === EXPECTED.tenantId) throw new Error('Expected old product lintas tenant tidak terkonfirmasi.');
  if (!newProduct) throw new Error('Produk pengganti tenant default tidak ditemukan.');
  if (!brandProduct) throw new Error('Brand-product binding aktif tidak ditemukan.');
  if (items.length !== EXPECTED.expectedItemCount) throw new Error(`Item count mismatch ${items.length}/${EXPECTED.expectedItemCount}.`);
  if (apply && campaign.target_product_id !== EXPECTED.oldProductId) {
    throw new Error(`Expected-old mismatch; target saat ini ${campaign.target_product_id}. Apply dibatalkan.`);
  }
  if (!apply && ![EXPECTED.oldProductId, EXPECTED.newProductId].includes(campaign.target_product_id)) {
    throw new Error(`Target product tidak dikenal: ${campaign.target_product_id}`);
  }

  const referencePath = newProduct.clean_photo_url || newProduct.cleaned_photo_url || newProduct.photo_url || newProduct.generated_photo_url;
  if (!referencePath) throw new Error('Produk pengganti tidak mempunyai reference path.');
  const localReference = referencePath.startsWith('/') ? `public${referencePath}` : referencePath;
  if (!fs.existsSync(localReference)) throw new Error(`File reference tidak ditemukan: ${localReference}`);

  const beforeAssets = (await client.query(`SELECT campaign_item_id,clip_index,revision,status,checksum,local_path
    FROM pillar_campaign_item_assets WHERE tenant_id=$1 AND campaign_id=$2 AND asset_type='start_frame'
    ORDER BY campaign_item_id,revision,clip_index`, [EXPECTED.tenantId, campaignId])).rows;
  const before = {
    mode: apply ? 'apply' : 'dry-run', schema, campaign_id: campaignId,
    campaign_status: campaign.status, old_product_id: campaign.target_product_id,
    new_product_id: EXPECTED.newProductId, reference_path: referencePath,
    item_ids: items.map(item => String(item.id)), item_count: items.length,
    current_binding_count: Number((await client.query(`SELECT COUNT(*)::int AS count FROM campaign_product_bindings
      WHERE tenant_id=$1 AND source_type='opc' AND source_campaign_id=$2`, [EXPECTED.tenantId, campaignId])).rows[0].count),
    current_asset_count: beforeAssets.length,
    target_clip: EXPECTED.targetClipIndex
  };
  console.log(JSON.stringify(before, null, 2));
  if (!apply) process.exitCode = 0;
  else {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`repair:${campaignId}`]);
    const locked = (await client.query('SELECT target_product_id FROM pillar_campaigns WHERE id=$1 FOR UPDATE', [campaignId])).rows[0];
    if (locked.target_product_id !== EXPECTED.oldProductId) throw new Error('Campaign berubah setelah preflight; repair dibatalkan.');
    await client.query(`UPDATE pillar_campaigns SET status='paused',target_product_id=$2,product_ref_image_path=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [campaignId, EXPECTED.newProductId, referencePath]);

    for (const item of items) {
      const itemId = String(item.id);
      const nextRevision = Number(item.start_frame_revision || 0) + 1;
      await client.query('UPDATE pillar_campaign_items SET row_creative_payload=$2 WHERE id=$1',
        [item.id, withReferencePath(item.row_creative_payload, referencePath)]);
      await client.query(`INSERT INTO campaign_product_bindings
        (id,tenant_id,source_type,source_campaign_id,source_item_id,brand_profile_id,brand_product_id,product_id,
         product_name_snapshot,product_url_snapshot,affiliate_link_snapshot,tracking_code_snapshot,affiliate_source,affiliate_status,resolved_at,created_at)
        VALUES($1,$2,'opc',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT(tenant_id,source_type,source_campaign_id,(COALESCE(source_item_id,''))) DO UPDATE SET
          brand_profile_id=EXCLUDED.brand_profile_id,brand_product_id=EXCLUDED.brand_product_id,product_id=EXCLUDED.product_id,
          product_name_snapshot=EXCLUDED.product_name_snapshot,product_url_snapshot=EXCLUDED.product_url_snapshot,
          affiliate_link_snapshot=EXCLUDED.affiliate_link_snapshot,tracking_code_snapshot=EXCLUDED.tracking_code_snapshot,
          affiliate_source=EXCLUDED.affiliate_source,affiliate_status=EXCLUDED.affiliate_status,resolved_at=CURRENT_TIMESTAMP`,
      [bindingId(), EXPECTED.tenantId, campaignId, itemId, EXPECTED.brandProfileId, brandProduct.id, EXPECTED.newProductId,
        newProduct.product_name, brandProduct.landing_page_url || newProduct.product_url || newProduct.source_url || null,
        brandProduct.affiliate_link || null, brandProduct.tracking_code || null,
        brandProduct.affiliate_link ? 'brand_product' : 'product', brandProduct.affiliate_link ? 'resolved' : 'missing']);

      await client.query(`INSERT INTO pillar_campaign_item_assets
        (id,tenant_id,campaign_id,campaign_item_id,clip_index,asset_type,revision,status,attempt_count,local_path,checksum,completed_at)
        SELECT 'pcia_' || substr(md5(random()::text || clock_timestamp()::text || clip_index::text),1,16),
          tenant_id,campaign_id,campaign_item_id,clip_index,asset_type,$1,'completed',0,local_path,checksum,CURRENT_TIMESTAMP
        FROM (SELECT DISTINCT ON (clip_index) * FROM pillar_campaign_item_assets
          WHERE tenant_id=$2 AND campaign_item_id=$3 AND asset_type='start_frame' AND status='completed' AND clip_index<>$4
          ORDER BY clip_index,revision DESC) previous
        ON CONFLICT(tenant_id,campaign_item_id,clip_index,asset_type,revision) DO NOTHING`,
      [nextRevision, EXPECTED.tenantId, itemId, EXPECTED.targetClipIndex]);
      const context = {
        campaignId,
        itemId,
        clipIndex: EXPECTED.targetClipIndex,
        prompt: promptForClip(item, EXPECTED.targetClipIndex),
        origin: 'campaign_data_repair'
      };
      await client.query(`INSERT INTO pillar_campaign_item_assets
        (id,tenant_id,campaign_id,campaign_item_id,clip_index,asset_type,revision,status,attempt_count,request_json)
        VALUES($1,$2,$3,$4,$5,'start_frame',$6,'queued',0,$7::jsonb)`,
      [assetId(), EXPECTED.tenantId, campaignId, itemId, EXPECTED.targetClipIndex, nextRevision, JSON.stringify({ context })]);
      const paths = parseJson(item.t2i_images_json, []);
      while (paths.length < Number(campaign.target_clips_count || 4)) paths.push(null);
      paths[EXPECTED.targetClipIndex - 1] = null;
      const carried = Math.max(0, Number(campaign.target_clips_count || 4) - 1);
      await client.query(`UPDATE pillar_campaign_items SET t2i_images_json=$2,start_frame_revision=$3,start_frame_status='processing',
        start_frame_expected_count=$4,start_frame_completed_count=$5,workflow_status='start_frames_processing',
        regenerate_start_frames_status='queued',regenerate_start_frames_progress=$6,review_state='draft',review_state_updated_at=CURRENT_TIMESTAMP
        WHERE id=$1`, [item.id, JSON.stringify(paths), nextRevision, Number(campaign.target_clips_count || 4), carried, `${carried}/${Number(campaign.target_clips_count || 4)}`]);
    }
    await client.query('COMMIT');
    const bindings = Number((await client.query(`SELECT COUNT(*)::int AS count FROM campaign_product_bindings
      WHERE tenant_id=$1 AND source_type='opc' AND source_campaign_id=$2 AND product_id=$3`,
    [EXPECTED.tenantId, campaignId, EXPECTED.newProductId])).rows[0].count);
    const queued = Number((await client.query(`SELECT COUNT(*)::int AS count FROM pillar_campaign_item_assets
      WHERE tenant_id=$1 AND campaign_id=$2 AND clip_index=$3 AND status='queued' AND request_json->'context'->>'origin'='campaign_data_repair'`,
    [EXPECTED.tenantId, campaignId, EXPECTED.targetClipIndex])).rows[0].count);
    console.log(JSON.stringify({ success: true, campaign_id: campaignId, status: 'paused', product_id: EXPECTED.newProductId, bindings, queued_clip_3: queued }, null, 2));
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({ success: false, code: error.code || 'REPAIR_FAILED', message: error.message }, null, 2));
  process.exitCode = 1;
} finally {
  await client.end();
}
