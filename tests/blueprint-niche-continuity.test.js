import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBlueprintAnchorDNA } from '../lib/multiplier-angle-generator.js';
import {
  getRecipeMandateSection,
  YT_SHORTS_HIGH_CTR_TITLE_MANDATE,
  buildMultiplierPhase2Prompt
} from '../lib/prompts.js';

test('Multiplier Lab Niche Continuity: extractBlueprintAnchorDNA correctly identifies Health & Nutrition (#947017c1)', () => {
  const healthBlueprint = {
    id: '947017c1-431a-43b6-9e9d-0a45c50548bb',
    viral_pattern_summary: 'Video ASMR persiapan sarapan sehat chia seed pudding tinggi protein di toples kaca, memicu kepuasan visual dan hasrat meal prep diet sehat.',
    original_caption: 'Resep Chia Seed Chocolate Peanut Butter Pudding untuk diet sehat dan bebas lonjakan gula darah.'
  };

  const healthStoryboard = [
    {
      scene: 1,
      visual_description: 'Toples kaca diletakkan di atas meja, chia seed dituang diikuti dengan bubuk kakao murni.',
      narration_transcript: 'Buat yang suka ngidam manis malam-malam tapi lagi diet...'
    },
    {
      scene: 2,
      visual_description: 'Dua sendok selai kacang dimasukkan bersama susu almond dingin ke dalam toples.',
      narration_transcript: 'Tambahkan selai kacang alami dan susu almond...'
    },
    {
      scene: 3,
      visual_description: 'Madu murni dituangkan, toples ditutup rapat dan dikocok merata lalu dimasukkan ke chiller kulkas.',
      narration_transcript: 'Beri sedikit madu, kocok rata, simpan semalaman di kulkas...'
    }
  ];

  const anchor = extractBlueprintAnchorDNA(healthBlueprint, healthStoryboard);

  assert.equal(anchor.detectedNiche, 'health_nutrition');
  assert.match(anchor.nicheLabel, /Health & Fitness Nutrition/);
  assert.ok(anchor.extractedIngredients.includes('chia seed') || anchor.extractedIngredients.includes('chia'));
  assert.ok(anchor.extractedIngredients.includes('selai kacang') || anchor.extractedIngredients.includes('peanut butter'));
  assert.ok(anchor.extractedIngredients.includes('bubuk kakao') || anchor.extractedIngredients.includes('cocoa'));
  assert.ok(anchor.extractedIngredients.includes('susu almond') || anchor.extractedIngredients.includes('almond milk'));
  assert.ok(anchor.extractedIngredients.includes('madu'));
});

test('Multiplier Lab Niche Continuity: extractBlueprintAnchorDNA correctly identifies Healthy Dessert (#f467f5a1)', () => {
  const dessertBlueprint = {
    id: 'f467f5a1-1d5a-4da9-aa3f-ee24540d226f',
    viral_pattern_summary: 'Video menggunakan pola visual ASMR makanan sehat dan estetika resep cepat es krim alpukat lembut yang memicu nafsu makan penonton.',
    original_caption: 'Cara bikin es krim alpukat creamy tanpa gula pasir dan tanpa santan.'
  };

  const dessertStoryboard = [
    {
      scene: 1,
      visual_description: 'Potongan pisang beku dimasukkan ke dalam wadah blender, kemudian alpukat segar ditambahkan di atasnya.',
      narration_transcript: 'Punya pisang beku dan alpukat di rumah?'
    },
    {
      scene: 2,
      visual_description: 'Greek yogurt dituangkan di atas potongan alpukat dan pisang beku di dalam blender.',
      narration_transcript: 'Cukup tambahkan Greek yogurt kental...'
    },
    {
      scene: 3,
      visual_description: 'Penambahan madu murni, ekstrak vanila, dan perasan jeruk lemon sebelum diblender hingga tekstur lembut creamy seperti gelato.',
      narration_transcript: 'Beri sedikit madu dan perasan lemon, haluskan sampai creamy!'
    }
  ];

  const anchor = extractBlueprintAnchorDNA(dessertBlueprint, dessertStoryboard);

  assert.equal(anchor.detectedNiche, 'healthy_dessert');
  assert.match(anchor.nicheLabel, /Dessert Sehat & Olahan Buah/);
  assert.ok(anchor.extractedIngredients.includes('alpukat'));
  assert.ok(anchor.extractedIngredients.includes('pisang'));
  assert.ok(anchor.extractedIngredients.includes('greek yogurt') || anchor.extractedIngredients.includes('yogurt'));
  assert.ok(anchor.extractedIngredients.includes('lemon'));
  assert.ok(anchor.extractedIngredients.includes('madu'));
});

