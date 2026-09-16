process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { interceptQuery, sqliteToPgQuery } from '../lib/db.js';
import { closePgPool } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';

test('Content Planner Multi-Tenant History Digest & Query Interception', async (t) => {
  const testTenant = `mas_ibnu_${crypto.randomBytes(4).toString('hex')}`;
  const testPlannerId = `pln_test_${crypto.randomBytes(4).toString('hex')}`;
  const testProductId = `prod_${crypto.randomBytes(4).toString('hex')}`;

  await t.test('Case 1: JOIN query without explicit tenant_id gets aliased p.tenant_id prefix', () => {
    tenantContext.run(testTenant, () => {
      const q1 = interceptQuery(
        'SELECT r.sequence, r.pillar, r.category_cep, r.ws_matrix, r.context, r.vfo, r.strategic_angle, r.hook FROM content_planner_rows r JOIN content_planners p ON r.planner_id = p.id WHERE p.product_id = ? ORDER BY r.created_at DESC LIMIT ?',
        [testProductId, 60]
      );

      // Verify that interceptQuery added 'p.tenant_id = ?' instead of naked 'tenant_id = ?'
      assert.ok(q1.sql.includes('p.tenant_id = ?'), `Expected 'p.tenant_id = ?' in SQL: ${q1.sql}`);
      assert.ok(!q1.sql.includes('AND tenant_id = ?'), `Should NOT contain ambiguous 'AND tenant_id = ?' in SQL: ${q1.sql}`);
      assert.equal(q1.params[q1.params.length - 2], testTenant);

      // Verify PostgreSQL translation
      const pgSql = sqliteToPgQuery(q1.sql);
      assert.ok(pgSql.includes('p.tenant_id = $2'), `Expected 'p.tenant_id = $2' in PgSQL: ${pgSql}`);
    });
  });

  await t.test('Case 2: Single table query without alias does not use SQL keyword as alias', () => {
    tenantContext.run(testTenant, () => {
      const q2 = interceptQuery(
        'SELECT * FROM content_planners WHERE id = ?',
        [testPlannerId]
      );
      assert.ok(q2.sql.includes('tenant_id = ?'), `Expected tenant_id in SQL: ${q2.sql}`);
      assert.ok(!q2.sql.includes('WHERE.tenant_id'), `Should not have WHERE. prefix: ${q2.sql}`);
      assert.equal(q2.params[1], testTenant);
    });
  });

  await t.test('Case 3: Single table query with AS alias resolves alias correctly', () => {
    tenantContext.run(testTenant, () => {
      const q3 = interceptQuery(
        'SELECT cp.* FROM content_planners AS cp WHERE cp.id = ?',
        [testPlannerId]
      );
      assert.ok(q3.sql.includes('cp.tenant_id = ?'), `Expected cp.tenant_id in SQL: ${q3.sql}`);
      assert.equal(q3.params[1], testTenant);
    });
  });

  await t.test('Case 4: Query with explicit (p.tenant_id = ? OR p.tenant_id IS NULL) skips auto-injection', () => {
    tenantContext.run(testTenant, () => {
      const q4 = interceptQuery(
        'SELECT r.sequence, r.pillar, r.category_cep, r.ws_matrix, r.context, r.vfo, r.strategic_angle, r.hook FROM content_planner_rows r JOIN content_planners p ON r.planner_id = p.id WHERE p.product_id = ? AND (p.tenant_id = ? OR p.tenant_id IS NULL) ORDER BY r.created_at DESC LIMIT ?',
        [testProductId, testTenant, 60]
      );
      const tenantMatches = (q4.sql.match(/tenant_id/g) || []).length;
      assert.equal(tenantMatches, 2, 'Should preserve explicit tenant conditions without double-injecting');
      assert.equal(q4.params.length, 3, 'Should preserve exact 3 parameters');
    });
  });

  await t.test('Case 5: Brand editorial history digest query with explicit p.tenant_id', () => {
    tenantContext.run(testTenant, () => {
      const q5 = interceptQuery(
        'SELECT r.pillar, r.context, r.strategic_angle, r.hook FROM content_planner_rows r JOIN content_planners p ON r.planner_id = p.id WHERE p.planner_focus = ? AND (p.brand_id = ? OR LOWER(p.account_name) = LOWER(?)) AND (p.tenant_id = ? OR p.tenant_id IS NULL) ORDER BY r.created_at DESC LIMIT ?',
        ['brand_editorial', 'brand_123', 'my_brand', testTenant, 90]
      );
      assert.ok(q5.sql.includes('p.tenant_id = ?'), 'Should contain p.tenant_id');
      assert.equal(q5.params.length, 5);
      assert.equal(q5.params[3], testTenant);
    });
  });

  await closePgPool().catch(() => {});
});
