import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  normalizeContentRunRequest,
  hashContentRunRequest,
  CONTENT_RUN_ERROR_CODES,
  ALLOWED_PRODUCT_CAMPAIGN_COUNTS
} from '../lib/content-run-contract.js';
import {
  hydrateOperatorPresetCache,
  isOperatorPresetCompatible,
  resolveOperatorPreset
} from '../lib/operator-presets.js';
import { enqueueRunOnce } from '../lib/content-run-service.js';
import { pgQuery } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import crypto from 'crypto';

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

test('Feature flag fail-closed behavior (absent, false, true)', async () => {
  const orig = process.env.ENABLE_HERMES_RUN_ONCE;
  try {
    delete process.env.ENABLE_HERMES_RUN_ONCE;
    await assert.rejects(
      () => enqueueRunOnce({}, { tenantId: 'test_t' }, 'k1'),
      (err) => err.code === CONTENT_RUN_ERROR_CODES.RUN_ONCE_DISABLED
    );

    process.env.ENABLE_HERMES_RUN_ONCE = 'false';
    await assert.rejects(
      () => enqueueRunOnce({}, { tenantId: 'test_t' }, 'k1'),
      (err) => err.code === CONTENT_RUN_ERROR_CODES.RUN_ONCE_DISABLED
    );

    process.env.ENABLE_HERMES_RUN_ONCE = 'true';
    await assert.rejects(
      () => enqueueRunOnce({}, { tenantId: 'test_t' }, ''),
      (err) => err.code === CONTENT_RUN_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED
    );
  } finally {
    if (orig === undefined) delete process.env.ENABLE_HERMES_RUN_ONCE;
    else process.env.ENABLE_HERMES_RUN_ONCE = orig;
  }
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

  // Must reference 5020 in references / docs
  assert.match(skillContent, /5020/);
  // Must NOT reference 7020 as base URL
  assert.doesNotMatch(skillContent, /127\.0\.0\.1:7020/);
  assert.doesNotMatch(skillContent, /localhost:7020/);

  // Must contain fail-fast and prohibited discovery rules
  assert.match(skillContent, /Dilarang Keras Discovery Ilegal/i);
  assert.match(skillContent, /30 Detik/i);
  assert.match(skillContent, /RUN_ONCE_UNAVAILABLE/);

  // Scope separation
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

test('Database Integration: Enqueue Run-Once and Idempotency with isolated tenant fixture', async (t) => {
  const testTenant = `test_ro_${Date.now().toString(36)}`;
  const testBrandId = `bp_${Date.now().toString(36)}`;
  const testProductId = `pe_${Date.now().toString(36)}`;
  const idempotencyKey = `idemp_${Date.now().toString(36)}`;

  const origFlag = process.env.ENABLE_HERMES_RUN_ONCE;
  process.env.ENABLE_HERMES_RUN_ONCE = 'true';

  // Hydrate preset for test tenant
  hydrateOperatorPresetCache(testTenant, {
    dapurbotani_kampanye_produk_4_klip: {
      label: 'Dapur Botani 4 Klip',
      campaign_kinds: ['product_campaign'],
      product_bridging: { is_bridging_active: true }
    }
  });

  let dbConnected = false;
  try {
    // 1. Setup tenant fixture
    await pgQuery('INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $1)', [testTenant, `Tenant ${testTenant}`]);
    // 2. Setup brand profile without status / brand_slug column
    await pgQuery(
      'INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3)',
      [testBrandId, testTenant, 'Dapur Botani Test']
    );
    // 3. Setup product extraction
    await pgQuery(
      'INSERT INTO product_extractions (id, tenant_id, product_name, product_description, target_audience) VALUES ($1, $2, $3, $4, $5)',
      [testProductId, testTenant, 'Rolled Oat Test', 'Oat Sehat', 'Dewasa muda']
    );
    dbConnected = true;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.message?.includes('connect')) {
      t.skip('Database PostgreSQL tidak tersedia di lingkungan lokal unit test.');
      return;
    }
    throw err;
  } finally {
    if (!dbConnected) {
      if (origFlag === undefined) delete process.env.ENABLE_HERMES_RUN_ONCE;
      else process.env.ENABLE_HERMES_RUN_ONCE = origFlag;
    }
  }

  if (dbConnected) {
    try {
      const input = {
        mode: 'run_once',
        name: 'Rolled Oat Test Enqueue',
        brand_profile_id: testBrandId,
        product_id: testProductId,
        preset_key: 'dapurbotani_kampanye_produk_4_klip',
        video_count: 6,
        platform: 'tiktok',
        research: { query: 'Riset Oat Sehat' },
        review_mode: 'start_frames',
        publishing_policy: { mode: 'draft_only' }
      };

      // First call -> create
      const result1 = await tenantContext.run(testTenant, () =>
        enqueueRunOnce(input, { tenantId: testTenant, actor: 'test_actor' }, idempotencyKey)
      );
      assert.equal(result1.success, true);
      assert.ok(result1.run_id.startsWith('car_'));
      assert.equal(result1.status, 'research_queued');
      assert.equal(result1.replayed, false);

      // Verify no agent_automation_runs created during enqueue (Finding 5)
      const agentRunCountRes = await pgQuery(
        'SELECT COUNT(*)::int as count FROM agent_automation_runs WHERE tenant_id = $1 AND run_id = $2',
        [testTenant, result1.run_id]
      );
      assert.equal(agentRunCountRes.rows[0].count, 0, 'Agent run must not be created during enqueue before product snapshot');

      // Second call with same idempotency key + same body -> replay
      const result2 = await tenantContext.run(testTenant, () =>
        enqueueRunOnce(input, { tenantId: testTenant, actor: 'test_actor' }, idempotencyKey)
      );
      assert.equal(result2.success, true);
      assert.equal(result2.run_id, result1.run_id);
      assert.equal(result2.replayed, true);

      // Third call with same idempotency key + DIFFERENT body -> 409 IDEMPOTENCY_CONFLICT
      const inputChanged = { ...input, video_count: 12 };
      await assert.rejects(
        () => tenantContext.run(testTenant, () =>
          enqueueRunOnce(inputChanged, { tenantId: testTenant, actor: 'test_actor' }, idempotencyKey)
        ),
        (err) => err.code === CONTENT_RUN_ERROR_CODES.IDEMPOTENCY_CONFLICT
      );

      // Parallel calls with different idempotency keys for same brand-product binding
      const idemp2 = `idemp2_${Date.now().toString(36)}`;
      const idemp3 = `idemp3_${Date.now().toString(36)}`;
      const [resA, resB] = await Promise.all([
        tenantContext.run(testTenant, () =>
          enqueueRunOnce(input, { tenantId: testTenant, actor: 'test_actor_a' }, idemp2)
        ),
        tenantContext.run(testTenant, () =>
          enqueueRunOnce(input, { tenantId: testTenant, actor: 'test_actor_b' }, idemp3)
        )
      ]);
      assert.notEqual(resA.run_id, resB.run_id);

      // Verify only one brand_products binding row exists and is shared
      const bindingRes = await pgQuery(
        'SELECT id FROM brand_products WHERE tenant_id = $1 AND brand_profile_id = $2 AND product_id = $3',
        [testTenant, testBrandId, testProductId]
      );
      assert.equal(bindingRes.rowCount, 1, 'Only one brand_products binding row must exist for same brand and product');
    } finally {
      // Cleanup test fixture
      await pgQuery('DELETE FROM content_automation_audit_events WHERE tenant_id = $1', [testTenant]);
      await pgQuery('DELETE FROM content_automation_runs WHERE tenant_id = $1', [testTenant]);
      await pgQuery('DELETE FROM content_automation_schedules WHERE tenant_id = $1', [testTenant]);
      await pgQuery('DELETE FROM brand_products WHERE tenant_id = $1', [testTenant]);
      await pgQuery('DELETE FROM product_extractions WHERE id = $1 AND tenant_id = $2', [testProductId, testTenant]);
      await pgQuery('DELETE FROM brand_profiles WHERE id = $1 AND tenant_id = $2', [testBrandId, testTenant]);
      await pgQuery('DELETE FROM tenants WHERE id = $1', [testTenant]);

      if (origFlag === undefined) delete process.env.ENABLE_HERMES_RUN_ONCE;
      else process.env.ENABLE_HERMES_RUN_ONCE = origFlag;
    }
  }
});
