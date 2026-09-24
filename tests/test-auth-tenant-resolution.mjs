import assert from 'node:assert/strict';
import { buildUserObject } from '../lib/auth.js';
import { getDb } from '../lib/db.js';

async function runTests() {
  console.log('🧪 Starting Auth & Tenant ID Resolution Tests...');
  const db = getDb();

  // 1. Test buildUserObject for non-default tenant user
  console.log('Test 1: buildUserObject should populate both tenantId and tenant_id...');
  const dummyTenantUser = {
    id: 'user_test_999',
    username: 'admin_waysiyasi',
    email: 'admin@waysiyasi.com',
    role: 'admin',
    tenant_id: 'tenant_waysiyasi_custom'
  };

  const userObj = await buildUserObject(db, dummyTenantUser);
  assert.equal(userObj.tenantId, 'tenant_waysiyasi_custom', 'user.tenantId must match');
  assert.equal(userObj.tenant_id, 'tenant_waysiyasi_custom', 'user.tenant_id alias must match');
  console.log('✅ Test 1 Passed: Both tenantId and tenant_id properties match active tenant.');

  // 2. Test superadmin resolution
  console.log('Test 2: superadmin should resolve to __none__ for tenant isolation...');
  const superadminUser = {
    id: 'user_super_1',
    username: 'superadmin',
    email: 'super@makna.id',
    role: 'superadmin',
    tenant_id: null
  };
  const superadminObj = await buildUserObject(db, superadminUser);
  assert.equal(superadminObj.tenantId, '__none__');
  assert.equal(superadminObj.tenant_id, '__none__');
  console.log('✅ Test 2 Passed: Superadmin isolates to __none__.');

  // 3. Test fallback to default_tenant when tenant_id is missing
  console.log('Test 3: fallback to default_tenant when user has no explicit tenant...');
  const defaultUser = {
    id: 'user_def_1',
    username: 'user_default',
    email: 'default@makna.id',
    role: 'admin',
    tenant_id: null
  };
  const defaultObj = await buildUserObject(db, defaultUser);
  assert.equal(defaultObj.tenantId, 'default_tenant');
  assert.equal(defaultObj.tenant_id, 'default_tenant');
  console.log('✅ Test 3 Passed: Fallback to default_tenant verified.');

  console.log('🎉 All Auth & Tenant ID Resolution Tests Passed!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
