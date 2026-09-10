import test from 'node:test';
import assert from 'node:assert/strict';
import { signOAuthState, verifyOAuthState } from '../lib/google-auth.js';
import { getSetting, setSetting } from '../lib/db.js';
import { tenantContext } from '../lib/tenant-context.js';

test('Google OAuth State Multi-Tenant Signing & Verification', () => {
  const statePayload = {
    tenantId: 'tnt_sy-dodot_4ba27b',
    returnTo: '/settings',
    exp: Date.now() + 600000
  };

  const signed = signOAuthState(statePayload);
  assert.ok(typeof signed === 'string', 'Signed state harus bertipe string');
  assert.ok(signed.includes('.'), 'Signed state harus memiliki separator titik');

  const verified = verifyOAuthState(signed);
  assert.ok(verified, 'State harus berhasil diverifikasi');
  assert.equal(verified.tenantId, 'tnt_sy-dodot_4ba27b');
  assert.equal(verified.returnTo, '/settings');
});

test('Google OAuth State Expiry Rejection', () => {
  const expiredPayload = {
    tenantId: 'tnt_sy-benu_415f99',
    returnTo: '/content-flow',
    exp: Date.now() - 1000 // Expired
  };

  const signed = signOAuthState(expiredPayload);
  const verified = verifyOAuthState(signed);
  assert.equal(verified, null, 'Expired state harus ditolak');
});

test('Google OAuth State Tamper Rejection', () => {
  const payload = {
    tenantId: 'tnt_sy-benu_415f99',
    returnTo: '/settings',
    exp: Date.now() + 600000
  };

  const signed = signOAuthState(payload);
  const tampered = signed.slice(0, -4) + 'abcd';
  const verified = verifyOAuthState(tampered);
  assert.equal(verified, null, 'Tampered state harus ditolak');
});

test('Google Tokens Private Key Isolation across tenants', async () => {
  const tenantA = 'tnt_test_tenant_a';
  const tenantB = 'tnt_test_tenant_b';

  // Simpan token untuk tenant A
  await tenantContext.run(tenantA, async () => {
    await setSetting('google_tokens', JSON.stringify({ access_token: 'tok_a', refresh_token: 'ref_a' }));
    await setSetting('google_email', 'tenant_a@example.com');
  });

  // Pastikan tenant A bisa membaca miliknya
  const tokenA = await tenantContext.run(tenantA, () => getSetting('google_tokens'));
  const emailA = await tenantContext.run(tenantA, () => getSetting('google_email'));
  assert.ok(tokenA.includes('tok_a'));
  assert.equal(emailA, 'tenant_a@example.com');

  // Pastikan tenant B TIDAK bocor membaca token milik tenant A maupun default_tenant
  const tokenB = await tenantContext.run(tenantB, () => getSetting('google_tokens'));
  const emailB = await tenantContext.run(tenantB, () => getSetting('google_email'));
  assert.equal(tokenB, null, 'Tenant B tidak boleh fallback ke token tenant A / default');
  assert.equal(emailB, null, 'Tenant B tidak boleh fallback ke email tenant A / default');
});
