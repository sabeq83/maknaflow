import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReverseEngineeringPrompt,
  buildReverseEngineeringBridgePrompt,
  cleanYoutubeTitle,
  getRecipeMandateSection,
  YT_SHORTS_HIGH_CTR_TITLE_MANDATE
} from '../lib/prompts.js';

test('Recipe Mandate Section unit logic', () => {
  const activeMandate = getRecipeMandateSection(true);
  assert.match(activeMandate, /RECIPE & HERBAL CONCOCTION MANDATE/);
  assert.match(activeMandate, /minuman herbal, ramuan rempah, jamu tradisional/);
  assert.match(activeMandate, /IDENTIFIKASI BAHAN & TAKARAN/);
  assert.match(activeMandate, /PENYAJIAN DI CAPTION/);

  const inactiveMandate = getRecipeMandateSection(false);
  assert.equal(inactiveMandate, '');
});

test('buildReverseEngineeringPrompt includes recipe mandate when generate_recipe is 1 or true', () => {
  const kbTexts = [
    { name: 'MAKNA_Config_v54.9', content: 'Mock MAKNA config' },
    { name: 'REALIST_VIRAL_NARRATIVE', content: 'Mock narrative' },
    { name: 'STRATEGIC_FRAMEWORKS', content: 'Mock framework' },
    { name: 'PROMPT_SYSTEM', content: 'Mock prompt system' },
    { name: 'NARRATIVE_STRUCTURE', content: 'Mock structure' },
    { name: 'COMPLIANCE_GUIDE', content: 'Mock compliance' }
  ];

  // 1. With generate_recipe = 1
  const promptActive = buildReverseEngineeringPrompt(kbTexts, {
    aspect_ratio: '9:16',
    generate_recipe: 1
  });
  assert.match(promptActive, /RECIPE & HERBAL CONCOCTION MANDATE \[AKTIF\]/);
  assert.match(promptActive, /YOUTUBE SHORTS HIGH-CTR TITLE MANDATE \[STRICT\]/);
  assert.match(promptActive, /Teks resep\/racikan lengkap \(Bahan & Takaran, Langkah Pembuatan/);

  // 2. With generate_recipe = 0
  const promptInactive = buildReverseEngineeringPrompt(kbTexts, {
    aspect_ratio: '9:16',
    generate_recipe: 0
  });
  assert.doesNotMatch(promptInactive, /RECIPE & HERBAL CONCOCTION MANDATE \[AKTIF\]/);
  assert.match(promptInactive, /YOUTUBE SHORTS HIGH-CTR TITLE MANDATE \[STRICT\]/);
  assert.match(promptInactive, /Single Universal Caption/);
});

test('buildReverseEngineeringBridgePrompt includes recipe mandate when generate_recipe is true', () => {
  const kbTexts = [
    { name: 'REALIST_VIRAL_NARRATIVE', content: 'Mock narrative' },
    { name: 'STRATEGIC_FRAMEWORKS', content: 'Mock framework' },
    { name: 'PROMPT_SYSTEM', content: 'Mock prompt system' },
    { name: 'NARRATIVE_STRUCTURE', content: 'Mock structure' },
    { name: 'COMPLIANCE_GUIDE', content: 'Mock compliance' }
  ];

  const bridgeActive = buildReverseEngineeringBridgePrompt(kbTexts, {
    aspect_ratio: '9:16',
    generate_recipe: true,
    product_data: { product_name: 'Jahe Merah Instan' }
  });
  assert.match(bridgeActive, /RECIPE & HERBAL CONCOCTION MANDATE \[AKTIF\]/);
  assert.match(bridgeActive, /YOUTUBE SHORTS HIGH-CTR TITLE MANDATE \[STRICT\]/);
  assert.match(bridgeActive, /Teks resep\/racikan ringkas/);
  assert.match(bridgeActive, /Deskripsi lengkap memuat bahan takaran resep/);

  const bridgeInactive = buildReverseEngineeringBridgePrompt(kbTexts, {
    aspect_ratio: '9:16',
    generate_recipe: false,
    product_data: { product_name: 'Jahe Merah Instan' }
  });
  assert.doesNotMatch(bridgeInactive, /RECIPE & HERBAL CONCOCTION MANDATE \[AKTIF\]/);
  assert.match(bridgeInactive, /YOUTUBE SHORTS HIGH-CTR TITLE MANDATE \[STRICT\]/);
});

test('cleanYoutubeTitle sanitizes hanging words, guarantees #Shorts, and respects character limit', () => {
  // Case 1: Hanging comparison before #Shorts (The exact user bug)
  const buggy1 = "Bekerja di bawah atap tanpa insulasi sama seperti #Shorts";
  const cleaned1 = cleanYoutubeTitle(buggy1);
  assert.equal(cleaned1, "Bekerja di bawah atap tanpa insulasi #Shorts");

  // Case 2: Hanging conjunction at the end without tag
  const buggy2 = "Trik Alami Yang Bikin Badan Segar Ternyata";
  const cleaned2 = cleanYoutubeTitle(buggy2);
  assert.equal(cleaned2, "Trik Alami Yang Bikin Badan Segar #Shorts");

  // Case 3: Wrapping quotes and markdown bolding
  const quoted = '"**Kesalahan Fatal Seduh Madu! Enzim Alaminya Rusak**" #shorts';
  const cleaned3 = cleanYoutubeTitle(quoted);
  assert.equal(cleaned3, "Kesalahan Fatal Seduh Madu! Enzim Alaminya Rusak #Shorts");

  // Case 4: Overlength title (> 85 chars) safely truncated at word boundary
  const longTitle = "Bukan Obat Biasa! Ramuan Nenek Moyang Ini Sangat Luar Biasa Ampuh Hangatkan Badan dan Melancarkan Peredaran Darah Tubuh Kita Setiap Hari #Shorts";
  const cleaned4 = cleanYoutubeTitle(longTitle);
  assert.ok(cleaned4.length <= 85, `Length ${cleaned4.length} exceeds 85 chars`);
  assert.match(cleaned4, /#Shorts$/);
  assert.doesNotMatch(cleaned4, /\s+(dan|atau|sama seperti|yang|dengan)\s+#Shorts$/i);

  // Case 5: Empty title fallback
  const emptyCleaned = cleanYoutubeTitle("", "Rahasia Jamu Tradisional Warisan Leluhur");
  assert.equal(emptyCleaned, "Rahasia Jamu Tradisional Warisan Leluhur #Shorts");

  const totalEmpty = cleanYoutubeTitle(null, null);
  assert.equal(totalEmpty, "Rahasia Racikan Alami Yang Jarang Diketahui #Shorts");
});
