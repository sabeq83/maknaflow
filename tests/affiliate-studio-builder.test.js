import { mock } from 'node:test';
mock.module('server-only', { default: {} });

import test from 'node:test';
import assert from 'node:assert';
import { pgQuery } from '../lib/db-pg.js';

test('Fase 12 — Assisted Campaign Program Builder unit & integration tests', async (t) => {
  const { suggestCampaignProgram } = await import('../lib/affiliate-studio-builder-adapter.js');

  const suffix = Date.now();
  const testTenant = `tn_bld_${suffix}`;
  const bp1 = `bp_bld_${suffix}`;

  // Setup seed structures
  await pgQuery(`INSERT INTO tenants (id, name, status) VALUES ($1, $2, 'active')`, [testTenant, `Tenant Builder ${suffix}`]);
  await pgQuery(`INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3)`, [bp1, testTenant, 'Nutriblend Brand']);

  try {
    const adminUser = { id: 'usr_admin', role: 'admin', tenantId: testTenant };

    // Trigger suggestion helper
    const suggested = await suggestCampaignProgram(adminUser, bp1);
    assert.ok(suggested);
    assert.ok(suggested.name);
    assert.ok(suggested.funnelMix);
    assert.ok(suggested.platforms);
    assert.ok(suggested.targetDemographic);
    assert.ok(suggested.aiDirective);
    assert.ok(suggested.mandatoryOutroLine);

  } finally {
    // Cleanup
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);
  }
});
