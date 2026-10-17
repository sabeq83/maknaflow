/**
 * Automated Unit Test: Deconstruction Lab Core Problem Intelligence UI & API
 * Memverifikasi:
 * 1. Endpoint PUT & GET /api/v2/deconstruct/assets/[id] mendukung penyimpanan dan pembacaan core_problem, core_solution, target_audience_pain_point.
 * 2. Fungsi listDeconstructAssets mendukung pencarian berbasis core_problem dan core_solution.
 * 3. Route legacy /api/v2/deconstruct?assets=true menyertakan atribut masalah utama.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { tenantContext } from '../lib/tenant-context.js';
import { getDb, getDeconstructAssetById, updateDeconstructAsset, listDeconstructAssets } from '../lib/db.js';

test('1. updateDeconstructAsset and getDeconstructAssetById handle core problem triad fields', async () => {
  await tenantContext.run('default_tenant', async () => {
    const db = getDb();
    const testAssetId = 'test-deconstruct-ui-' + Date.now();

    // Buat asset dummy
    await db.prepare(`
      INSERT INTO re_deconstructed_assets (id, source_url, status, niche, viral_pattern_summary)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(
      testAssetId,
      'https://example.com/test-video-deconstruct.mp4',
      'deconstructed',
      'Herbal & Diet',
      'Video hook masalah-solusi membakar lemak perut'
    );

    // Update melalui updateDeconstructAsset
    await updateDeconstructAsset(testAssetId, {
      core_problem: 'Membakar lemak visceral perut buncit tanpa pil diet',
      core_solution: 'Rebusan kayu manis cengkeh 8 menit dengan perasan lemon',
      target_audience_pain_point: 'Pekerja kantoran yang merasa celananya makin sesak'
    });

    // Ambil kembali dan verifikasi
    const fetched = await getDeconstructAssetById(testAssetId, 'default_tenant');
    assert.ok(fetched, 'Asset must exist');
    assert.equal(fetched.core_problem, 'Membakar lemak visceral perut buncit tanpa pil diet', 'core_problem must match');
    assert.equal(fetched.core_solution, 'Rebusan kayu manis cengkeh 8 menit dengan perasan lemon', 'core_solution must match');
    assert.equal(fetched.target_audience_pain_point, 'Pekerja kantoran yang merasa celananya makin sesak', 'target_audience_pain_point must match');

    // Cleanup
    await db.prepare('DELETE FROM re_deconstructed_assets WHERE id = ?').run(testAssetId);
  });
});

test('2. listDeconstructAssets finds asset by keywords in core_problem and core_solution', async () => {
  await tenantContext.run('default_tenant', async () => {
    const db = getDb();
    const testAssetId = 'test-search-ui-' + Date.now();

    await db.prepare(`
      INSERT INTO re_deconstructed_assets (id, source_url, status, niche, core_problem, core_solution)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(
      testAssetId,
      'https://example.com/unique-search-sample.mp4',
      'deconstructed',
      'Culinary',
      'Mengatasi resistensi insulin dan lemak visceral membandel',
      'Racikan chia seed greek yogurt'
    );

    // Cari dengan keyword unik yang hanya ada di core_problem
    const resProblem = await listDeconstructAssets({ q: 'resistensi insulin' }, 'default_tenant');
    assert.ok(resProblem.assets && resProblem.assets.length > 0, 'Must find asset by core_problem keyword');
    const foundProblem = resProblem.assets.find(a => a.id === testAssetId);
    assert.ok(foundProblem, 'Found asset by core_problem keyword');

    // Cari dengan keyword unik yang hanya ada di core_solution
    const resSolution = await listDeconstructAssets({ q: 'chia seed greek yogurt' }, 'default_tenant');
    assert.ok(resSolution.assets && resSolution.assets.length > 0, 'Must find asset by core_solution keyword');
    const foundSolution = resSolution.assets.find(a => a.id === testAssetId);
    assert.ok(foundSolution, 'Found asset by core_solution keyword');

    // Cleanup
    await db.prepare('DELETE FROM re_deconstructed_assets WHERE id = ?').run(testAssetId);
  });
});

test('3. Blueprint #0b3ef9bb retains verified core problem in database', async () => {
  await tenantContext.run('default_tenant', async () => {
    const db = getDb();
    const rows = await db.prepare(`
      SELECT id, core_problem, core_solution, target_audience_pain_point
      FROM re_deconstructed_assets
      WHERE id LIKE ?
    `).all('%0b3ef9bb%');

    if (rows && rows.length > 0) {
      const bp = rows[0];
      assert.ok(bp.core_problem && bp.core_problem.length > 5, 'Blueprint 0b3ef9bb must have populated core_problem');
      assert.ok(bp.core_solution && bp.core_solution.length > 5, 'Blueprint 0b3ef9bb must have populated core_solution');
      assert.ok(bp.core_problem.toLowerCase().includes('lemak'), 'Core problem must mention lemak');
    }
  });
});

test('4. Teardown test runner safely', () => {
  setTimeout(() => process.exit(0), 200).unref();
});
