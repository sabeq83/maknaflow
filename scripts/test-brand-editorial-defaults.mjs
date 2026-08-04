import assert from 'node:assert/strict';
import pg from 'pg';
import { loadStagingEnv } from './local-staging/env.js';
import {
  getBrandEditorialDefaults,
  normalizeBrandEditorialDefaults,
  normalizeEditorialPillars,
  shouldHydrateBrandEditorial,
  validateBrandEditorialDefaults
} from '../lib/brand-editorial-defaults.js';

Object.assign(process.env, loadStagingEnv());
const { tenantContext } = await import('../lib/tenant-context.js');
const { getBrandProfile, updateBrandProfile } = await import('../lib/db.js');
const client = new pg.Client();
await client.connect();
const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const tenantB = `brand_editorial_tenant_${suffix}`;
const brandA = `brand_editorial_a_${suffix}`;
const brandB = `brand_editorial_b_${suffix}`;
const legacyBrand = `brand_editorial_legacy_${suffix}`;
const plannerId = `brand_editorial_planner_${suffix}`;

try {
  assert.deepEqual(normalizeEditorialPillars([' Edukasi ', 'edukasi', '', 'Lifestyle']), ['Edukasi', 'Lifestyle']);
  assert.deepEqual(normalizeEditorialPillars('{invalid-json'), ['{invalid-json']);
  assert.equal(normalizeEditorialPillars(Array.from({ length: 20 }, (_, index) => `Pilar ${index}`)).length, 12);
  assert.equal(normalizeEditorialPillars(['x'.repeat(150)])[0].length, 120);
  assert.throws(() => validateBrandEditorialDefaults({ editorial_brand_context: '', editorial_content_pillars: [] }));
  const normalized = validateBrandEditorialDefaults({ editorial_brand_context: '  Brand sehat  ', editorial_content_goal: ' Authority ', editorial_content_pillars: ['Edukasi', 'edukasi', 'Resep'] });
  assert.equal(normalized.editorial_brand_context, 'Brand sehat');
  assert.equal(normalized.editorial_content_goal, 'Authority');
  assert.equal(normalized.editorial_content_pillars_json, '["Edukasi","Resep"]');
  assert.deepEqual(getBrandEditorialDefaults(normalized), { brandContext: 'Brand sehat', contentGoal: 'Authority', pillars: ['Edukasi', 'Resep'] });
  assert.equal(shouldHydrateBrandEditorial({ dirty: false, brandContext: 'draft', pillars: ['x'] }), true);
  assert.equal(shouldHydrateBrandEditorial({ dirty: true, brandContext: 'draft', pillars: ['x'] }), false);
  assert.equal(shouldHydrateBrandEditorial({ dirty: true, brandContext: '', contentGoal: '', pillars: [] }), true);

  await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS editorial_brand_context TEXT`);
  await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS editorial_content_goal TEXT`);
  await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS editorial_content_pillars_json TEXT DEFAULT '[]'`);
  await client.query(`INSERT INTO tenants(id,name) VALUES($1,$2) ON CONFLICT(id) DO NOTHING`, [tenantB, 'Brand Editorial Fixture']);
  await client.query(`INSERT INTO brand_profiles(id,brand_name,visual_signature,tenant_id,editorial_brand_context,editorial_content_goal,editorial_content_pillars_json) VALUES($1,'Fixture A','Clean',$2,'Context A','Goal A','["Pilar A"]')`, [brandA, 'default_tenant']);
  await client.query(`INSERT INTO brand_profiles(id,brand_name,visual_signature,tenant_id,editorial_brand_context,editorial_content_goal,editorial_content_pillars_json) VALUES($1,'Fixture B','Clean',$2,'Context B','Goal B','["Pilar B"]')`, [brandB, tenantB]);
  await client.query(`INSERT INTO brand_profiles(id,brand_name,visual_signature,tenant_id) VALUES($1,'Legacy Fixture','Clean',$2)`, [legacyBrand, 'default_tenant']);

  assert.equal((await tenantContext.run('default_tenant', () => getBrandProfile(brandA))).editorial_brand_context, 'Context A');
  assert.equal(await tenantContext.run(tenantB, () => getBrandProfile(brandA)), null);
  assert.equal(await tenantContext.run('default_tenant', () => getBrandProfile(brandB)), null);
  assert.equal((await tenantContext.run('default_tenant', () => getBrandProfile(legacyBrand))).editorial_brand_context, null);

  await client.query(`INSERT INTO content_planners(id,title,account_name,brand_id,planner_focus,brand_context,content_goal,pillars_json,tenant_id) VALUES($1,'Snapshot Fixture','Fixture A',$2,'brand_editorial','Context A','Goal A','["Pilar A"]','default_tenant')`, [plannerId, brandA]);
  await tenantContext.run('default_tenant', () => updateBrandProfile(brandA, normalizeBrandEditorialDefaults({ editorial_brand_context: 'Context Changed', editorial_content_goal: 'Goal Changed', editorial_content_pillars: ['Pilar Changed'] })));
  const snapshot = (await client.query('SELECT brand_context,content_goal,pillars_json FROM content_planners WHERE id=$1', [plannerId])).rows[0];
  assert.deepEqual(snapshot, { brand_context: 'Context A', content_goal: 'Goal A', pillars_json: '["Pilar A"]' });
  console.log('Brand Editorial defaults regression test passed: normalization, dirty guard, tenant isolation, backward compatibility, persistence, and snapshot.');
} finally {
  await client.query('DELETE FROM content_planners WHERE id=$1', [plannerId]).catch(() => {});
  await client.query('DELETE FROM brand_profiles WHERE id=ANY($1)', [[brandA, brandB, legacyBrand]]).catch(() => {});
  await client.query('DELETE FROM tenants WHERE id=$1', [tenantB]).catch(() => {});
  await client.end();
}
