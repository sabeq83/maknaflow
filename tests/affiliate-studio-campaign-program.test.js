import { mock } from 'node:test';
mock.module('server-only', { default: {} });

import test from 'node:test';
import assert from 'node:assert/strict';
import { pgQuery } from '../lib/db-pg.js';

test('campaign program CRUD lifecycle with events logging and isolation', async () => {
  const {
    createCampaignProgram,
    getCampaignProgram,
    updateCampaignProgram,
    archiveCampaignProgram,
    listCampaignPrograms,
    listCampaignProgramEvents
  } = await import('../lib/affiliate-studio-campaign-program-adapter.js');

  const suffix = Date.now();
  const testTenant = `tenant_cp_${suffix}`;
  const otherTenant = `tenant_cp_oth_${suffix}`;
  const bp1 = `bp_cp_1_${suffix}`;
  const bp2 = `bp_cp_2_${suffix}`;

  // Pre-cleanup
  await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id IN ($1, $2)`, [testTenant, otherTenant]);
  await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id IN ($1, $2)`, [testTenant, otherTenant]);
  await pgQuery(`DELETE FROM tenants WHERE id IN ($1, $2)`, [testTenant, otherTenant]);

  // 1. Seed tenants
  await pgQuery(
    `INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)`,
    [testTenant, 'CP Tenant A', otherTenant, 'CP Tenant B']
  );

  // 2. Seed brand profiles
  await pgQuery(
    `INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3), ($4, $5, $6)`,
    [bp1, testTenant, 'Brand A', bp2, otherTenant, 'Brand B']
  );

  try {
    const adminUser = { id: 'usr_admin', role: 'admin', tenantId: testTenant };
    const otherAdmin = { id: 'usr_oth_admin', role: 'admin', tenantId: otherTenant };

    // 3. Create Program
    const payload = {
      name: 'Summer Promo 2026',
      description: 'Healthy foods campaign',
      objective: 'Boost sales',
      targetAudience: 'Healthy moms',
      funnelMix: { tofu: 50, mofu: 30, bofu: 20 },
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-08-31T00:00:00.000Z',
      platforms: ['tiktok', 'youtube'],
      kpis: '200 sales conversions',
      productionTarget: 25
    };

    const programId = await createCampaignProgram(adminUser, bp1, payload);
    assert.ok(programId);
    assert.ok(programId.startsWith('prog_'));

    // 4. Retrieve & Assert
    const program = await getCampaignProgram(adminUser, bp1, programId);
    assert.ok(program);
    assert.equal(program.name, 'Summer Promo 2026');
    assert.equal(program.productionTarget, 25);
    assert.equal(program.status, 'active');
    assert.deepEqual(program.platforms, ['tiktok', 'youtube']);
    assert.deepEqual(program.funnelMix, { tofu: 50, mofu: 30, bofu: 20 });

    // Isolation check: other tenant cannot retrieve this program
    const crossRetrieve = await getCampaignProgram(otherAdmin, bp2, programId);
    assert.equal(crossRetrieve, null);

    // 5. Update Program
    const updatePayload = {
      ...payload,
      name: 'Summer Promo 2026 Updated',
      productionTarget: 50
    };
    const updateOk = await updateCampaignProgram(adminUser, bp1, programId, updatePayload);
    assert.equal(updateOk, true);

    const updated = await getCampaignProgram(adminUser, bp1, programId);
    assert.equal(updated.name, 'Summer Promo 2026 Updated');
    assert.equal(updated.productionTarget, 50);

    // 6. List Programs
    const list = await listCampaignPrograms(adminUser, bp1, { status: 'active' });
    assert.equal(list.length, 1);
    assert.equal(list[0].id, programId);

    // 7. Archive Program
    const archiveOk = await archiveCampaignProgram(adminUser, bp1, programId);
    assert.equal(archiveOk, true);

    const archived = await getCampaignProgram(adminUser, bp1, programId);
    assert.equal(archived.status, 'archived');

    const activeList = await listCampaignPrograms(adminUser, bp1, { status: 'active' });
    assert.equal(activeList.length, 0);

    const archivedList = await listCampaignPrograms(adminUser, bp1, { status: 'archived' });
    assert.equal(archivedList.length, 1);

    // 8. Event Audit Trail Verification
    const events = await listCampaignProgramEvents(adminUser, bp1, programId);
    assert.ok(events.length >= 3); // created, updated, archived events should exist
    
    const createdEvent = events.find(e => e.eventType === 'created');
    assert.ok(createdEvent);
    assert.equal(createdEvent.actorId, 'usr_admin');
    assert.equal(createdEvent.payload.data.name, 'Summer Promo 2026');

    const archivedEvent = events.find(e => e.eventType === 'archived');
    assert.ok(archivedEvent);

  } finally {
    // Cleanup
    await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id IN ($1, $2)`, [testTenant, otherTenant]);
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id IN ($1, $2)`, [testTenant, otherTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id IN ($1, $2)`, [testTenant, otherTenant]);
  }
});

test('product snapshots capturing at bind time', async () => {
  const {
    createCampaignProgram,
    addProductsToCampaignProgram,
    listCampaignProgramProducts,
    removeProductsFromCampaignProgram
  } = await import('../lib/affiliate-studio-campaign-program-adapter.js');

  const suffix = Date.now();
  const testTenant = `tenant_cps_${suffix}`;
  const bp1 = `bp_cps_1_${suffix}`;
  const p1Id = `p_cps_1_${suffix}`;
  const bpAssocId = `bp_assoc_cps_1_${suffix}`;

  // Pre-cleanup
  await pgQuery(`DELETE FROM brand_products WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM product_extractions WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);

  // Seed
  await pgQuery(`INSERT INTO tenants (id, name) VALUES ($1, $2)`, [testTenant, 'CPS Tenant']);
  await pgQuery(`INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3)`, [bp1, testTenant, 'Brand A']);
  
  await pgQuery(
    `INSERT INTO product_extractions (id, tenant_id, product_name, product_description, unique_selling_point, target_audience, category, photo_url) VALUES
     ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [p1Id, testTenant, 'Chia Seed Pack', 'Organic chia seed desc', 'USP high fiber', 'Healthy people', 'Foods', 'img_chia.png']
  );

  await pgQuery(
    `INSERT INTO brand_products (id, tenant_id, brand_profile_id, product_id, affiliate_link, product_name_override, cta_override, is_active) VALUES
     ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [bpAssocId, testTenant, bp1, p1Id, 'https://aff.link/bp-chia', 'Super Chia Seed', 'Buy Chia Now', true]
  );

  try {
    const adminUser = { id: 'usr_admin', role: 'admin', tenantId: testTenant };

    const programId = await createCampaignProgram(adminUser, bp1, { name: 'Chia Seeds Campaign' });
    assert.ok(programId);

    // Bind product and trigger snapshot capturing
    const bindOk = await addProductsToCampaignProgram(adminUser, bp1, programId, [p1Id]);
    assert.equal(bindOk, true);

    const programProducts = await listCampaignProgramProducts(adminUser, bp1, programId);
    assert.equal(programProducts.length, 1);
    assert.equal(programProducts[0].productId, p1Id);
    assert.equal(programProducts[0].brandProductId, bpAssocId);

    const snapshot = programProducts[0].productSnapshot;
    assert.ok(snapshot);
    assert.equal(snapshot.displayName, 'Super Chia Seed');
    assert.equal(snapshot.productName, 'Chia Seed Pack');
    assert.equal(snapshot.category, 'Foods');
    assert.equal(snapshot.affiliate.link, 'https://aff.link/bp-chia');
    assert.equal(snapshot.affiliate.source, 'brand_product');
    assert.equal(snapshot.affiliate.ctaOverride, 'Buy Chia Now');

    // Mutate the original brand override link to verify that the snapshot remains immutable!
    await pgQuery(
      `UPDATE brand_products SET affiliate_link = $1 WHERE id = $2`,
      ['https://aff.link/chia-mutated', bpAssocId]
    );

    const checkSnapshotStillPreserved = await listCampaignProgramProducts(adminUser, bp1, programId);
    assert.equal(checkSnapshotStillPreserved[0].productSnapshot.affiliate.link, 'https://aff.link/bp-chia'); // snapshot preserved!

    // Unbind product
    const unbindOk = await removeProductsFromCampaignProgram(adminUser, bp1, programId, [p1Id]);
    assert.equal(unbindOk, true);

    const emptyProducts = await listCampaignProgramProducts(adminUser, bp1, programId);
    assert.equal(emptyProducts.length, 0);

  } finally {
    await pgQuery(`DELETE FROM brand_products WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM product_extractions WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);
  }
});
