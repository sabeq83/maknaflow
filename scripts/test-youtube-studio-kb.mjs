/**
 * scripts/test-youtube-studio-kb.mjs
 * YouTube Studio KB Foundation — Automated Test Suite (Fase 3.5A)
 * Tests: schema validation, lifecycle transitions, active-revision uniqueness,
 *        tenant isolation, snapshot immutability, scope inheritance, AI mock.
 */

import './local-staging/env.js';

// ── Mock fetch for AI calls ───────────────────────────────────────────────────
const mockChannelProfile = {
  positioning: 'Edukasi keuangan personal untuk generasi muda Indonesia',
  primary_language: 'id-ID',
  tone: 'Friendly, authoritative, clear',
  target_audience_segments: ['Milenial 25-35', 'Fresh graduate', 'Karyawan swasta'],
  content_pillars: ['Investasi', 'Budgeting', 'Side hustle'],
  cta_patterns: 'Subscribe dan aktifkan notifikasi',
  forbidden_claims: 'Jangan klaim return tertentu',
  monetization_direction: 'AdSense + affiliasi produk keuangan',
  narrative_markdown: '## Channel Profile\nChannel ini fokus pada literasi keuangan.',
};

globalThis.fetch = async (url, options) => {
  if (url.includes('generativelanguage.googleapis.com')) {
    return {
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(mockChannelProfile) }]
          }
        }]
      })
    };
  }
  return { ok: true, json: async () => ({ success: true }) };
};

import assert from 'node:assert/strict';

import {
  KB_TYPES,
  assertKbTransition,
  assertKbTypeScope,
  validateKnowledgeBase,
  normalizeKbSnapshot,
} from '../lib/youtube-studio-kb-contract.js';

import {
  listKnowledgeBases,
  createKnowledgeBaseDraft,
  updateKnowledgeBaseDraft,
  activateKbRevision,
  archiveKbRevision,
  getKbRevisions,
  getActiveKbRevision,
  setKbBinding,
  getKbBindings,
  removeKbBinding,
  resolveEpisodeKnowledgeBase,
  createKbSnapshot,
} from '../lib/youtube-studio-kb-repository.js';

import { pgQuery } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import { setSetting } from '../lib/db.js';

const TENANT_A = 'kb_test_tenant_a';
const TENANT_B = 'kb_test_tenant_b';

console.log('🔄 Running YouTube Studio KB Foundation tests...');

