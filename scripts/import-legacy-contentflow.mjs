import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadStagingEnv } from './local-staging/env.js';

Object.assign(process.env, loadStagingEnv());
const parsed = {};
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index].startsWith('--')) parsed[process.argv[index].slice(2)] = process.argv[index + 1];
}
const mode = parsed.mode || 'dry-run';
const artifactDir = path.resolve(parsed.artifact || '');
if (!artifactDir || !fs.existsSync(artifactDir)) throw new Error('--artifact directory is required.');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const read = name => fs.readFileSync(path.join(artifactDir, name), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const includedText = read('included.jsonl');
const excludedText = read('excluded.jsonl');
const assetsText = read('assets.json');
if (sha256(includedText) !== manifest.hashes.included_jsonl || sha256(excludedText) !== manifest.hashes.excluded_jsonl || sha256(assetsText) !== manifest.hashes.assets_json) throw new Error('Artifact checksum mismatch.');
const rows = includedText.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
const assets = JSON.parse(assetsText);
const assetById = new Map(assets.map(asset => [String(asset.id), asset]));
if (rows.length !== manifest.counts.included) throw new Error('Included count mismatch.');

const client = new pg.Client();
await client.connect();
const canonicalFields = ['source_type','source_campaign_id','source_item_id','account_name','video_id','campaign_title','hook','nama_produk','link_affiliate','link_produk','caption','production_date','drive_link','nextcloud_url','pipeline_status','tiktok_status','tiktok_publish_date','permalink_tiktok','facebook_status','facebook_publish_date','permalink_facebook','instagram_status','instagram_publish_date','permalink_instagram','youtube_status','youtube_publish_date','permalink_youtube','catatan'];
const canonicalHash = row => sha256(JSON.stringify(Object.fromEntries(canonicalFields.map(field => [field, row[field] ?? null]))));

async function buildDryRun() {
  const brands = (await client.query("SELECT LOWER(brand_name) name FROM brand_profiles WHERE tenant_id='default_tenant'")).rows.map(row => row.name);
  const missingBrands = manifest.include_accounts.filter(account => !brands.includes(account));
  if (missingBrands.length) throw new Error(`Missing target brand profiles: ${missingBrands.join(', ')}`);
  const targetRows = (await client.query("SELECT * FROM content_flow_items WHERE tenant_id='default_tenant'")).rows;
  const byId = new Map(targetRows.map(row => [String(row.id), row]));
  const byVideo = new Map(targetRows.map(row => [String(row.video_id), row]));
  const bySource = new Map(targetRows.filter(row => row.source_campaign_id || row.source_item_id).map(row => [[row.source_type,row.source_campaign_id,row.source_item_id].join('|'), row]));
  const ready = [], identical = [], conflicts = [];
  for (const row of rows) {
    const collision = byId.get(String(row.id)) || byVideo.get(String(row.video_id)) || bySource.get([row.source_type,row.source_campaign_id,row.source_item_id].join('|'));
    if (!collision) ready.push(row.id);
    else if (canonicalHash(row) === canonicalHash(collision)) identical.push({ legacy_id: row.id, target_id: collision.id });
    else conflicts.push({ legacy_id: row.id, target_id: collision.id, reason: byId.has(String(row.id)) ? 'id' : byVideo.has(String(row.video_id)) ? 'video_id' : 'source_tuple', legacy_hash: canonicalHash(row), target_hash: canonicalHash(collision) });
  }
  const report = { schema_version: 1, batch_id: manifest.batch_id, artifact_hash: manifest.hashes.included_jsonl, generated_at: new Date().toISOString(), counts: { included: rows.length, ready: ready.length, skip_identical: identical.length, conflict_divergent: conflicts.length, excluded: manifest.counts.excluded }, ready_ids: ready, identical, conflicts };
  const reportText = `${JSON.stringify(report, null, 2)}\n`;
  report.report_hash = sha256(reportText);
  fs.writeFileSync(path.join(artifactDir, 'dry-run.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function commit(report) {
  if (!parsed['approve-hash'] || parsed['approve-hash'] !== report.report_hash) throw new Error('--approve-hash must match dry-run report_hash.');
  if (report.conflicts.length) throw new Error(`${report.conflicts.length} divergent collision(s) require review.`);
  const ready = new Set(report.ready_ids.map(String));
  const fields = ['id', ...canonicalFields, 'created_at', 'updated_at'];
  await client.query('BEGIN');
  try {
    let inserted = 0;
    for (const row of rows) {
      if (!ready.has(String(row.id))) continue;
      const asset = assetById.get(String(row.id)) || { status: 'no_asset', legacy_url_asset: row.url_asset || '' };
      let urlAsset = null;
      if (asset.status === 'copied') urlAsset = asset.target_url;
      else if (asset.status === 'remote_ok') urlAsset = asset.legacy_url_asset;
      const values = fields.map(field => row[field] ?? null);
      values.push(urlAsset, 'default_tenant', 'makna_grid_node1', manifest.batch_id, row.id, asset.legacy_url_asset || null, asset.status);
      const columns = [...fields, 'url_asset', 'tenant_id', 'migration_source', 'migration_batch_id', 'legacy_id', 'legacy_url_asset', 'asset_migration_status'];
      const placeholders = values.map((_, index) => `$${index + 1}`);
      const result = await client.query(`INSERT INTO content_flow_items (${columns.join(',')}) VALUES (${placeholders.join(',')}) ON CONFLICT DO NOTHING RETURNING id`, values);
      if (result.rowCount !== 1) throw new Error(`Unexpected commit collision for ${row.id}`);
      inserted += 1;
    }
    if (inserted !== report.counts.ready) throw new Error(`Inserted ${inserted}; expected ${report.counts.ready}.`);
    await client.query('COMMIT');
    return { inserted };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

try {
  if (mode === 'dry-run') console.log(JSON.stringify(await buildDryRun(), null, 2));
  else if (mode === 'commit') {
    const report = JSON.parse(read('dry-run.json'));
    if (report.artifact_hash !== manifest.hashes.included_jsonl) throw new Error('Dry-run artifact hash is stale.');
    console.log(JSON.stringify({ batch_id: manifest.batch_id, ...(await commit(report)) }, null, 2));
  } else if (mode === 'rollback') {
    if (parsed.confirm !== manifest.batch_id) throw new Error('--confirm must equal migration batch id.');
    const result = await client.query("DELETE FROM content_flow_items WHERE tenant_id='default_tenant' AND migration_source='makna_grid_node1' AND migration_batch_id=$1 RETURNING id", [manifest.batch_id]);
    console.log(JSON.stringify({ batch_id: manifest.batch_id, deleted: result.rowCount }, null, 2));
  } else throw new Error(`Unsupported mode: ${mode}`);
} finally {
  await client.end();
}
