import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { loadStagingEnv } from './local-staging/env.js';

Object.assign(process.env, loadStagingEnv());
const { provisionTenant } = await import('../lib/tenant-admin.js');
const suffix = crypto.randomBytes(4).toString('hex');
const password = `Makna-Smoke-${suffix}-Secure!`;
const username = `smoke_admin_${suffix}`;
const tenantResult = await provisionTenant({
  name: `Smoke Tenant ${suffix}`,
  slug: `smoke-${suffix}`,
  timezone: 'Asia/Jakarta',
  admin_username: username,
  admin_email: `${username}@example.invalid`,
  admin_password: password
}, { id: null });

const client = new pg.Client({ host: process.env.PGHOST, port: Number(process.env.PGPORT), user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE });
await client.connect();
try {
  const login = await fetch('http://127.0.0.1:5010/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const keys = Array.from({ length: 21 }, (_, index) => ({ key_name: `Smoke ${index + 1}`, api_key: `smoke-${suffix}-${index + 1}`, tier: 'FREE', daily_limit: 20 }));
  const imported = await fetch('http://127.0.0.1:5010/api/keys', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ bulk_keys: keys, validate_live: false })
  });
  const payload = await imported.json();
  assert.equal(imported.status, 200);
  assert.deepEqual(payload.summary, { added: 21, duplicates: 0, rejected: 0, failed: 0 });
  const pool = await fetch('http://127.0.0.1:5010/api/keys', { headers: { cookie } });
  const poolPayload = await pool.json();
  assert.equal(poolPayload.data.keys.length, 21);
  assert.ok(poolPayload.data.keys.every(key => key.api_key.includes('...')));
  console.log('Tenant API smoke passed: login, bulk import 21, masked tenant-scoped listing.');
} finally {
  const tenantId = tenantResult.tenant.id;
  const userId = tenantResult.admin.id;
  await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM user_menu_permissions WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM users WHERE id = $1', [userId]);
  await client.query('DELETE FROM tenant_audit_events WHERE tenant_id = $1', [tenantId]);
  await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  await client.end();
}
