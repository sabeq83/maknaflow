import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDynamicStoryCurveGuideline } from '../lib/kb/dynamic-story-curve.js';
import { MODULE_MODEL_MATRIX } from '../lib/gemini.js';
import { buildOrganicPillarPrompt, buildReverseEngineeringPrompt } from '../lib/prompts.js';

test('1. Dynamic Story Curve generates correct proportional guidelines', (t) => {
  // Test 3 clips Brand Editorial
  const editorial3 = buildDynamicStoryCurveGuideline({
    campaignKind: 'brand_editorial',
    targetClips: 3,
    language: 'id-ID'
  });
  assert.ok(editorial3.includes('DYNAMIC STORY CURVE'), 'Must include header');
  assert.ok(editorial3.includes('Tepat 3 adegan berurutan'), 'Must specify 3 clips');
  assert.ok(editorial3.includes('KLIP 1 (HOOK'), 'Must have Clip 1 Hook');
  assert.ok(editorial3.includes('KLIP 2 SAMPAI 2'), 'Must have progression for middle clip');
  assert.ok(editorial3.includes('KLIP 3 (RESOLUTION & CALL TO ACTION)'), 'Must end with Clip 3 CTA');

  // Test 5 clips Product Campaign
  const product5 = buildDynamicStoryCurveGuideline({
    campaignKind: 'product_campaign',
    targetClips: 5,
    language: 'id-ID'
  });
  assert.ok(product5.includes('Tepat 5 adegan berurutan'), 'Must specify 5 clips');
  assert.ok(product5.includes('KLIP 2 SAMPAI 4'), 'Must have progression for clips 2-4');
  assert.ok(product5.includes('KLIP 5 (RESOLUTION & CALL TO ACTION)'), 'Must end with Clip 5 CTA');

  // Test 8 clips Multiplier with bridge at clip 4
  const multiplier8 = buildDynamicStoryCurveGuideline({
    campaignKind: 'multiplier',
    targetClips: 8,
    bridgeAtClip: 4,
    language: 'id-ID'
  });
  assert.ok(multiplier8.includes('Tepat 8 adegan berurutan'), 'Must specify 8 clips');
  assert.ok(multiplier8.includes('Titik Bridging Alami (Klip #4)'), 'Must anchor bridging at clip 4');
  assert.ok(multiplier8.includes('KLIP 8 (RESOLUTION & CALL TO ACTION)'), 'Must end with Clip 8 CTA');
});

test('2. Gemini MODULE_MODEL_MATRIX bypasses Master KB for all creative workflows', (t) => {
  assert.equal(MODULE_MODEL_MATRIX.BRAND_EDITORIAL_CREATIVE.useKB, false);
  assert.equal(MODULE_MODEL_MATRIX.PRODUCT_CAMPAIGN_CREATIVE.useKB, false);
  assert.equal(MODULE_MODEL_MATRIX.RECIPE_CAMPAIGN_CREATIVE.useKB, false);
  assert.equal(MODULE_MODEL_MATRIX.RE_CAMPAIGN.useKB, false);
  assert.equal(MODULE_MODEL_MATRIX.MULTIPLIER_LAB.useKB, false);
  assert.equal(MODULE_MODEL_MATRIX.BRIDGE_INJECT.useKB, false);
});

test('3. buildOrganicPillarPrompt produces zero-bloat prompt for Brand Editorial and Product Campaign', (t) => {
  const dummyKBs = [
    { name: 'PROMPT_SYSTEM_v47.9.md', content: 'X'.repeat(50000) },
    { name: 'REALIST_VIRAL_NARRATIVE_v47.9.md', content: 'Y'.repeat(30000) },
    { name: 'STRATEGIC_FRAMEWORKS_v47.9.md', content: 'Z'.repeat(20000) },
    { name: 'BRAND_VOICE_GUIDE_en.md', content: 'Authentic warm tone voice' },
    { name: 'COMPLIANCE_GUIDE.md', content: 'Strict zero medical claim rule' }
  ];

  const editorialCampaign = {
    campaign_name: 'Mindful Morning Routine',
    content_kind: 'brand_editorial',
    content_pillar: 'Brand Editorial',
    target_clips_count: 4,
    target_language: 'id-ID'
  };

  const editorialPrompt = buildOrganicPillarPrompt(dummyKBs, editorialCampaign, null, null, null);
  // Prompt MUST NOT contain the 100KB dumped KBs
  assert.ok(!editorialPrompt.includes('X'.repeat(1000)), 'Must not contain dumped PROMPT_SYSTEM');
  assert.ok(!editorialPrompt.includes('Y'.repeat(1000)), 'Must not contain dumped REALIST_VIRAL_NARRATIVE');
  assert.ok(editorialPrompt.includes('DYNAMIC STORY CURVE SPECIFICATION'), 'Must include Dynamic Story Curve');
  assert.ok(editorialPrompt.length < 25000, `Editorial prompt must be compact (was ${editorialPrompt.length} chars)`);

  const productCampaign = {
    campaign_name: 'Air Fryer Crisper Demo',
    content_kind: 'product_campaign',
    content_pillar: 'Product Campaign',
    target_clips_count: 5,
    target_language: 'id-ID'
  };
  const productData = {
    product_name: 'CrispMax Air Fryer',
    unique_selling_point: 'Rapid 360 Heat Circulation'
  };

  const productPrompt = buildOrganicPillarPrompt(dummyKBs, productCampaign, productData, null, null);
  assert.ok(!productPrompt.includes('X'.repeat(1000)), 'Must not contain dumped PROMPT_SYSTEM');
  assert.ok(productPrompt.includes('DYNAMIC STORY CURVE SPECIFICATION'), 'Must include Dynamic Story Curve');
  assert.ok(productPrompt.length < 25000, `Product prompt must be compact (was ${productPrompt.length} chars)`);
});

test('4. buildReverseEngineeringPrompt produces zero-bloat prompt for Multiplier with VSO', (t) => {
  const dummyKBs = [
    { name: 'PROMPT_SYSTEM_v47.9.md', content: 'A'.repeat(50000) },
    { name: 'REALIST_VIRAL_NARRATIVE_v47.9.md', content: 'B'.repeat(30000) }
  ];

  const reConfig = {
    visual_mode: 'hybrid_lock',
    target_clips_count: 6,
    bridge_at_clip: 3,
    bridge_duration_clips: 2,
    target_language: 'id-ID'
  };

  const rePrompt = buildReverseEngineeringPrompt(dummyKBs, reConfig);
  assert.ok(!rePrompt.includes('A'.repeat(1000)), 'Must not contain dumped PROMPT_SYSTEM');
  assert.ok(rePrompt.includes('DYNAMIC STORY CURVE SPECIFICATION (6 KLIP)'), 'Must include 6 clips dynamic curve');
  assert.ok(rePrompt.length < 15000, `RE prompt must be compact (was ${rePrompt.length} chars)`);
});
