import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  normalizeContentRunRequest,
  hashContentRunRequest,
  CONTENT_RUN_ERROR_CODES,
  ALLOWED_PRODUCT_CAMPAIGN_COUNTS,
  ContentRunError,
  assertHermesRunOnceEnabled
} from '../lib/content-run-contract.js';
import {
  hydrateOperatorPresetCache,
  isOperatorPresetCompatible,
  resolveOperatorPreset
} from '../lib/operator-presets.js';
import { tenantContext } from '../lib/tenant-context.js';

test('Run-once contract validates product campaign video counts (6, 12, 18, 24, 30)', () => {
  for (const count of ALLOWED_PRODUCT_CAMPAIGN_COUNTS) {
    const req = normalizeContentRunRequest({
      brand_profile_id: 'bp_dapur',
      product_id: 'pe_rolled_oat',
      preset_key: 'dapurbotani_kampanye_produk_4_klip',
      video_count: count
    });
    assert.equal(req.video_count, count);
  }

  assert.throws(() => {
    normalizeContentRunRequest({
      brand_profile_id: 'bp_dapur',
      product_id: 'pe_rolled_oat',
      preset_key: 'dapurbotani_kampanye_produk_4_klip',
      video_count: 5
    });
  }, (err) => err.code === CONTENT_RUN_ERROR_CODES.VIDEO_COUNT_INVALID);

  assert.throws(() => {
    normalizeContentRunRequest({
      brand_profile_id: 'bp_dapur',
      product_id: 'pe_rolled_oat',
      preset_key: 'dapurbotani_kampanye_produk_4_klip',
      video_count: 31
    });
  }, (err) => err.code === CONTENT_RUN_ERROR_CODES.VIDEO_COUNT_INVALID);
});

test('Run-once contract validates mandatory identifiers', () => {
  assert.throws(() => {
    normalizeContentRunRequest({
      product_id: 'pe_rolled_oat',
      preset_key: 'dapurbotani_kampanye_produk_4_klip'
    });
  }, (err) => err.code === CONTENT_RUN_ERROR_CODES.BRAND_NOT_FOUND);

  assert.throws(() => {
    normalizeContentRunRequest({
      brand_profile_id: 'bp_dapur',
      preset_key: 'dapurbotani_kampanye_produk_4_klip'
    });
  }, (err) => err.code === CONTENT_RUN_ERROR_CODES.PRODUCT_NOT_FOUND);

  assert.throws(() => {
    normalizeContentRunRequest({
      brand_profile_id: 'bp_dapur',
      product_id: 'pe_rolled_oat'
    });
  }, (err) => err.code === CONTENT_RUN_ERROR_CODES.PRESET_NOT_FOUND);
});

test('Run-once contract produces canonical and deterministic SHA-256 hash', () => {
  const req1 = normalizeContentRunRequest({
    name: 'Rolled Oat One Time',
    brand_profile_id: 'bp_dapur',
    product_id: 'pe_rolled_oat',
    preset_key: 'dapurbotani_kampanye_produk_4_klip',
    video_count: 6,
    research: { query: 'Tren Oat 2026' }
  });

  const req2 = normalizeContentRunRequest({
    name: 'Rolled Oat One Time',
    brand_profile_id: 'bp_dapur',
    product_id: 'pe_rolled_oat',
    preset_key: 'dapurbotani_kampanye_produk_4_klip',
    video_count: 6,
    research: { query: 'Tren Oat 2026' }
  });

  const hash1 = hashContentRunRequest(req1);
  const hash2 = hashContentRunRequest(req2);
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64);

  const reqDifferent = normalizeContentRunRequest({
    ...req1,
    video_count: 12
  });
  const hashDifferent = hashContentRunRequest(reqDifferent);
  assert.notEqual(hash1, hashDifferent);
});

