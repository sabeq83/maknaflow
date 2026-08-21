import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import {
  hashOperatorRequest,
  normalizeOperatorApproval,
  normalizeOperatorContentRequest
} from '../lib/operator-content-contract.js';
import { resolveWardrobe } from '../lib/visual-override-resolver.js';
import { loadStagingEnv } from './local-staging/env.js';

const nutribakeRequest = {
  planner: {
    planner_focus: 'brand_editorial',
    title: 'Nutribake Editorial Agustus 2026',
    account_name: 'Nutribake',
    brand_context: 'Healthy food education, baking, dan sistem makan praktis.',
    content_goal: 'Membangun authority, saves, dan shares.',
    target_audience: 'Keluarga muda urban usia 25-44 tahun.',
    pillars: [
      'Healthy Breakfast',
      'Meal Prep System',
      'Healthy Baking',
      'Healthy Ingredients',
      'Smart Kitchen',
      'Healthy Snacks',
      'Healthy Lifestyle Hacks'
    ],
    planner_count: 7,
    platform: 'tiktok'
  },
  selection: { mode: 'all' },
  production: {
    approval_mode: 'storyboard',
    enable_tts: true,
    enable_glabs: true,
    enable_ffmpeg: true,
    enable_social_post: false,
    nextcloud_parent_folder: '/MAKNA_Assets/Nutribake'
  }
};

const normalized = normalizeOperatorContentRequest(nutribakeRequest);
assert.equal(normalized.planner.planner_count, 7);
assert.equal(normalized.production.scheduler_pause_at, 'tts');
assert.equal(normalized.production.approval_mode, 'creative');
assert.equal(normalized.production.enable_social_post, false);
assert.equal(normalized.selection.mode, 'all');
assert.equal(
  hashOperatorRequest({ b: 2, a: { d: 4, c: 3 } }),
  hashOperatorRequest({ a: { c: 3, d: 4 }, b: 2 })
);
assert.throws(
  () => normalizeOperatorContentRequest({ ...nutribakeRequest, planner: { ...nutribakeRequest.planner, planner_count: 31 } }),
  /1 sampai 30/
);
assert.throws(
  () => normalizeOperatorContentRequest({ ...nutribakeRequest, production: { enable_social_post: true } }),
  /belum mengizinkan social posting/
);
assert.deepEqual(normalizeOperatorApproval({ item_ids: [2, 2, 3] }), {
  mode: 'approve_unchanged',
  item_ids: [2, 3],
  review_revision: null,
  review_sha256: null
});

const v2 = normalizeOperatorContentRequest({
  planner: nutribakeRequest.planner,
  selection: { mode: 'all' },
  opc: {
    preset: 'nutribake_editorial_v1',
    visual_engine: { target_clips_count: 3 },
    workflow: { approval_mode: 'storyboard' }
  }
});
assert.equal(v2.contract_version, '2');
assert.equal(v2.production.target_demographic, 'ibu_rumah_tangga');
assert.equal(v2.production.target_clips_count, 3);
assert.equal(v2.production.approval_mode, 'creative');
assert.equal(JSON.parse(v2.production.visual_overrides_json).wardrobe_style, 'sequential');
assert.throws(() => normalizeOperatorContentRequest({
  planner: nutribakeRequest.planner,
  opc: { visual_engine: { video_model: 'veo_31_lite', clip_duration: 10 } }
}), /hanya tersedia untuk omni_flash/);

const sequenceA = resolveWardrobe({ mode: 'sequential', subjectDemographic: 'syari_classic', itemIndex: 0 });
const sequenceB = resolveWardrobe({ mode: 'sequential', subjectDemographic: 'syari_classic', itemIndex: 1 });
assert.notEqual(sequenceA.key, sequenceB.key);
const randomA = resolveWardrobe({ mode: 'random', subjectDemographic: 'syari_classic', stableSeed: 'campaign:item' });
const randomRetry = resolveWardrobe({ mode: 'random', subjectDemographic: 'syari_classic', stableSeed: 'campaign:item' });
assert.deepEqual(randomA, randomRetry);

const oldToken = process.env.MAKNA_OPERATOR_API_TOKEN;
const oldTenant = process.env.MAKNA_OPERATOR_TENANT_ID;
Object.assign(process.env, loadStagingEnv());
const { authenticateOperator } = await import('../lib/operator-auth.js');
process.env.MAKNA_OPERATOR_API_TOKEN = 'operator-test-secret';
process.env.MAKNA_OPERATOR_TENANT_ID = 'tenant_test';
const validRequest = new Request('http://localhost/api/operator/v1/content-jobs', {
  headers: { authorization: 'Bearer operator-test-secret' }
});
assert.deepEqual(await authenticateOperator(validRequest), {
  tenantId: 'tenant_test',
  actor: 'operator-api-legacy',
  name: 'Legacy Environment Credential',
  scopes: ['content:create', 'content:read', 'content:approve']
});
await assert.rejects(
  () => authenticateOperator(new Request('http://localhost')),
  error => error.code === 'OPERATOR_UNAUTHORIZED'
);

const credentialToken = `credential-${crypto.randomUUID()}`;
const credentialTenant = `test_operator_${Date.now().toString(36)}`;
const credentialId = `opc_test_${Date.now().toString(36)}`;
const client = new pg.Client({ host: process.env.PGHOST, port: Number(process.env.PGPORT), user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE, options: `-c search_path=${process.env.PG_SEARCH_PATH || 'public'}` });
await client.connect();
try {
  await client.query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Operator Test', $1)", [credentialTenant]);
  await client.query(`INSERT INTO operator_credentials (id, tenant_id, name, token_hash, scopes) VALUES ($1, $2, 'Test Credential', $3, 'content:read')`, [credentialId, credentialTenant, crypto.createHash('sha256').update(credentialToken).digest('hex')]);
  const databaseIdentity = await authenticateOperator(new Request('http://localhost', { headers: { authorization: `Bearer ${credentialToken}` } }), 'content:read');
  assert.equal(databaseIdentity.tenantId, credentialTenant);
  assert.deepEqual(databaseIdentity.scopes, ['content:read']);
  await assert.rejects(() => authenticateOperator(new Request('http://localhost', { headers: { authorization: `Bearer ${credentialToken}` } }), 'content:create'), error => error.code === 'OPERATOR_SCOPE_FORBIDDEN');
} finally {
  await client.query('DELETE FROM operator_credentials WHERE id = $1', [credentialId]);
  await client.query('DELETE FROM tenants WHERE id = $1', [credentialTenant]);
  await client.end();
}
if (oldToken === undefined) delete process.env.MAKNA_OPERATOR_API_TOKEN;
else process.env.MAKNA_OPERATOR_API_TOKEN = oldToken;
if (oldTenant === undefined) delete process.env.MAKNA_OPERATOR_TENANT_ID;
else process.env.MAKNA_OPERATOR_TENANT_ID = oldTenant;

console.log('Operator content contract and auth tests passed.');
