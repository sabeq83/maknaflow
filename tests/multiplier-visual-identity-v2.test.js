import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMultiplierPhase2Prompt } from '../lib/prompts.js';

test('1. Multiplier Prompt Builder injects V2 Nutribake environment, wardrobe, and guardrails', () => {
  const originalStoryboard = [
    { scene: 1, visual_description: 'Cake prep', narration_transcript: 'Jam 3 sore ngantuk?' }
  ];
  const productDNA = {
    is_pure_storytelling: true,
    product_name: '',
    product_description: 'Mousse cake pisang'
  };
  const aesthetics = {
    aspectRatio: '9:16',
    clipDuration: 4
  };
  const bridging = {
    campaign_type: 'pure_storytelling',
    isBridgingActive: false,
    visualMode: 'hybrid_lock',
    targetClipsCount: 8,
    bridgeAtClip: 6
  };
  const audio = {
    targetLanguage: 'id-ID'
  };

  const vsoNutribake = {
    isVsoActive: true,
    characterConcept: 'faceless',
    subjectDemographic: 'custom',
    subjectDemographicCustom: 'Minimalist out-of-focus hand movement in creamy background bokeh (f/1.4), keeping 100% visual focus on rich chocolate ganache, dough texture, and crumb fractures.',
    wardrobeStyle: 'custom',
    wardrobeStyleCustom: 'Clean oatmeal cotton rolled sleeves, soft-blurred in creamy bokeh background',
    lightingStyle: 'custom',
    lightingStyleCustom: 'Bright modern architectural morning daylight with soft even ambient fill',
    environmentPrompt: 'Pristine modern kitchen island with seamless flat matte warm-grey quartz countertop, strictly zero marble veining',
    negativePrompt: 'visible human face, human portrait, human face, syari dress, white marble veining, rough black slate, herbal amber medicine bottles, greasy surfaces'
  };

  const prompt = buildMultiplierPhase2Prompt(
    originalStoryboard,
    productDNA,
    aesthetics,
    bridging,
    vsoNutribake,
    audio,
    0
  );

  // Verifikasi anchor meja quartz bebas marmer
  assert.ok(prompt.includes('seamless flat matte warm-grey quartz countertop'), 'Meja warm-grey quartz wajib masuk prompt');
  assert.ok(prompt.includes('strictly zero marble veining'), 'Larangan urat marmer wajib masuk prompt');

  // Verifikasi busana oatmeal dan subject faceless
  assert.ok(prompt.includes('Clean oatmeal cotton rolled sleeves'), 'Busana katun oatmeal wajib masuk prompt');
  assert.ok(prompt.includes('Minimalist out-of-focus hand movement'), 'Subject faceless hands-only wajib masuk prompt');

  // Verifikasi negative guardrails
  assert.ok(prompt.includes('Strict Negative Guardrails / Prohibited:'), 'Header negative guardrails wajib ada');
  assert.ok(prompt.includes('syari dress'), 'Larangan busana syari wajib tercantum');
  assert.ok(prompt.includes('white marble veining'), 'Larangan marmer wajib tercantum');

  // Verifikasi pembersihan total elemen syari/hijab lama
  assert.ok(!prompt.includes('[Hijab/Wardrobe Style]'), 'String hardcoded [Hijab/Wardrobe Style] DILARANG ada');
  assert.ok(!prompt.includes('syari_classic'), 'Kunci syari_classic DILARANG ada');
  assert.ok(!prompt.includes('Amber Haze & Terracotta'), 'Warna Terracotta syari DILARANG ada');
  assert.ok(!prompt.includes('a graceful Muslimah'), 'Persona graceful Muslimah DILARANG ada');
});

test('2. Multiplier Prompt Builder template placeholder is generic', () => {
  const originalStoryboard = [{ scene: 1, visual_description: 'test', narration_transcript: 'test' }];
  const productDNA = { is_pure_storytelling: true };
  const aesthetics = { aspectRatio: '9:16' };
  const bridging = { visualMode: 'hybrid_lock', targetClipsCount: 4 };
  const audio = {};
  const emptyVso = { isVsoActive: false };

  const prompt = buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, emptyVso, audio, 0);
  assert.ok(!prompt.includes('[Hijab/Wardrobe Style]'), 'Placeholder wajib generic: [Wardrobe/Attire Details]');
  assert.ok(prompt.includes('[Wardrobe/Attire Details]'), 'Harus menggunakan [Wardrobe/Attire Details]');
  setTimeout(() => process.exit(0), 100);
});
