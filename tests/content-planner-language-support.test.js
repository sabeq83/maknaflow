import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../lib/db.js';
import { normalizePlannerLanguage, SUPPORTED_PLANNER_LANGUAGES } from '../lib/content-planner-contract.js';
import { createDraftContentPlanner } from '../lib/content-planner-engine.js';

test('Content Planner Target Language Contract & Normalization', () => {
  assert.deepEqual(SUPPORTED_PLANNER_LANGUAGES, ['id-ID', 'en-US']);
  assert.equal(normalizePlannerLanguage('id-ID'), 'id-ID');
  assert.equal(normalizePlannerLanguage('en-US'), 'en-US');
  assert.equal(normalizePlannerLanguage('EN-US'), 'en-US');
  assert.equal(normalizePlannerLanguage('en'), 'en-US');
  assert.equal(normalizePlannerLanguage('id'), 'id-ID');
  assert.equal(normalizePlannerLanguage('ID-id'), 'id-ID');
  assert.equal(normalizePlannerLanguage(null), 'id-ID');
  assert.equal(normalizePlannerLanguage(undefined), 'id-ID');
  assert.equal(normalizePlannerLanguage('unknown-LANG'), 'id-ID');
});

test('createDraftContentPlanner stores and returns target_language correctly', async () => {
  const db = getDb();

  // Test 1: Draft with explicit 'en-US'
  const enDraft = await createDraftContentPlanner({
    title: 'Test English Planner HabitFolk',
    account_name: 'HabitFolk',
    planner_focus: 'brand_editorial',
    target_language: 'en-US',
    brand_context: 'Small habits. Better together.',
    content_goal: 'Promote healthy daily rituals and mindful living.',
    pillars: ['Mindful Habits', 'Morning Rituals', 'Clean Living'],
    planner_count: 6,
    tenant_id: 'default_tenant'
  });

  assert.ok(enDraft.id, 'Draft should return generated id');
  assert.equal(enDraft.target_language, 'en-US', 'Returned draft must have target_language en-US');

  const enRecord = await db.prepare('SELECT id, title, target_language FROM content_planners WHERE id = ?').get(enDraft.id);
  assert.ok(enRecord, 'DB record must exist');
  assert.equal(enRecord.target_language, 'en-US', 'DB record must store target_language en-US');

  // Test 2: Draft with default/unspecified language falls back to 'id-ID'
  const idDraft = await createDraftContentPlanner({
    title: 'Test Default Indonesian Planner',
    account_name: 'AkunLokal',
    planner_focus: 'brand_editorial',
    brand_context: 'Produk herbal lokal untuk kesehatan sehari-hari.',
    content_goal: 'Edukasi masyarakat tentang khasiat herbal alami.',
    pillars: ['Herbal Sehat', 'Resep Alami'],
    planner_count: 4,
    tenant_id: 'default_tenant'
  });

  assert.ok(idDraft.id, 'Draft should return generated id');
  assert.equal(idDraft.target_language, 'id-ID', 'Default language must be id-ID');

  const idRecord = await db.prepare('SELECT id, title, target_language FROM content_planners WHERE id = ?').get(idDraft.id);
  assert.ok(idRecord, 'DB record must exist');
  assert.equal(idRecord.target_language, 'id-ID', 'DB record must store target_language id-ID');

  // Clean up test records
  await db.prepare('DELETE FROM content_planners WHERE id IN (?, ?)').run(enDraft.id, idDraft.id);
});