test('Multiplier Lab Niche Continuity: extractBlueprintAnchorDNA correctly identifies Herbal / Jamu', () => {
  const herbalBlueprint = {
    id: 'herbal-sample-uuid-1234',
    viral_pattern_summary: 'Seduhan rimpang tradisional untuk menghangatkan tubuh dan meredakan masuk angin.',
    original_caption: 'Resep jamu rebusan jahe merah, kunyit, dan serai.'
  };

  const herbalStoryboard = [
    {
      scene: 1,
      visual_description: 'Jahe merah dan kunyit diiris tipis di atas talenan kayu rustic.',
      narration_transcript: 'Badan meriang habis kehujanan?'
    },
    {
      scene: 2,
      visual_description: 'Rimpang dimasukkan ke dalam panci gerabah berisi air mendidih bersama batang serai geprek.',
      narration_transcript: 'Rebus rimpang sampai mendidih dan harum...'
    }
  ];

  const anchor = extractBlueprintAnchorDNA(herbalBlueprint, herbalStoryboard);

  assert.equal(anchor.detectedNiche, 'herbal_wellness');
  assert.match(anchor.nicheLabel, /Herbal, Rempah & Jamu/);
  assert.ok(anchor.extractedIngredients.includes('jahe'));
  assert.ok(anchor.extractedIngredients.includes('kunyit'));
  assert.ok(anchor.extractedIngredients.includes('serai'));
});

test('Multiplier Lab Niche Continuity: Recipe Mandate and Phase 2 Prompt contain strict multi-niche fidelity rules', () => {
  const mandate = getRecipeMandateSection(true);

  // Must not be restricted solely to rimpang
  assert.match(mandate, /chia seed/);
  assert.match(mandate, /alpukat/);
  assert.match(mandate, /100% berkorelasi langsung dengan bahan baku serta adegan visual/);

  // Title mandate must include formulas for Health and Dessert
  assert.match(YT_SHORTS_HIGH_CTR_TITLE_MANDATE, /\[Health\/Nutrition\]/);
  assert.match(YT_SHORTS_HIGH_CTR_TITLE_MANDATE, /\[Fitness\/Protein\]/);
  assert.match(YT_SHORTS_HIGH_CTR_TITLE_MANDATE, /\[Healthy Dessert\]/);

  // Phase 2 Prompt must contain Strict Niche & Recipe Continuity mandate
  const sampleStoryboard = [
    { scene: 1, visual_description: 'Chia seed dan susu almond dituangkan ke toples', narration_transcript: 'Sarapan toples 6 jam kenyang' }
  ];
  const phase2Prompt = buildMultiplierPhase2Prompt(
    sampleStoryboard,
    { product_name: 'Clean Eating Oats' },
    { clipDuration: 8 },
    { targetClipsCount: 1, generate_recipe: 1 },
    {},
    {}
  );

  assert.match(phase2Prompt, /Strict Niche & Recipe Continuity/);
  assert.match(phase2Prompt, /DILARANG KERAS mengubah subjek video/);
  assert.match(phase2Prompt, /100% SINKRON dengan bahan adegan visual di atas/);
});

test.after(() => {
  setTimeout(() => process.exit(0), 50);
});