test('Run-once draft_only mode defaults safely without publishing target requirements', () => {
  const req = normalizeContentRunRequest({
    brand_profile_id: 'bp_dapur',
    product_id: 'pe_rolled_oat',
    preset_key: 'dapurbotani_kampanye_produk_4_klip',
    video_count: 6,
    publishing_policy: { mode: 'draft_only' }
  });
  assert.equal(req.publishing_policy.mode, 'draft_only');
  assert.deepEqual(req.publishing_policy.account_ids, []);
});

test('Feature flag fail-closed logic function tests real production helper', () => {
  assert.throws(() => assertHermesRunOnceEnabled({}), (err) => err.code === CONTENT_RUN_ERROR_CODES.RUN_ONCE_DISABLED);
  assert.throws(() => assertHermesRunOnceEnabled({ ENABLE_HERMES_RUN_ONCE: '' }), (err) => err.code === CONTENT_RUN_ERROR_CODES.RUN_ONCE_DISABLED);
  assert.throws(() => assertHermesRunOnceEnabled({ ENABLE_HERMES_RUN_ONCE: 'false' }), (err) => err.code === CONTENT_RUN_ERROR_CODES.RUN_ONCE_DISABLED);
  assert.throws(() => assertHermesRunOnceEnabled({ ENABLE_HERMES_RUN_ONCE: '1' }), (err) => err.code === CONTENT_RUN_ERROR_CODES.RUN_ONCE_DISABLED);
  assert.doesNotThrow(() => assertHermesRunOnceEnabled({ ENABLE_HERMES_RUN_ONCE: 'true' }));
});

test('Preset compatibility validation for Product Campaign vs Brand Editorial', () => {
  const testTenant = 'test_preset_tenant';
  hydrateOperatorPresetCache(testTenant, {
    dapurbotani_kampanye_produk_4_klip: {
      label: 'Dapur Botani 4 Klip',
      campaign_kinds: ['product_campaign'],
      product_bridging: { is_bridging_active: true }
    }
  });

  const productPreset = tenantContext.run(testTenant, () =>
    resolveOperatorPreset('dapurbotani_kampanye_produk_4_klip')
  );
  assert.ok(
    isOperatorPresetCompatible(productPreset, 'product_campaign'),
    'dapurbotani_kampanye_produk_4_klip should be compatible with product_campaign'
  );

  const editorialPreset = resolveOperatorPreset('nutribake_editorial_v1');
  assert.equal(
    isOperatorPresetCompatible(editorialPreset, 'product_campaign'),
    false,
    'Editorial preset should not be compatible with product_campaign'
  );
});

test('Hermes skill SKILL.md adheres to fail-fast rules, minimal scopes, and contains no port 7020 or DB inspection', () => {
  const skillContent = fs.readFileSync(
    new URL('../plugins/makna-hermes/skills/makna-content-orchestrator/SKILL.md', import.meta.url),
    'utf8'
  );

  assert.match(skillContent, /5020/);
  assert.doesNotMatch(skillContent, /127\.0\.0\.1:7020/);
  assert.doesNotMatch(skillContent, /localhost:7020/);
  assert.match(skillContent, /Dilarang Keras Discovery Ilegal/i);
  assert.match(skillContent, /30 Detik/i);
  assert.match(skillContent, /RUN_ONCE_UNAVAILABLE/);
  assert.match(skillContent, /automation:read/);
  assert.match(skillContent, /automation:write/);
});

test('Hermes API reference documents content-runs and content-catalog', () => {
  const apiDoc = fs.readFileSync(
    new URL('../plugins/makna-hermes/skills/makna-content-orchestrator/references/operator-api.md', import.meta.url),
    'utf8'
  );

  assert.match(apiDoc, /\/api\/operator\/v2\/content-runs/);
  assert.match(apiDoc, /\/api\/operator\/v2\/content-catalog/);
  assert.match(apiDoc, /5020/);
  assert.match(apiDoc, /RUN_ONCE_DISABLED/);
  assert.match(apiDoc, /IDEMPOTENCY_CONFLICT/);
});
