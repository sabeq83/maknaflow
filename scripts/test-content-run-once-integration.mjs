import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';

console.log('🧪 === MAKNA FLOW: CONTENT RUN ONCE DATABASE INTEGRATION SUITE (DEV SCHEMA) === 🧪');

// 1. Strict Schema Enforcement & Pre-Import Configuration
const integrationSchema = process.env.RUN_ONCE_TEST_SCHEMA || 'dev';
if (integrationSchema !== 'dev') {
  throw new Error(`RUN_ONCE_TEST_SCHEMA=dev wajib untuk Dev integration test (received: ${integrationSchema})`);
}

process.env.PG_SEARCH_PATH = integrationSchema;
process.env.ENABLE_HERMES_RUN_ONCE = 'true';

const pgHost = process.env.PGHOST || '100.78.186.123';
const pgPort = Number(process.env.PGPORT || 5432);
const pgUser = process.env.PGUSER || 'makna_user';
const pgPassword = process.env.PGPASSWORD || 'maknagridpass';
const pgDatabase = process.env.PGDATABASE || 'maknaflow_db';

console.log(`[DB Test] Connecting direct pool to ${pgHost}:${pgPort}/${pgDatabase} (search_path: ${integrationSchema})...`);

const directPool = new pg.Pool({
  host: pgHost,
  port: pgPort,
  user: pgUser,
  password: pgPassword,
  database: pgDatabase,
  options: `-c search_path=${integrationSchema}`,
  max: 3,
  connectionTimeoutMillis: 15000
});

async function currentSchema(p) {
  const res = await p.query('SHOW search_path');
  const path = res.rows[0].search_path || '';
  return path.split(',')[0].trim();
}

