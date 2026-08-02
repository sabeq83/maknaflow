import assert from 'node:assert/strict';
import {
  hashOperatorRequest,
  normalizeOperatorApproval,
  normalizeOperatorContentRequest
} from '../lib/operator-content-contract.js';
import { authenticateOperator } from '../lib/operator-auth.js';

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
  item_ids: [2, 3]
});

const oldToken = process.env.MAKNA_OPERATOR_API_TOKEN;
const oldTenant = process.env.MAKNA_OPERATOR_TENANT_ID;
process.env.MAKNA_OPERATOR_API_TOKEN = 'operator-test-secret';
process.env.MAKNA_OPERATOR_TENANT_ID = 'tenant_test';
const validRequest = new Request('http://localhost/api/operator/v1/content-jobs', {
  headers: { authorization: 'Bearer operator-test-secret' }
});
assert.deepEqual(authenticateOperator(validRequest), {
  tenantId: 'tenant_test',
  actor: 'operator-api'
});
assert.throws(
  () => authenticateOperator(new Request('http://localhost')),
  error => error.code === 'OPERATOR_UNAUTHORIZED'
);
if (oldToken === undefined) delete process.env.MAKNA_OPERATOR_API_TOKEN;
else process.env.MAKNA_OPERATOR_API_TOKEN = oldToken;
if (oldTenant === undefined) delete process.env.MAKNA_OPERATOR_TENANT_ID;
else process.env.MAKNA_OPERATOR_TENANT_ID = oldTenant;

console.log('Operator content contract and auth tests passed.');
