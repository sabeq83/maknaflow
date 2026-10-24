import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMultiplierPhase2Prompt, cleanYoutubeTitle } from '../lib/prompts.js';
import { getDefaultVoicePersona } from '../lib/voice-constants.js';
import { getDemographicInstruction, getDemographicOptions } from '../lib/demographic-constants.js';

test('getDefaultVoicePersona selects appropriate default persona for language and provider', () => {
  // MiniMax
  assert.equal(getDefaultVoicePersona('minimax', 'en-US'), 'English_radiant_girl');
  assert.equal(getDefaultVoicePersona('minimax', 'id-ID'), 'Indonesian_casual_reporter_vv2');
  assert.equal(getDefaultVoicePersona('minimax', ''), 'Indonesian_casual_reporter_vv2');

  // Gemini
  assert.equal(getDefaultVoicePersona('gemini', 'en-US'), 'Puck');
  assert.equal(getDefaultVoicePersona('gemini', 'id-ID'), 'Kore');
});

test('buildMultiplierPhase2Prompt generates pure English directives when en-US is selected', () => {
  const originalStoryboard = [
    { scene: 1, visual_description: 'Pouring chia seeds into a glass jar', narration_transcript: 'Morning routine starts here' },
    { scene: 2, visual_description: 'Adding almond milk and cocoa powder', narration_transcript: 'Rich in antioxidants' },
    { scene: 3, visual_description: 'Stirring until smooth and creamy', narration_transcript: 'Ready for overnight chilling' }
  ];

  const productDNA = {
    is_pure_storytelling: true,
    product_name: '',
    product_description: 'Overnight Chocolate Chia Jar'
  };

  const aesthetics = {
    targetDemographic: 'genz_casual',
    narrativeMode: 'Storytelling',
    clipDuration: 8,
    wordsPerClip: '15-17 kata'
  };

  const bridging = {
    targetClipsCount: 3,
    angleTitle: 'The 2-Minute Overripe Fix',
    hookText: 'Stop throwing away brown avocados!',
    generate_recipe: true
  };

  const audio = {
    enableTts: true,
    voiceProvider: 'minimax',
    voicePersona: 'English_radiant_girl',
    targetLanguage: 'en-US'
  };

  const prompt = buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, {}, audio, 0);

  // 1. Verify Target Language declaration
  assert.ok(prompt.includes('Target Language: ENGLISH (US)'), 'Should declare Target Language: ENGLISH (US)');

  // 2. Verify Centralized Demographic Tone instruction in English
  assert.ok(prompt.includes('Target Audience: Gen-Z & Young Millennials'), 'Should inject English tone instruction');
  assert.ok(prompt.includes('conversational, authentic, snappy US English tone'), 'Should specify authentic US English tone');
  assert.ok(!prompt.includes("sapaan 'kamu' atau 'lo'"), 'Should NOT contain Indonesian slang in English prompt');

  // 3. Verify Recipe Mandate in English
  assert.ok(prompt.includes('RECIPE & NUTRITION PREPARATION MANDATE [ENGLISH - STRICT]'), 'Should inject English recipe mandate');
  assert.ok(prompt.includes('INGREDIENTS & EXACT MEASUREMENTS'), 'Should use English recipe headers');

  // 4. Verify YouTube Title mandate
  assert.ok(prompt.includes('YOUTUBE SHORTS HIGH-CTR TITLE MANDATE [STRICT]'), 'Should contain YouTube title mandate');
});

test('cleanYoutubeTitle cleans hanging words and ensures #Shorts tag in both ID and EN', () => {
  // Indonesian title with hanging word
  const rawId = 'Rahasia Racikan Dapur yang Bikin Tubuh Segar dan';
  const cleanedId = cleanYoutubeTitle(rawId);
  assert.ok(cleanedId.endsWith('#Shorts'));
  assert.ok(!cleanedId.includes('dan #Shorts'), 'Should strip trailing conjunction');

  // English title with quotes
  const rawEn = '"Craving Sweets at 10 PM? Try This Blood Sugar Safe Pudding"';
  const cleanedEn = cleanYoutubeTitle(rawEn);
  assert.ok(cleanedEn.endsWith('#Shorts'));
  assert.ok(!cleanedEn.startsWith('"'));
  assert.ok(!cleanedEn.includes('""'));
});
