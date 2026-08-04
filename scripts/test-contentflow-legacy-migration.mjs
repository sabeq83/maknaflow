import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { execFileSync } from 'node:child_process';
import { loadStagingEnv } from './local-staging/env.js';

Object.assign(process.env, loadStagingEnv());
const { tenantContext } = await import('../lib/tenant-context.js');
const { deleteContentFlowItem, getContentFlowItem, listContentFlowItems, updateContentFlowItem, upsertContentFlowItem } = await import('../lib/contentflow-repository.js');
const { getPgPool } = await import('../lib/db-pg.js');
getPgPool();
const client = new pg.Client();
await client.connect();
const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const tenantA = `cf_test_a_${suffix}`;
const tenantB = `cf_test_b_${suffix}`;
const idA = `cf_test_${suffix}`;
const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'contentflow-migration-test-'));
const importerPath = path.resolve('scripts/import-legacy-contentflow.mjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function writeArtifact(directory, batchId, rows) {
  fs.mkdirSync(directory, { recursive: true });
  const included = `${rows.map(row => JSON.stringify(row)).join('\n')}\n`;
  const excluded = '\n';
  const assets = `${JSON.stringify(rows.map(row => ({ id: row.id, legacy_url_asset: '', status: 'no_asset' })), null, 2)}\n`;
  fs.writeFileSync(path.join(directory, 'included.jsonl'), included);
  fs.writeFileSync(path.join(directory, 'excluded.jsonl'), excluded);
  fs.writeFileSync(path.join(directory, 'assets.json'), assets);
  fs.writeFileSync(path.join(directory, 'manifest.json'), `${JSON.stringify({
    schema_version: 1,
    batch_id: batchId,
    tenant_id: 'default_tenant',
    include_accounts: [],
    counts: { source_total: rows.length, included: rows.length, excluded: 0 },
    hashes: { included_jsonl: hash(included), excluded_jsonl: hash(excluded), assets_json: hash(assets) }
  }, null, 2)}\n`);
}

function runImporter(artifact, mode, extra = []) {
  return execFileSync(process.execPath, [importerPath, '--mode', mode, '--artifact', artifact, ...extra], { cwd: process.cwd(), encoding: 'utf8' });
}
try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const schema = await client.query("SELECT COUNT(*)::int count FROM information_schema.columns WHERE table_name='content_flow_items' AND column_name='tenant_id'");
    if (schema.rows[0].count === 1) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const inserted = await tenantContext.run(tenantA, () => upsertContentFlowItem({ id: idA, source_type: 'opc', account_name: 'Umum', video_id: `VID-${suffix}`, campaign_title: 'Tenant A' }));
  assert.equal(inserted.tenant_id, tenantA);
  assert.equal(inserted.account_name, 'umum');
  assert.equal((await tenantContext.run(tenantA, () => listContentFlowItems({}))).total_items, 1);
  assert.equal((await tenantContext.run(tenantB, () => listContentFlowItems({}))).total_items, 0);
  assert.equal(await tenantContext.run(tenantB, () => getContentFlowItem(idA)), null);
  assert.equal(await tenantContext.run(tenantB, () => updateContentFlowItem(idA, { catatan: 'blocked' })), null);
  assert.equal(await tenantContext.run(tenantB, () => deleteContentFlowItem(idA)), null);
  const updated = await tenantContext.run(tenantA, () => updateContentFlowItem(idA, { catatan: 'allowed', tiktok_status: 'Published' }));
  assert.equal(updated.catatan, 'allowed');
  assert.equal(updated.tiktok_status, 'Published');

  const collisionId = `cf_collision_${suffix}`;
  await client.query("INSERT INTO content_flow_items(id,source_type,account_name,video_id,campaign_title,tenant_id) VALUES($1,'opc','umum',$2,'Target wins','default_tenant')", [collisionId, `VID-COLLISION-${suffix}`]);
  const collisionArtifact = path.join(artifactRoot, 'collision');
  writeArtifact(collisionArtifact, `batch_collision_${suffix}`, [{ id: collisionId, source_type: 'opc', account_name: 'umum', video_id: `VID-COLLISION-${suffix}`, campaign_title: 'Legacy differs' }]);
  const collisionReport = JSON.parse(runImporter(collisionArtifact, 'dry-run'));
  assert.equal(collisionReport.counts.conflict_divergent, 1);
  assert.throws(() => runImporter(collisionArtifact, 'commit', ['--approve-hash', collisionReport.report_hash]));
  const skippedCollision = JSON.parse(runImporter(collisionArtifact, 'commit', ['--approve-hash', collisionReport.report_hash, '--allow-skip-conflicts', 'true']));
  assert.equal(skippedCollision.inserted, 0);
  assert.equal(skippedCollision.skipped_divergent, 1);
  assert.equal((await client.query('SELECT campaign_title FROM content_flow_items WHERE id=$1', [collisionId])).rows[0].campaign_title, 'Target wins');

  const readyId = `cf_ready_${suffix}`;
  const readyBatch = `batch_ready_${suffix}`;
  const readyArtifact = path.join(artifactRoot, 'ready');
  writeArtifact(readyArtifact, readyBatch, [{ id: readyId, source_type: 're', account_name: 'umum', video_id: `VID-READY-${suffix}`, campaign_title: 'Ready legacy', tiktok_status: 'Published', permalink_tiktok: 'https://example.test/published' }]);
  const readyReport = JSON.parse(runImporter(readyArtifact, 'dry-run'));
  assert.equal(readyReport.counts.ready, 1);
  const committed = JSON.parse(runImporter(readyArtifact, 'commit', ['--approve-hash', readyReport.report_hash]));
  assert.equal(committed.inserted, 1);
  const preserved = (await client.query('SELECT tiktok_status,permalink_tiktok,migration_batch_id FROM content_flow_items WHERE id=$1', [readyId])).rows[0];
  assert.equal(preserved.tiktok_status, 'Published');
  assert.equal(preserved.permalink_tiktok, 'https://example.test/published');
  assert.equal(preserved.migration_batch_id, readyBatch);
  const rolledBack = JSON.parse(runImporter(readyArtifact, 'rollback', ['--confirm', readyBatch]));
  assert.equal(rolledBack.deleted, 1);
  assert.equal(Number((await client.query('SELECT COUNT(*) count FROM content_flow_items WHERE id=$1', [readyId])).rows[0].count), 0);

  const tampered = fs.readFileSync(path.join(readyArtifact, 'included.jsonl'), 'utf8');
  fs.writeFileSync(path.join(readyArtifact, 'included.jsonl'), `${tampered} `);
  assert.throws(() => runImporter(readyArtifact, 'dry-run'));
  console.log('ContentFlow migration regression test passed: tenant, collision, manifest, commit, publish preservation, and rollback.');
} finally {
  await client.query('DELETE FROM content_flow_items WHERE id IN ($1,$2,$3)', [idA, `cf_collision_${suffix}`, `cf_ready_${suffix}`]).catch(() => {});
  await client.end();
  fs.rmSync(artifactRoot, { recursive: true, force: true });
}
