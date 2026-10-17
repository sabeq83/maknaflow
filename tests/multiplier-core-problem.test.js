/**
 * Unit Test: Multiplier Lab Core Problem & Content Planner Matrix Continuity
 * Memverifikasi:
 * 1. Ekstraksi DNA Blueprint (coreProblem, coreSolution, targetAudiencePainPoint).
 * 2. Heuristik Backfill Masalah Utama.
 * 3. Injeksi Penguncian Masalah Utama pada Phase 2 Remake Prompt.
 * 4. Integrasi Matriks Content Planner (CEP, W's Matrix, Strategic Archetype, Flex Angles 3-20).
 * 5. Data Lineage & Payload Preservation pada pembuatan batch Multiplier.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBlueprintAnchorDNA } from '../lib/multiplier-angle-generator.js';
import { extractCoreProblemHeuristics } from '../scripts/backfill-blueprint-core-problems.mjs';
import { buildMultiplierPhase2Prompt } from '../lib/prompts.js';
import { tenantContext } from '../lib/tenant-context.js';
import { getDb, createMultiplierBatchWithTasks, getMultiplierTasksByBatchId } from '../lib/db.js';

test('1. extractBlueprintAnchorDNA reads explicit core_problem or falls back gracefully', () => {
  // Kasus A: Blueprint memiliki core_problem eksplisit
  const explicitBp = {
    id: 'test-bp-1',
    viral_pattern_summary: 'Video viral minuman segar.',
    core_problem: 'Membakar lemak perut buncit tanpa pil diet kimia',
    core_solution: 'Rebusan kayu manis lemon',
    target_audience_pain_point: 'Orang yang ingin mengecilkan lingkar pinggang'
  };

  const dnaA = extractBlueprintAnchorDNA(explicitBp, []);
  assert.equal(dnaA.coreProblem, 'Membakar lemak perut buncit tanpa pil diet kimia');
  assert.equal(dnaA.coreSolution, 'Rebusan kayu manis lemon');
  assert.equal(dnaA.targetAudiencePainPoint, 'Orang yang ingin mengecilkan lingkar pinggang');

  // Kasus B: Blueprint lama tanpa core_problem (fallback parsing dari summary / scene 1)
  const legacyBp = {
    id: 'test-bp-2',
    viral_pattern_summary: 'Video ini menggunakan hook masalah-solusi yang kuat terkait pembakaran lemak perut tanpa obat kimia.'
  };
  const legacySb = [
    {
      scene: 1,
      narration_transcript: 'Minuman kayu manis lemon ini bantu rontokkan lemak perut dengan cepat...'
    }
  ];

  const dnaB = extractBlueprintAnchorDNA(legacyBp, legacySb);
  assert.ok(dnaB.coreProblem.toLowerCase().includes('lemak') || dnaB.coreProblem.toLowerCase().includes('pembakaran'),
    `Expected coreProblem to contain 'lemak' or 'pembakaran', got: "${dnaB.coreProblem}"`);
});

test('2. extractCoreProblemHeuristics extracts sharp pain points and solutions', () => {
  // Test Kasus Blueprint Kasus Nyata #0b3ef9bb
  const bp0b3 = {
    viral_pattern_summary: "Video ini menggunakan hook masalah-solusi yang kuat terkait pembakaran lemak perut tanpa obat kimia, menargetkan audiens yang ingin kurus secara alami.",
    original_storyboard_json: JSON.stringify([
      { narration_transcript: "Minuman kayu manis lemon ini bantu rontokkan lemak perut dengan cepat tanpa perlu obat pelangsing kimia..." }
    ])
  };

  const res0b3 = extractCoreProblemHeuristics(bp0b3);
  assert.ok(res0b3.core_problem.toLowerCase().includes('rontokkan lemak perut') || res0b3.core_problem.toLowerCase().includes('lemak'),
    `Expected core_problem to mention lemak perut, got: "${res0b3.core_problem}"`);
  assert.ok(res0b3.core_solution.toLowerCase().includes('kayu manis') || res0b3.core_solution.toLowerCase().includes('lemon'),
    `Expected core_solution to mention kayu manis/lemon, got: "${res0b3.core_solution}"`);
  assert.ok(res0b3.target_audience_pain_point.toLowerCase().includes('kurus') || res0b3.target_audience_pain_point.toLowerCase().includes('audiens'),
    `Expected audience to be captured, got: "${res0b3.target_audience_pain_point}"`);

  // Test Kasus Nyeri Sendi
  const bpJoint = {
    original_storyboard_json: JSON.stringify([
      { narration_transcript: "Never use this secret remedy until you want to help with knee and joint pain naturally." }
    ])
  };
  const resJoint = extractCoreProblemHeuristics(bpJoint);
  assert.ok(resJoint.core_problem.toLowerCase().includes('knee and joint pain') || resJoint.core_problem.toLowerCase().includes('sendi'),
    `Expected joint pain, got: "${resJoint.core_problem}"`);

  // Test Kasus Memory Otak
  const bpMemory = {
    original_storyboard_json: JSON.stringify([
      { narration_transcript: "I'm going to show you how to improve your memory and brain focus." }
    ])
  };
  const resMemory = extractCoreProblemHeuristics(bpMemory);
  assert.ok(resMemory.core_problem.toLowerCase().includes('memory') || resMemory.core_problem.toLowerCase().includes('otak'),
    `Expected memory/otak, got: "${resMemory.core_problem}"`);
});

test('3. buildMultiplierPhase2Prompt injects strict core problem continuity directive', () => {
  const dummyStoryboard = [
    { scene: 1, visual_description: 'Merebus kayu manis di panci kecil', voice_over: 'Racikan alami pembakar lemak' }
  ];

  const bridging = {
    core_problem: 'Membakar dan merontokkan lemak perut membandel secara alami',
    category_cep: 'Problem-Solution',
    ws_matrix: 'When (Pagi Hari) + While (Sebelum Ngantor)',
    strategic_archetype: 'The Cost of Inaction',
    angleTitle: 'Bahaya Lemak Visceral yang Sering Diabaikan Pekerja Kantoran',
    hookType: 'Shocking Statistic Hook',
    hookText: 'Tahu nggak kalau lemak perut buncit itu 3x lebih cepat memicu resistensi insulin?',
    targetPersona: 'Pekerja kantoran usia 25-40 tahun',
    emotionalTrigger: 'Kekhawatiran kesehatan & kancing celana makin sesak'
  };

  const prompt = buildMultiplierPhase2Prompt(
    dummyStoryboard,
    { product_name: '' }, // non-product storytelling
    {},
    bridging,
    {},
    {}
  );

  // Verifikasi bahwa core_problem disuntikkan ke dalam bagian data topik
  assert.ok(prompt.includes('Membakar dan merontokkan lemak perut membandel secara alami'),
    'Phase 2 prompt must contain the exact core_problem');
  assert.ok(prompt.includes('The Cost of Inaction'), 'Phase 2 prompt must contain the strategic archetype');
  assert.ok(prompt.includes('Problem-Solution'), 'Phase 2 prompt must contain category_cep');
  assert.ok(prompt.includes('Konsistensi Masalah Utama (Strict Core Problem Continuity)'),
    'Phase 2 prompt must enforce strict core problem continuity rule');
});

test('4. createMultiplierBatch preserves core_problem and Content Planner matrix metadata', async () => {
  await tenantContext.run('default_tenant', async () => {
    const db = getDb();

    // Pastikan ada blueprint dummy untuk foreign key / testing
    const testBpId = 'test-bp-matrix-' + Date.now();
    await db.prepare(`
      INSERT INTO re_deconstructed_assets (id, source_url, status, viral_pattern_summary, core_problem, core_solution, target_audience_pain_point)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(
      testBpId,
      'https://example.com/test-video.mp4',
      'deconstructed',
      'Testing matrix continuity',
      'Membakar lemak visceral alami',
      'Kayu manis lemon',
      'Pekerja kantoran'
    );

    const batchId = 'mul_test_' + Date.now();
    const batchData = {
      batch_id: batchId,
      campaign_name: 'Test Matrix Continuity ' + Date.now(),
      mode: '1_to_multi',
      shared_config: {},
      rows: [
        {
          deconstruct_asset_id: testBpId,
          campaign_type: 'pure_storytelling',
          angle_title: 'Siasat Bakar Lemak Sebelum Ngantor',
          category_cep: 'Routine',
          ws_matrix: 'When (Pagi) + While (Sebelum Ngantor)',
          strategic_archetype: 'The Habit Stacking',
          hook_type: 'Relatable Story',
          hook_text: 'Tiap pagi buru-buru berangkat tapi kancing celana sesak?',
          target_persona: 'Pekerja Sibuk',
          emotional_trigger: 'Minder dengan perut buncit',
          cta_type: 'Komen MAU RESEP',
          core_problem: 'Membakar lemak visceral alami'
        }
      ]
    };

    const createdBatchId = await createMultiplierBatchWithTasks(batchData, batchData.rows);
    assert.ok(createdBatchId, 'Batch should be created successfully');

    const tasks = await getMultiplierTasksByBatchId(createdBatchId);
    assert.ok(tasks && tasks.length > 0, 'Batch should have at least 1 task');

    const task = tasks[0];
    const bridging = typeof task.bridging_config_json === 'string'
      ? JSON.parse(task.bridging_config_json)
      : (task.bridging_config_json || {});

    assert.equal(bridging.core_problem, 'Membakar lemak visceral alami', 'Task bridging must retain core_problem');
    assert.equal(bridging.category_cep, 'Routine', 'Task bridging must retain category_cep');
    assert.equal(bridging.ws_matrix, 'When (Pagi) + While (Sebelum Ngantor)', 'Task bridging must retain ws_matrix');
    assert.equal(bridging.strategic_archetype, 'The Habit Stacking', 'Task bridging must retain strategic_archetype');
    assert.equal(bridging.hook_text, 'Tiap pagi buru-buru berangkat tapi kancing celana sesak?', 'Task bridging must retain hook_text');
    assert.equal(task.core_problem, 'Membakar lemak visceral alami', 're_multiplier_tasks table column core_problem must be populated');

    // Cleanup test data
    await db.prepare('DELETE FROM re_multiplier_tasks WHERE batch_id = ?').run(createdBatchId);
    await db.prepare('DELETE FROM re_deconstructed_assets WHERE id = ?').run(testBpId);
  });
});

test('5. Teardown test runner safely', () => {
  setTimeout(() => process.exit(0), 200).unref();
});
