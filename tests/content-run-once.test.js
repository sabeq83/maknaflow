import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  normalizeContentRunRequest,
  hashContentRunRequest,
  CONTENT_RUN_ERROR_CODES,
  ALLOWED_PRODUCT_CAMPAIGN_COUNTS
} from '../lib/content-run-contract.js';

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

test('Hermes skill SKILL.md adheres to fail-fast rules and contains no port 7020 or DB inspection', () => {
  const skillContent = fs.readFileSync(
    new URL('../plugins/makna-hermes/skills/makna-content-orchestrator/SKILL.md', import.meta.url),
    'utf8'
  );

  // Must reference 5020 in references / docs
  assert.match(skillContent, /5020/);
  // Must NOT reference 7020 as base URL
  assert.doesNotMatch(skillContent, /127\.0\.0\.1:7020/);
  assert.doesNotMatch(skillContent, /localhost:7020/);

  // Must contain fail-fast and prohibited discovery rules
  assert.match(skillContent, /Dilarang Keras Discovery Ilegal/i);
  assert.match(skillContent, /30 Detik/i);
  assert.match(skillContent, /RUN_ONCE_UNAVAILABLE/);
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
