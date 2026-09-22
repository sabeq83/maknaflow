import test from 'node:test';
import assert from 'node:assert/strict';
import { scanLexicon, auditScriptForTikTok, reviewCreative, reviewPublishing } from '../lib/tiktok-compliance-service.js';

test('TikTok Compliance Zero-Token: scanLexicon detects forbidden words', () => {
  const cleanText = 'Campurkan tepung terigu, cokelat bubuk, dan mentega cair ke dalam loyang.';
  const issuesClean = scanLexicon(cleanText);
  assert.equal(issuesClean.length, 0, 'Clean text should have 0 detected issues');

  const unsafeText = 'Minuman herbal ini terbukti ampuh menyembuhkan diabetes dan aman tanpa efek samping!';
  const issuesUnsafe = scanLexicon(unsafeText);
  assert.ok(issuesUnsafe.length >= 2, 'Unsafe text should detect at least 2 issues');
  assert.ok(issuesUnsafe.some(i => i.category === 'disease_treatment_claim' || i.category === 'restricted_medical_claim'));
  assert.ok(issuesUnsafe.some(i => i.category === 'prohibited_absolute_safety_claim'));
});

test('TikTok Compliance Zero-Token: auditScriptForTikTok bypasses Gemini on clean VO (0 Token)', async () => {
  const cleanVo = 'Langkah pertama, panaskan oven di suhu 180 derajat celsius. Masukkan loyang brownies dan panggang selama 25 menit.';
  const cleanCaption = 'Resep brownies fudgy lumer yang wajib kamu coba di rumah! #Baking #ResepKue';

  const startTime = Date.now();
  const res = await auditScriptForTikTok(cleanVo, cleanCaption);
  const durationMs = Date.now() - startTime;

  assert.equal(res.passed, true);
  assert.equal(res.status, 'pass');
  assert.equal(res.verdict, 'pass');
  assert.equal(res.risk_level, 'low');
  assert.equal(res.detected_issues.length, 0);
  assert.ok(durationMs < 500, `Bypass should execute in under 500ms (took ${durationMs}ms) without calling Gemini or cooldown`);
});

test('TikTok Compliance Zero-Token: reviewCreative bypasses Gemini on clean creative package', async () => {
  const item = { id: 101, product: 'Brownies Fudgy Premix' };
  const creativePackage = {
    creative_direction: { final_hook: 'Bikin brownies shiny crust cuma modal teflon?' },
    voice_over: { master_vo: 'Bikin brownies shiny crust cuma modal teflon? Ini dia rahasianya.' },
    storyboard: [
      { voice_over: 'Lelehkan mentega dan cokelat batang.', on_screen_text: 'Langkah 1: Lelehkan Cokelat' },
      { voice_over: 'Kocok telur dan gula sampai larut sempurna.', on_screen_text: 'Langkah 2: Kocok Telur' }
    ]
  };

  const startTime = Date.now();
  const res = await reviewCreative(item, creativePackage);
  const durationMs = Date.now() - startTime;

  assert.equal(res.status, 'pass');
  assert.equal(res.verdict, 'pass');
  assert.equal(res.human_review_required, false);
  assert.ok(durationMs < 500, `Review creative bypass took ${durationMs}ms`);
});

test('TikTok Compliance Zero-Token: reviewPublishing bypasses Gemini on clean publishing package', async () => {
  const item = { id: 102 };
  const creativePackage = {};
  const publishingPackage = {
    publishing_assets: {
      tiktok: { caption: 'Brownies fudgy lumer anti gagal! #Baking', cta: 'Simpan resep ini yuk!' },
      instagram: { caption: 'Resep praktis brownies shiny crust. Save ya!' }
    }
  };

  const startTime = Date.now();
  const res = await reviewPublishing(item, creativePackage, publishingPackage);
  const durationMs = Date.now() - startTime;

  assert.equal(res.status, 'pass');
  assert.equal(res.verdict, 'pass');
  assert.equal(res.human_review_required, false);
  assert.ok(durationMs < 500, `Review publishing bypass took ${durationMs}ms`);
});