async function runTests() {
  try {
    // ── 1. Contract: KB Type Schema Validation ─────────────────────────────
    console.log('  1. Testing KB type schema validation...');

    // Valid channel_profile
    assert.doesNotThrow(() => validateKnowledgeBase('channel_profile', mockChannelProfile));

    // Missing required field
    assert.throws(() => validateKnowledgeBase('channel_profile', {
      ...mockChannelProfile, positioning: ''
    }), /required/);

    // Field too long
    assert.throws(() => validateKnowledgeBase('channel_profile', {
      ...mockChannelProfile, positioning: 'x'.repeat(1001)
    }), /max length/);

    // Unknown KB type
    assert.throws(() => validateKnowledgeBase('unknown_type', {}), /Unknown KB type/);

    console.log('    ✓ Schema validation OK');

    // ── 2. Contract: Lifecycle Transitions ────────────────────────────────
    console.log('  2. Testing KB lifecycle transitions...');

    assert.doesNotThrow(() => assertKbTransition('draft', 'review'));
    assert.doesNotThrow(() => assertKbTransition('draft', 'active')); // shortcut allowed
    assert.doesNotThrow(() => assertKbTransition('review', 'active'));
    assert.doesNotThrow(() => assertKbTransition('active', 'superseded'));
    assert.throws(() => assertKbTransition('archived', 'active'), /cannot transition/);
    assert.throws(() => assertKbTransition('active', 'draft'), /cannot transition/);

    console.log('    ✓ Lifecycle transitions OK');

    // ── 3. Contract: Scope-Type Compatibility ─────────────────────────────
    console.log('  3. Testing scope-type compatibility...');

    assert.doesNotThrow(() => assertKbTypeScope('channel_profile', 'channel'));
    assert.throws(() => assertKbTypeScope('channel_profile', 'series'), /cannot be scoped/);
    assert.doesNotThrow(() => assertKbTypeScope('series_content_guide', 'series'));
    assert.throws(() => assertKbTypeScope('series_content_guide', 'channel'), /cannot be scoped/);
    assert.doesNotThrow(() => assertKbTypeScope('longform_editorial_playbook', 'tenant'));

    console.log('    ✓ Scope-type compatibility OK');

    // ── 4. Contract: normalizeKbSnapshot ─────────────────────────────────
    console.log('  4. Testing normalizeKbSnapshot stage filtering...');

    const sampleKbs = [
      { kb_type: 'channel_profile',            revision_id: 'r1', scope: 'channel', scope_id: 'ch1', content: {} },
      { kb_type: 'visual_continuity_guide',     revision_id: 'r2', scope: 'channel', scope_id: 'ch1', content: {} },
      { kb_type: 'voice_audio_guide',           revision_id: 'r3', scope: 'channel', scope_id: 'ch1', content: {} },
      { kb_type: 'prompt_production_playbook',  revision_id: 'r4', scope: 'channel', scope_id: 'ch1', content: {} },
    ];

    const blueprintSnap = normalizeKbSnapshot(sampleKbs, 'blueprint');
    assert.ok('channel_profile' in blueprintSnap, 'blueprint should include channel_profile');
    assert.ok(!('visual_continuity_guide' in blueprintSnap), 'blueprint should NOT include visual_continuity_guide');

    const productionSnap = normalizeKbSnapshot(sampleKbs, 'production');
    assert.ok('visual_continuity_guide' in productionSnap, 'production should include visual_continuity_guide');
    assert.ok(!('channel_profile' in productionSnap), 'production should NOT include channel_profile');

    console.log('    ✓ KB snapshot normalization OK');

    // ── 5. DB: CRUD, Versioning, Activation ───────────────────────────────
    console.log('  5. Testing DB CRUD, versioning, and active-revision uniqueness...');

    await tenantContext.run(TENANT_A, async () => {
      // Setup tenant
      await pgQuery(
        'INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [TENANT_A, 'KB Test Tenant A']
      );
      await setSetting('gemini_api_key', 'AIzaMockKeyForKbTest');

      const channelId = `kb_ch_${Math.random().toString(36).slice(2, 8)}`;
      await pgQuery(
        `INSERT INTO youtube_channels (id, tenant_id, name, channel_handle) VALUES ($1, $2, 'KB Test Channel', '@kbtest')`,
        [channelId, TENANT_A]
      );

      // Create draft
      const { kb, revision } = await createKnowledgeBaseDraft({
        kbType: 'channel_profile',
        scope: 'channel',
        scopeId: channelId,
        title: 'Test Channel Profile',
        content: mockChannelProfile,
        actor: { username: 'test_user' },
      });

      assert.equal(kb.status, 'draft');
      assert.equal(revision.status, 'draft');
      assert.equal(revision.revision_number, 1);

      // Activate revision
      const activated = await activateKbRevision(revision.id, { username: 'test_user' });
      assert.equal(activated.status, 'active');

      // Add another revision (new draft)
      const rev2 = await updateKnowledgeBaseDraft({
        kbId: kb.id,
        content: { ...mockChannelProfile, tone: 'Professional and warm' },
        actor: { username: 'test_user' },
      });
      assert.equal(rev2.revision_number, 2);
      assert.equal(rev2.status, 'draft');

      // Activate rev2 — should supersede rev1
      await activateKbRevision(rev2.id, { username: 'test_user' });
      const revisions = await getKbRevisions(kb.id);
      const activeRevs = revisions.filter(r => r.status === 'active');
      assert.equal(activeRevs.length, 1, 'Only one revision should be active at a time');
      assert.equal(activeRevs[0].revision_number, 2);

      console.log('    ✓ Active-revision uniqueness enforced');

      // ── 6. Scope Binding & Context Resolution ─────────────────────────
      console.log('  6. Testing scope binding and episode context resolution...');

      await setKbBinding({
        scope: 'channel',
        scopeId: channelId,
        kbId: kb.id,
        actor: { username: 'test_user' },
      });

      const bindings = await getKbBindings({ scope: 'channel', scopeId: channelId });
      assert.equal(bindings.length, 1);
      assert.equal(bindings[0].kb_type, 'channel_profile');

      // Episode resolution (channel only, no series)
      const strategyId = `kb_st_${Math.random().toString(36).slice(2, 8)}`;
      await pgQuery(
        `INSERT INTO youtube_channel_strategies (id, tenant_id, channel_id, status) VALUES ($1, $2, $3, 'active')`,
        [strategyId, TENANT_A, channelId]
      );
      const seriesId = `kb_sr_${Math.random().toString(36).slice(2, 8)}`;
      await pgQuery(
        `INSERT INTO youtube_series (id, tenant_id, channel_id, strategy_id, name) VALUES ($1, $2, $3, $4, 'KB Test Series')`,
        [seriesId, TENANT_A, channelId, strategyId]
      );

      const resolvedKbs = await resolveEpisodeKnowledgeBase({ channelId, seriesId: null });
      assert.equal(resolvedKbs.length, 1, 'Should resolve 1 KB from channel bindings');
      assert.equal(resolvedKbs[0].kb_type, 'channel_profile');

      // Snapshot for blueprint stage
      const snapshot = await createKbSnapshot({ channelId, seriesId: null, stage: 'blueprint' });
      assert.ok('channel_profile' in snapshot, 'Snapshot should contain channel_profile for blueprint');

      console.log('    ✓ Scope binding and context resolution OK');

      // ── 7. Tenant Isolation ────────────────────────────────────────────
      console.log('  7. Testing tenant isolation...');
      const kbList = await listKnowledgeBases({});
      assert.ok(kbList.every(k => k.tenant_id === TENANT_A), 'Tenant A should only see its own KBs');

      console.log('    ✓ Tenant isolation OK');
    });

    // ── 8. Cross-tenant isolation (Tenant B cannot see Tenant A KB) ───────
    await tenantContext.run(TENANT_B, async () => {
      await pgQuery(
        'INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [TENANT_B, 'KB Test Tenant B']
      );
      const kbListB = await listKnowledgeBases({});
      assert.equal(kbListB.length, 0, 'Tenant B should see 0 KBs (tenant isolation)');
      console.log('    ✓ Cross-tenant isolation: Tenant B sees 0 KBs ✓');
    });

    // ── 9. AI mock test (draft never auto-activated) ───────────────────────
    console.log('  9. Testing AI draft generation (mocked)...');
    const { generateKnowledgeBaseDraft } = await import('../lib/youtube-studio-kb-ai.js');

    await tenantContext.run(TENANT_A, async () => {
      await pgQuery('INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [TENANT_A, 'KB Test Tenant A']);
      await setSetting('gemini_api_key', 'AIzaMockKeyForKbTest');

      const aiDraft = await generateKnowledgeBaseDraft({
        kbType: 'channel_profile',
        scope: 'channel',
        brief: { description: 'Edukasi keuangan untuk anak muda Indonesia' },
        locale: 'id-ID',
      });

      assert.equal(aiDraft.status, 'draft', 'AI draft must always be status=draft');
      assert.equal(aiDraft.ai_generated, true);
      assert.ok(aiDraft.content, 'AI draft must have content');
    });

    console.log('    ✓ AI draft always status=draft ✓');

    console.log('\n✅ All YouTube Studio KB Foundation tests passed successfully.\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test execution failed:', err);
    process.exit(1);
  }
}

runTests();