async function runTests() {
  const client = await directPool.connect();
  const testTenant = `test_run_once_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const testBrandId = `bp_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const testProductId = `pe_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const idempotencyKey1 = `idemp1_${Date.now().toString(36)}`;
  const idempotencyKey2 = `idemp2_${Date.now().toString(36)}`;
  const idempotencyKey3 = `idemp3_${Date.now().toString(36)}`;
  const idempotencyKeyRollback = `idemp_rb_${Date.now().toString(36)}`;

  let appPoolRef = null;

  try {
    console.log('\n🔍 [1/15] Verifying search_path uniformity between direct pool and app pool...');
    const directSchemaName = await currentSchema(directPool);
    assert.equal(directSchemaName, integrationSchema, `Direct pool schema must be ${integrationSchema}`);

    // Dynamic import of application services after PG_SEARCH_PATH is set
    const { getPgPool } = await import('../lib/db-pg.js');
    appPoolRef = getPgPool();
    const appSchemaName = await currentSchema(appPoolRef);
    assert.equal(appSchemaName, integrationSchema, `Application getPgPool() schema must be ${integrationSchema}`);
    console.log(`✓ Both direct pool and application pool are operating on schema "${integrationSchema}".`);

    console.log(`\n📦 [2/15] Initializing isolated test fixture for tenant "${testTenant}"...`);
    // Create isolated tenant
    await client.query('INSERT INTO tenants (id, name, slug, status) VALUES ($1, $2, $1, $3)', [testTenant, `Tenant ${testTenant}`, 'active']);

    // Create real brand profile without fictional columns
    await client.query(
      'INSERT INTO brand_profiles (id, tenant_id, brand_name, visual_signature, tone_of_voice) VALUES ($1, $2, $3, $4, $5)',
      [testBrandId, testTenant, 'Dapur Botani Integration Test', 'Warm Organic', 'Informative']
    );

    // Create real product extraction
    await client.query(
      'INSERT INTO product_extractions (id, tenant_id, product_name, product_description, target_audience) VALUES ($1, $2, $3, $4, $5)',
      [testProductId, testTenant, 'Rolled Oat Premium Integration', 'Oat Sehat Berkualitas', 'Dewasa muda']
    );

    // Store custom tenant preset in tenant_settings
    const customPresetsJson = JSON.stringify({
      dapurbotani_kampanye_produk_4_klip: {
        label: 'Dapur Botani 4 Klip',
        campaign_kinds: ['product_campaign'],
        product_bridging: { is_bridging_active: true }
      }
    });
    await client.query(
      `INSERT INTO tenant_settings (tenant_id, setting_key, setting_value)
       VALUES ($1, 'operator_presets_json', $2)
       ON CONFLICT (tenant_id, setting_key) DO UPDATE SET setting_value = $2`,
      [testTenant, customPresetsJson]
    );
    console.log('✓ Isolated fixtures created successfully on schema Dev.');

    const { enqueueRunOnce, buildBoundedContentRunStatus, ensureTenantPresetsHydrated } = await import('../lib/content-run-service.js');
    const { CONTENT_RUN_ERROR_CODES, assertHermesRunOnceEnabled } = await import('../lib/content-run-contract.js');
    const { tenantContext } = await import('../lib/tenant-context.js');

    console.log('\n🔒 [3/15] Verifying fail-closed feature flag behavior with live production service...');
    process.env.ENABLE_HERMES_RUN_ONCE = 'false';
    await assert.rejects(
      () => tenantContext.run(testTenant, () =>
        enqueueRunOnce({ brand_profile_id: testBrandId, product_id: testProductId, preset_key: 'dapurbotani_kampanye_produk_4_klip', video_count: 6 }, { tenantId: testTenant }, idempotencyKey1)
      ),
      (err) => err.code === CONTENT_RUN_ERROR_CODES.RUN_ONCE_DISABLED
    );
    console.log('✓ Flag "false" rejects with 503 RUN_ONCE_DISABLED.');

    delete process.env.ENABLE_HERMES_RUN_ONCE;
    await assert.rejects(
      () => tenantContext.run(testTenant, () =>
        enqueueRunOnce({ brand_profile_id: testBrandId, product_id: testProductId, preset_key: 'dapurbotani_kampanye_produk_4_klip', video_count: 6 }, { tenantId: testTenant }, idempotencyKey1)
      ),
      (err) => err.code === CONTENT_RUN_ERROR_CODES.RUN_ONCE_DISABLED
    );
    console.log('✓ Absent flag rejects with 503 RUN_ONCE_DISABLED.');

    process.env.ENABLE_HERMES_RUN_ONCE = 'true';
    assert.doesNotThrow(() => assertHermesRunOnceEnabled(process.env));
    console.log('✓ Flag "true" passes assertion.');

    console.log('\n🔍 [4/15] Verifying Brand Profile and Product lookup on schema Dev...');
    const brandRow = await client.query('SELECT id, brand_name FROM brand_profiles WHERE id = $1 AND tenant_id = $2', [testBrandId, testTenant]);
    assert.equal(brandRow.rowCount, 1);
    assert.equal(brandRow.rows[0].brand_name, 'Dapur Botani Integration Test');

    const productRow = await client.query('SELECT id, product_name FROM product_extractions WHERE id = $1 AND tenant_id = $2', [testProductId, testTenant]);
    assert.equal(productRow.rowCount, 1);
    assert.equal(productRow.rows[0].product_name, 'Rolled Oat Premium Integration');
    console.log('✓ Brand and Product exist and are queryable with tenant isolation.');

    console.log('\n🎨 [5/15] Verifying tenant custom preset hydration & incompatibility rejection...');
    await ensureTenantPresetsHydrated(testTenant);
    await assert.rejects(
      () => tenantContext.run(testTenant, () =>
        enqueueRunOnce({
          brand_profile_id: testBrandId,
          product_id: testProductId,
          preset_key: 'nutribake_editorial_v1', // Incompatible with product_campaign
          video_count: 6
        }, { tenantId: testTenant }, idempotencyKey1)
      ),
      (err) => err.code === CONTENT_RUN_ERROR_CODES.PRESET_CAMPAIGN_KIND_MISMATCH
    );
    console.log('✓ Incompatible preset rejected with PRESET_CAMPAIGN_KIND_MISMATCH.');

    console.log('\n⚡ [6/15] Enqueueing valid run-once and measuring latency budget (< 2000ms)...');
    const validPayload = {
      mode: 'run_once',
      name: 'Rolled Oat Smoke Integration',
      brand_profile_id: testBrandId,
      product_id: testProductId,
      preset_key: 'dapurbotani_kampanye_produk_4_klip',
      video_count: 6,
      platform: 'tiktok',
      research: { query: 'Riset Oat Sehat' },
      review_mode: 'start_frames',
      publishing_policy: { mode: 'draft_only' }
    };

    const startTime = Date.now();
    const enqueueRes1 = await tenantContext.run(testTenant, () =>
      enqueueRunOnce(validPayload, { tenantId: testTenant, actor: 'integration_tester' }, idempotencyKey1)
    );
    const latencyMs = Date.now() - startTime;
    console.log(`✓ Enqueue succeeded in ${latencyMs}ms (budget < 2000ms).`);
    assert.ok(latencyMs < 2000, `Enqueue took ${latencyMs}ms, exceeding 2000ms budget`);
    assert.equal(enqueueRes1.success, true);
    assert.ok(enqueueRes1.run_id.startsWith('car_'));
    assert.equal(enqueueRes1.replayed, false);
    assert.equal(enqueueRes1.status, 'research_queued');

    console.log('\n🧬 [7/15] Verifying event ordering & deferred agent run creation...');
    const agentRunsCheck = await client.query(
      'SELECT COUNT(*)::int as count FROM agent_automation_runs WHERE tenant_id = $1 AND run_id = $2',
      [testTenant, enqueueRes1.run_id]
    );
    assert.equal(agentRunsCheck.rows[0].count, 0, 'Agent Run must NOT be created during enqueue before snapshot');

    const auditEventsRes = await client.query(
      'SELECT event_type, run_id FROM content_automation_audit_events WHERE tenant_id = $1 AND run_id = $2',
      [testTenant, enqueueRes1.run_id]
    );
    assert.equal(auditEventsRes.rowCount, 1);
    assert.equal(auditEventsRes.rows[0].event_type, 'run_once_enqueued');
    console.log('✓ Verified: Agent Run deferred and audit event recorded.');

    console.log('\n🔁 [8/15] Verifying Idempotency Replay (Same Key + Same Payload)...');
    const enqueueRes2 = await tenantContext.run(testTenant, () =>
      enqueueRunOnce(validPayload, { tenantId: testTenant, actor: 'integration_tester' }, idempotencyKey1)
    );
    assert.equal(enqueueRes2.success, true);
    assert.equal(enqueueRes2.run_id, enqueueRes1.run_id);
    assert.equal(enqueueRes2.replayed, true);
    console.log('✓ Verified: Same key returns existing run_id with replayed=true.');

    console.log('\n⚔️ [9/15] Verifying Idempotency Conflict 409 (Same Key + Different Payload)...');
    const conflictPayload = { ...validPayload, video_count: 12 };
    await assert.rejects(
      () => tenantContext.run(testTenant, () =>
        enqueueRunOnce(conflictPayload, { tenantId: testTenant, actor: 'integration_tester' }, idempotencyKey1)
      ),
      (err) => err.code === CONTENT_RUN_ERROR_CODES.IDEMPOTENCY_CONFLICT
    );
    console.log('✓ Verified: Same key with changed payload rejects with 409 IDEMPOTENCY_CONFLICT.');

    console.log('\n🤝 [10/15] Verifying Parallel Binding Concurrency & Shared Binding ID...');
    const [resA, resB] = await Promise.all([
      tenantContext.run(testTenant, () =>
        enqueueRunOnce(validPayload, { tenantId: testTenant, actor: 'actor_a' }, idempotencyKey2)
      ),
      tenantContext.run(testTenant, () =>
        enqueueRunOnce(validPayload, { tenantId: testTenant, actor: 'actor_b' }, idempotencyKey3)
      )
    ]);
    assert.notEqual(resA.run_id, resB.run_id);

    const bindingCountRes = await client.query(
      'SELECT id FROM brand_products WHERE tenant_id = $1 AND brand_profile_id = $2 AND product_id = $3',
      [testTenant, testBrandId, testProductId]
    );
    assert.equal(bindingCountRes.rowCount, 1, 'Only one brand_products binding row must exist');
    console.log(`✓ Verified: Parallel requests share exactly 1 binding row (${bindingCountRes.rows[0].id}).`);

    console.log('\n💥 [11/15] Verifying Transactional Rollback on Injected Failure...');
    const { withPgTransaction } = await import('../lib/db-pg.js');
    await assert.rejects(
      () => withPgTransaction(async (txClient) => {
        await txClient.query(
          'INSERT INTO brand_profiles (id, tenant_id, brand_name, visual_signature, tone_of_voice) VALUES ($1, $2, $3, $4, $5)',
          ['bp_rollback_test', testTenant, 'Rollback Brand Test', 'Warm Organic', 'Informative']
        );
        throw new Error('INJECTED_ROLLBACK_TRIGGER');
      }),
      /INJECTED_ROLLBACK_TRIGGER/
    );
    const rollbackCheck = await client.query('SELECT id FROM brand_profiles WHERE id = $1', ['bp_rollback_test']);
    assert.equal(rollbackCheck.rowCount, 0, 'Rolled back row must NOT exist in database');
    console.log('✓ Verified: Transactional rollback cleanly reverts mutations.');

    console.log('\n📊 [12/15] Verifying Bounded Status, Accurate Ready Count, and Tenant Isolation...');
    const statusRes = await tenantContext.run(testTenant, () =>
      buildBoundedContentRunStatus(enqueueRes1.run_id, testTenant)
    );
    assert.equal(statusRes.success, true);
    assert.equal(statusRes.run_id, enqueueRes1.run_id);
    assert.equal(statusRes.publishing_mode, 'draft_only');
    assert.ok(['queued', 'research_queued'].includes(statusRes.status));
    assert.equal(typeof statusRes.items.ready, 'number');
    assert.equal(typeof statusRes.items.total, 'number');
    // Secret redaction check
    assert.equal(statusRes.secret, undefined);
    assert.equal(statusRes.token, undefined);

    // Tenant isolation: foreign tenant must receive 404
    await assert.rejects(
      () => tenantContext.run('foreign_tenant', () =>
        buildBoundedContentRunStatus(enqueueRes1.run_id, 'foreign_tenant')
      ),
      (err) => err.code === CONTENT_RUN_ERROR_CODES.RUN_NOT_FOUND
    );
    console.log('✓ Verified: Status endpoint enforces tenant isolation and redaction.');

    console.log('\n🛡️ [13/15] Verifying Zero Publishing Intents & Jobs for draft_only...');
    const publishingIntentsRes = await client.query(
      'SELECT COUNT(*)::int as count FROM agent_publishing_intents WHERE tenant_id = $1',
      [testTenant]
    );
    assert.equal(publishingIntentsRes.rows[0].count, 0, 'Zero publishing intents must exist for draft_only');

    const publishingJobsRes = await client.query(
      'SELECT COUNT(*)::int as count FROM publishing_jobs WHERE tenant_id = $1',
      [testTenant]
    );
    assert.equal(publishingJobsRes.rows[0].count, 0, 'Zero publishing jobs must exist for draft_only');
    console.log('✓ Verified: Exactly zero publishing intents and zero publishing jobs.');

    console.log('\n📅 [14/15] Verifying Non-Recurring Schedule Semantics...');
    const scheduleModeRes = await client.query(
      'SELECT execution_mode, status, next_run_at FROM content_automation_schedules WHERE tenant_id = $1',
      [testTenant]
    );
    for (const sched of scheduleModeRes.rows) {
      assert.equal(sched.execution_mode, 'run_once');
      assert.equal(sched.status, 'paused');
      assert.equal(sched.next_run_at, null);
    }
    console.log('✓ Verified: All schedules are execution_mode=run_once, paused, next_run_at=null.');

    console.log('\n🎉 [15/15] All 15 Integration Assertions Passed Successfully on Schema Dev!');
  } finally {
    console.log('\n🧹 Cleaning up isolated test fixtures...');
    await client.query('DELETE FROM content_automation_audit_events WHERE tenant_id = $1', [testTenant]);
    await client.query('DELETE FROM content_automation_runs WHERE tenant_id = $1', [testTenant]);
    await client.query('DELETE FROM content_automation_schedules WHERE tenant_id = $1', [testTenant]);
    await client.query('DELETE FROM brand_products WHERE tenant_id = $1', [testTenant]);
    await client.query('DELETE FROM product_extractions WHERE id = $1 AND tenant_id = $2', [testProductId, testTenant]);
    await client.query('DELETE FROM brand_profiles WHERE id = $1 AND tenant_id = $2', [testBrandId, testTenant]);
    await client.query('DELETE FROM tenant_settings WHERE tenant_id = $1', [testTenant]);
    await client.query('DELETE FROM tenants WHERE id = $1', [testTenant]);
    client.release();
    await directPool.end();
    if (appPoolRef) {
      await appPoolRef.end();
    }
    console.log('✓ Teardown complete. All connection pools closed.');
  }
}

runTests().then(() => {
  console.log('\n✅ DB INTEGRATION SUITE EXITED WITH 0 ERRORS.');
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ DB INTEGRATION SUITE FAILED:', err);
  process.exit(1);
});
