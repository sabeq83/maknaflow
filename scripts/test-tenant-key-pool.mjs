import assert from 'node:assert/strict';
import pg from 'pg';
import { loadStagingEnv } from './local-staging/env.js';

Object.assign(process.env, loadStagingEnv());
const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE
});

await client.connect();
try {
  const schema = await client.query(`
    SELECT column_default FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'gemini_api_keys' AND column_name = 'id'
  `);
  assert.match(schema.rows[0]?.column_default || '', /gemini_api_keys_id_seq/);
  await client.query('BEGIN');
  const suffix = Date.now().toString(36);
  const tenantA = `test_a_${suffix}`;
  const tenantB = `test_b_${suffix}`;
  await client.query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Test A', $2), ($3, 'Test B', $4)", [tenantA, tenantA, tenantB, tenantB]);
  for (let index = 1; index <= 21; index++) {
    await client.query(`INSERT INTO gemini_api_keys (tenant_id, key_name, api_key, tier, daily_limit) VALUES ($1, $2, $3, 'FREE', 20)`, [tenantA, `Test ${index}`, `test-key-${suffix}-${index}`]);
  }
  const duplicate = await client.query(`INSERT INTO gemini_api_keys (tenant_id, key_name, api_key) VALUES ($1, 'Duplicate', $2) ON CONFLICT (tenant_id, api_key) DO NOTHING`, [tenantA, `test-key-${suffix}-1`]);
  assert.equal(duplicate.rowCount, 0);
  const crossTenant = await client.query(`INSERT INTO gemini_api_keys (tenant_id, key_name, api_key) VALUES ($1, 'Cross tenant', $2)`, [tenantB, `test-key-${suffix}-1`]);
  assert.equal(crossTenant.rowCount, 1);
  const counts = await client.query('SELECT tenant_id, COUNT(*)::int total FROM gemini_api_keys WHERE tenant_id IN ($1, $2) GROUP BY tenant_id ORDER BY tenant_id', [tenantA, tenantB]);
  assert.deepEqual(counts.rows.map(row => row.total), [21, 1]);
  await client.query('ROLLBACK');
  console.log('Tenant/Gemini Key Pool test passed: 21 inserts, duplicate detection, and cross-tenant isolation.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end();
}
