import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMultiplierPhase2Prompt,
  cleanYoutubeTitle,
  getRecipeMandateSection,
  YT_SHORTS_HIGH_CTR_TITLE_MANDATE
} from '../lib/prompts.js';

test('Multiplier Lab: buildMultiplierPhase2Prompt includes Recipe Mandate & High-CTR Title when generate_recipe is 1 or true', () => {
  const dummyStoryboard = [
    { scene: 1, narration_transcript: 'Rebus rimpang jahe dan serai...', visual_description: 'Panci mendidih' },
    { scene: 2, narration_transcript: 'Saring dan tambahkan madu murni...', visual_description: 'Menuang ke gelas' }
  ];
  const dummyProductDNA = {
    product_name: 'Madu Hutan Alami',
    unique_selling_point: '100% murni tanpa pengawet',
    product_description: 'Madu herbal kaya enzim'
  };
  const dummyAesthetics = {
    clipDuration: 8,
    targetDemographic: 'indonesian_casual'
  };
  const dummyBridging = {
    targetClipsCount: 2,
    isBridgingActive: true,
    bridgeAtClip: 1,
    generate_recipe: 1
  };
  const dummyVso = {
    isVsoActive: false
  };
  const dummyAudio = {
    enableTts: true,
    targetLanguage: 'id-ID'
  };

  // Case 1: Active via bridging.generate_recipe = 1
  const promptActive = buildMultiplierPhase2Prompt(
    dummyStoryboard,
    dummyProductDNA,
    dummyAesthetics,
    dummyBridging,
    dummyVso,
    dummyAudio
  );

  assert.match(promptActive, /RECIPE & HERBAL CONCOCTION MANDATE \[AKTIF\]/);
  assert.match(promptActive, /YOUTUBE SHORTS HIGH-CTR TITLE MANDATE \[STRICT\]/);
  assert.match(promptActive, /"yt_title":/);
  assert.match(promptActive, /Teks resep\/racikan lengkap \(Bahan & Takaran, Langkah Pembuatan/);

  // Case 2: Inactive via bridging.generate_recipe = 0
  const promptInactive = buildMultiplierPhase2Prompt(
    dummyStoryboard,
    dummyProductDNA,
    dummyAesthetics,
    { ...dummyBridging, generate_recipe: 0 },
    dummyVso,
    dummyAudio
  );

  assert.doesNotMatch(promptInactive, /RECIPE & HERBAL CONCOCTION MANDATE \[AKTIF\]/);
  assert.match(promptInactive, /YOUTUBE SHORTS HIGH-CTR TITLE MANDATE \[STRICT\]/);
  assert.match(promptInactive, /"yt_title":/);
  assert.match(promptInactive, /Teks caption media sosial baru yang menarik dengan hashtag/);
});

test('Multiplier Lab: buildMultiplierPhase2Prompt recognizes generate_recipe from aesthetics or audio', () => {
  const dummyStoryboard = [{ scene: 1, narration_transcript: 'Test' }];
  const dummyProductDNA = {};
  const dummyBridging = { targetClipsCount: 1, isBridgingActive: false };

  // Passed in aesthetics
  const promptFromAesthetics = buildMultiplierPhase2Prompt(
    dummyStoryboard,
    dummyProductDNA,
    { generate_recipe: true },
    dummyBridging,
    {},
    {}
  );
  assert.match(promptFromAesthetics, /RECIPE & HERBAL CONCOCTION MANDATE \[AKTIF\]/);

  // Passed in audio
  const promptFromAudio = buildMultiplierPhase2Prompt(
    dummyStoryboard,
    dummyProductDNA,
    {},
    dummyBridging,
    {},
    { generateRecipe: true }
  );
  assert.match(promptFromAudio, /RECIPE & HERBAL CONCOCTION MANDATE \[AKTIF\]/);
});

test('Multiplier Lab: cleanYoutubeTitle works seamlessly for Multiplier titles', () => {
  // Case: Raw title with hanging words before #Shorts
  const rawTitle = '3 Racikan Rimpang Bikin Badan Segar Sama Seperti #Shorts';
  const cleaned = cleanYoutubeTitle(rawTitle);
  assert.equal(cleaned, '3 Racikan Rimpang Bikin Badan Segar #Shorts');

  // Case: Missing #Shorts tag
  const rawWithoutTag = 'Rahasia Nenek Moyang Redakan Masuk Angin';
  const cleaned2 = cleanYoutubeTitle(rawWithoutTag);
  assert.equal(cleaned2, 'Rahasia Nenek Moyang Redakan Masuk Angin #Shorts');

  // Case: Empty title fallback to narration transcript
  const fallbackVo = 'Jangan buang kulit nanas ini karena kaya bromelain';
  const cleanedFallback = cleanYoutubeTitle('', fallbackVo);
  assert.equal(cleanedFallback, 'Jangan buang kulit nanas ini karena kaya bromelain #Shorts');
});
