import test from 'node:test';
import assert from 'node:assert/strict';
import { VISUAL_STYLES, FACE_VISIBILITY_OPTIONS, NARRATIVE_MODES, getVisualStylePromptTokens } from '../lib/visual-style-constants.js';
import { FFMPEG_SYNC_PRESETS, WORDS_PER_CLIP_PRESETS, SYNC_MODES } from '../lib/sync-constants.js';
import { KNOWN_NICHE_KBS, getAvailableNicheKBs } from '../lib/niche-constants.js';
import { getComplianceMandate, BANNED_HEALTH_CLAIMS } from '../lib/compliance-constants.js';

test('lib/visual-style-constants exports valid visual styles, visibility, and narrative modes', () => {
  assert.ok(Array.isArray(VISUAL_STYLES) && VISUAL_STYLES.length >= 7);
  assert.ok(Array.isArray(FACE_VISIBILITY_OPTIONS) && FACE_VISIBILITY_OPTIONS.length >= 4);
  assert.ok(Array.isArray(NARRATIVE_MODES) && NARRATIVE_MODES.length >= 3);

  const cinematicTokens = getVisualStylePromptTokens('Cinematic');
  assert.ok(cinematicTokens.includes('cinematic 4k film'));
});

test('lib/sync-constants exports valid FFmpeg sync and words per clip presets', () => {
  assert.ok(Array.isArray(FFMPEG_SYNC_PRESETS) && FFMPEG_SYNC_PRESETS.length >= 5);
  assert.ok(Array.isArray(WORDS_PER_CLIP_PRESETS) && WORDS_PER_CLIP_PRESETS.length >= 3);
  assert.ok(Array.isArray(SYNC_MODES) && SYNC_MODES.length >= 4);

  const smartSync = FFMPEG_SYNC_PRESETS.find(p => p.id === 'smart_sync');
  assert.ok(smartSync);
  assert.ok(smartSync.label.includes('Smart Dynamic Sync'));
});

test('lib/niche-constants exports known niche KBs', () => {
  assert.ok(Array.isArray(KNOWN_NICHE_KBS) && KNOWN_NICHE_KBS.length >= 8);
  const available = getAvailableNicheKBs();
  assert.ok(Array.isArray(available));
});

test('lib/compliance-constants exports bilingual compliance mandates and banned claims', () => {
  const mandateId = getComplianceMandate('id-ID');
  assert.ok(mandateId.includes('TIKTOK SHOP COMPLIANCE'));
  assert.ok(mandateId.includes('DILARANG'));

  const mandateEn = getComplianceMandate('en-US');
  assert.ok(mandateEn.includes('TIKTOK SHOP COMPLIANCE'));
  assert.ok(mandateEn.includes('FORBIDDEN'));

  assert.ok(Array.isArray(BANNED_HEALTH_CLAIMS) && BANNED_HEALTH_CLAIMS.length >= 10);
});
