import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMultiplierPhase2Prompt } from '../lib/prompts.js';
import { resolveVisualOverrides } from '../lib/visual-override-resolver.js';

test('Multiplier Lab - Sequential Wardrobe Logic', async (t) => {
  await t.test('buildMultiplierPhase2Prompt resolves sequential wardrobe correctly per row', () => {
    const mockStoryboard = [
      { clip_number: 1, visual_prompt: 'Intro clip', voiceover_script: 'Halo semua' },
      { clip_number: 2, visual_prompt: 'Action clip', voiceover_script: 'Mari coba produk ini' }
    ];
    const mockProductDna = {
      product_name: 'Serum Glowing',
      product_description: 'Serum pencerah kulit',
      unique_selling_point: 'Cepat meresap'
    };
    const mockAesthetics = {
      isVsoActive: true,
      characterConcept: 'faceless',
      subjectDemographic: 'syari_classic',
      wardrobeStyle: 'sequential',
      lightingStyle: 'window_daylight'
    };
    const mockBridging = {
      isBridgingActive: false
    };

    // Test Row 0
    const promptRow0 = buildMultiplierPhase2Prompt(
      mockStoryboard,
      mockProductDna,
      mockAesthetics,
      mockBridging,
      mockAesthetics,
      {},
      0
    );

    // Test Row 1
    const promptRow1 = buildMultiplierPhase2Prompt(
      mockStoryboard,
      mockProductDna,
      mockAesthetics,
      mockBridging,
      mockAesthetics,
      {},
      1
    );

    // Test Row 2
    const promptRow2 = buildMultiplierPhase2Prompt(
      mockStoryboard,
      mockProductDna,
      mockAesthetics,
      mockBridging,
      mockAesthetics,
      {},
      2
    );

    // Assert: Literal "sequential" should NOT be leaked as the wardrobe description
    assert.doesNotMatch(promptRow0, /- Wardrobe \/ Pakaian: sequential\b/i);
    assert.doesNotMatch(promptRow1, /- Wardrobe \/ Pakaian: sequential\b/i);
    assert.doesNotMatch(promptRow2, /- Wardrobe \/ Pakaian: sequential\b/i);

    // Assert: Row 0 is amber_terracotta, Row 1 is mocca_caramel, Row 2 is warm_grey
    assert.match(promptRow0, /terracotta|amber/i);
    assert.match(promptRow1, /mocca|caramel/i);
    assert.match(promptRow2, /warm grey|grey/i);

    // Assert: Each row receives a distinct wardrobe description
    assert.notEqual(promptRow0, promptRow1);
    assert.notEqual(promptRow1, promptRow2);
  });

  await t.test('resolveVisualOverrides resolves sequential wardrobe per itemIndex', () => {
    const rawOverrides = {
      character_concept: 'faceless',
      subject_demographic: 'syari_classic',
      wardrobe_style: 'sequential',
      lighting_style: 'window_daylight'
    };

    const res0 = resolveVisualOverrides({
      visualOverrides: rawOverrides,
      itemIndex: 0,
      stableSeed: 'batch_test:task_0'
    });

    const res1 = resolveVisualOverrides({
      visualOverrides: rawOverrides,
      itemIndex: 1,
      stableSeed: 'batch_test:task_1'
    });

    assert.equal(res0.wardrobe_style, 'custom');
    assert.equal(res1.wardrobe_style, 'custom');
    assert.ok(res0.wardrobe_style_custom);
    assert.ok(res1.wardrobe_style_custom);
    assert.notEqual(res0.wardrobe_style_custom, res1.wardrobe_style_custom);

    // Test prompt with resolved custom overrides from worker
    const vsoResolved0 = {
      isVsoActive: true,
      ...res0
    };
    const promptWithCustom0 = buildMultiplierPhase2Prompt(
      [{ clip_number: 1, visual_prompt: 'Test', voiceover_script: 'Test' }],
      { product_name: 'Test' },
      vsoResolved0,
      { isBridgingActive: false },
      vsoResolved0,
      {},
      0
    );
    assert.match(promptWithCustom0, new RegExp(res0.wardrobe_style_custom.slice(0, 20), 'i'));
  });
});
