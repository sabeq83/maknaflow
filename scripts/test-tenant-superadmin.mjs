import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { loadStagingEnv } from './local-staging/env.js';

Object.assign(process.env, loadStagingEnv());
const suffix = crypto.randomBytes(4).toString('hex');
const username = `test_super_${suffix}`;
const password = `Makna-Test-${suffix}-Secure!`;
const { createSuperadmin, deactivateSuperadmin } = await import('../lib/superadmin-service.js');
const { provisionTenant } = await import('../lib/tenant-admin.js');
const { loginUser, destroySession } = await import('../lib/auth.js');
const client = new pg.Client({ host: process.env.PGHOST, port: Number(process.env.PGPORT), user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE });

await client.connect();
let superadmin;
let tenant;
try {
  const existing = await client.query("SELECT COUNT(*)::int count FROM users WHERE role = 'superadmin'");
  superadmin = await createSuperadmin({ username, email: `${username}@example.invalid`, password }, { bootstrap: existing.rows[0].count === 0, actorUserId: existing.rows[0].count === 0 ? null : 'test-suite' });
  assert.equal(superadmin.role, 'superadmin');
  const login = await loginUser(username, password);
  assert.equal(login.success, true);
  assert.equal(login.user.tenantId, '__none__');
  await destroySession(login.token);

  tenant = await provisionTenant({
    name: `Test Tenant ${suffix}`,
    slug: `test-tenant-${suffix}`,
    timezone: 'Asia/Jakarta',
    admin_username: `test_admin_${suffix}`,
    admin_email: `test_admin_${suffix}@example.invalid`,
    admin_password: password
  }, { id: superadmin.id });
  assert.equal(tenant.tenant.status, 'active');
  assert.equal(tenant.admin.tenant_id, tenant.tenant.id);

  const activeCount = await client.query("SELECT COUNT(*)::int count FROM users WHERE role = 'superadmin' AND status = 'active'");
  if (activeCount.rows[0].count === 1) {
    await assert.rejects(() => deactivateSuperadmin(superadmin.id, superadmin.id), /terakhir/);
  }
  console.log('Superadmin bootstrap/login and atomic tenant provisioning test passed.');
} finally {
  if (tenant?.tenant?.id) {
    await client.query('DELETE FROM user_menu_permissions WHERE user_id = $1', [tenant.admin.id]);
    await client.query('DELETE FROM users WHERE id = $1', [tenant.admin.id]);
    await client.query('DELETE FROM tenant_audit_events WHERE tenant_id = $1', [tenant.tenant.id]);
    await client.query('DELETE FROM tenants WHERE id = $1', [tenant.tenant.id]);
  }
  if (superadmin?.id) {
    await client.query("DELETE FROM tenant_audit_events WHERE event_json LIKE $1", [`%${superadmin.id}%`]);
    await client.query('DELETE FROM sessions WHERE user_id = $1', [superadmin.id]);
    await client.query('DELETE FROM users WHERE id = $1', [superadmin.id]);
  }
  await client.end();
}
