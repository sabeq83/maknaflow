import assert from 'node:assert/strict';
import {
  validateAiVisualIdentityBrief,
  validateAiVisualIdentityDraftEnvelope,
  buildVisualIdentityComplianceReport,
  normalizeAiVisualIdentityResult,
  AiVisualIdentityValidationError
} from '../lib/visual-identity-ai-contract.js';

import {
  buildAiVisualIdentityPrompt,
  buildAiVisualIdentityRefinePrompt,
  generateAiVisualIdentityDraft,
  refineAiVisualIdentityDraft
} from '../lib/visual-identity-ai-builder.js';

console.log('🔄 Running AI Visual Identity Builder unit tests...');

// 1. Creative Brief Schema Validation (Schema v2)
console.log('  1. Testing Creative Brief validation (Schema v2)...');

const validHumanBrief = {
  seed: 'Wa’y Siyasi — Membaca fakta, memahami akar masalah dan sistem sosial politik dalam kerangka Islam.',
  subject_kind: 'human',
  faceless_mode: 'featureless_editorial',
  population_mode: 'single_group_or_crowd',
  primary_style: 'editorial_graphic_novel',
  supporting_styles: ['isometric_society', 'symbolic_surrealism', 'paper_cutout_documentary'],
  mode_routing: {
    hook: 'symbolic_surrealism',
    mechanism: 'isometric_society'
  },
  aspect_ratio: '9:16',
  variation_level: 'balanced',
  mood: 'intelektual, kritis, berwibawa'
};

const brief1 = validateAiVisualIdentityBrief(validHumanBrief);
assert.equal(brief1.subject_kind, 'human');
assert.equal(brief1.faceless_mode, 'featureless_editorial');
assert.equal(brief1.population_mode, 'single_group_or_crowd');
assert.equal(brief1.primary_style, 'editorial_graphic_novel');
assert.deepEqual(brief1.supporting_styles, ['isometric_society', 'symbolic_surrealism', 'paper_cutout_documentary']);
assert.equal(brief1.mood, 'intelektual, kritis, berwibawa');

// Test invalid brief
assert.throws(() => {
  validateAiVisualIdentityBrief({ seed: 'hi', subject_kind: 'human' });
}, /seed must be between 3 and 3000/);

assert.throws(() => {
  validateAiVisualIdentityBrief({ seed: 'Political Education', subject_kind: 'human', faceless_mode: 'not_applicable' });
}, /faceless_mode cannot be not_applicable for human/);

console.log('  ✅ Creative Brief validation tests passed.');

// 2. Deterministic Compliance Report Tests
console.log('  2. Testing Compliance Report & Multi-Mode Routing Enforcement...');

const rawConfig = {
  subject: { kind: 'human', faceless_mode: 'featureless_editorial', population_mode: 'single_group_or_crowd' },
  visual_language: {
    primary_style: 'invalid_style_name',
    supporting_styles: ['isometric_society']
  },
  mode_routing: {
    hook: 'clay_political_theater' // Inactive style!
  },
  guardrails: { face_visibility: 'allowed' } // Try to weaken face visibility
};

const normalizedConfig = {
  subject: { kind: 'human', faceless_mode: 'featureless_editorial', population_mode: 'single_group_or_crowd' },
  visual_language: {
    primary_style: 'editorial_graphic_novel',
    supporting_styles: ['isometric_society']
  },
  mode_routing: {
    hook: 'editorial_graphic_novel' // Repaired to primary!
  },
  guardrails: { face_visibility: 'prohibited' } // Enforced!
};

const report = buildVisualIdentityComplianceReport(rawConfig, normalizedConfig);
assert.equal(report.status, 'compliant_with_corrections');
assert.ok(report.score < 100);

const hasFaceVisCheck = report.checks.find(c => c.key === 'face_visibility');
assert.equal(hasFaceVisCheck.status, 'corrected');

const hasRoutingCheck = report.checks.find(c => c.key === 'mode_routing');
assert.equal(hasRoutingCheck.status, 'corrected');

console.log('  ✅ Compliance report tests passed.');

// 3. Gemini Generator & Refiner with Single-Pass Mock Model
console.log('  3. Testing single-pass generator & refinement...');

const mockOutputEnvelope = {
  label: 'Wa’y Siyasi Editorial System',
  description: 'Faceless political education through multi-mode visual language',
  suggested_preset_key: 'way_siyasi_editorial_system',
  creative_rationale: 'Editorial graphic novel with isometric societal flows',
  config: {
    schema_version: '2',
    subject: {
      kind: 'human',
      faceless_mode: 'featureless_editorial',
      demographic_key: 'custom',
      custom_description: 'Contemporary Southeast Asian citizens, modest attire',
      character_count: 1,
      population_mode: 'single_group_or_crowd'
    },
    visual_language: {
      primary_style: 'editorial_graphic_novel',
      supporting_styles: ['isometric_society', 'symbolic_surrealism', 'paper_cutout_documentary'],
      disabled_styles: ['clay_political_theater', 'shadow_silhouette']
    },
    mode_routing: {
      hook: 'symbolic_surrealism',
      context: 'editorial_graphic_novel',
      mechanism: 'isometric_society',
      consequence: 'editorial_graphic_novel',
      evidence_reveal: 'paper_cutout_documentary',
      conclusion: 'symbolic_surrealism'
    },
    rendering: {
      geometry: 'simplified_semi_realistic',
      textures: ['printed_paper_grain', 'editorial_ink'],
      shadow_style: 'strong_geometric',
      finish: 'matte_editorial'
    },
    composition: {
      primary_idea_count: 1,
      primary_subject_count: 1,
      negative_space: 'required',
      safe_zone: 'vertical_social_ui'
    },
    metaphor_engine: {
      enabled: true,
      pattern: 'concept_to_object_to_action'
    },
    wardrobe: { mode: 'fixed', preset_key: 'sage_muted', sleeve_policy: 'wrists_covered', accessories: [] },
    environment: { preset_key: 'general_workspace', props: [], material_palette: [], background_density: 'minimal' },
    lighting: { preset_key: 'window_daylight', color_temperature: 'warm_neutral', contrast: 'medium' },
    camera: { framing: 'editorial_wide', perspective: 'third_person', lens_look: 'natural_50mm', depth_of_field: 'shallow', movement: 'subtle_handheld' },
    style: { preset_key: 'editorial_graphic_novel', aspect_ratio: '9:16' },
    guardrails: { face_visibility: 'prohibited', reflection_face: 'prohibited', unintended_people: 'prohibited', intentional_crowd: 'allowed_faceless', identity_drift: 'prohibited', wardrobe_drift: 'prohibited', required_negative_prompts: [] }
  }
};

// Fake Gemini Model factory that strictly counts calls
const makeFakeModel = (responseText) => {
  return async () => {
    let callCount = 0;
    return {
      generateContent: async (prompt) => {
        callCount++;
        if (callCount > 1) {
          throw new Error('Violation: AI Builder must be single-pass (exactly 1 model call per operation)!');
        }
        return {
          response: {
            text: () => responseText
          }
        };
      }
    };
  };
};

// Test generation (Single-Pass 1-call)
const fakeFactoryClean = makeFakeModel(JSON.stringify(mockOutputEnvelope));
const generateResult = await generateAiVisualIdentityDraft(validHumanBrief, { modelFactory: fakeFactoryClean });
assert.equal(generateResult.label, 'Wa’y Siyasi Editorial System');
assert.equal(generateResult.suggested_preset_key, 'way_siyasi_editorial_system');
assert.equal(generateResult.config.visual_language.primary_style, 'editorial_graphic_novel');
assert.equal(generateResult.config.mode_routing.mechanism, 'isometric_society');
assert.equal(generateResult.compliance.status, 'compliant');
assert.ok(generateResult.resolved_preview.style_prompt.includes('editorial political illustration'));

// Test Markdown wrapped JSON
const markdownText = `\`\`\`json
${JSON.stringify(mockOutputEnvelope)}
\`\`\``;
const fakeFactoryMarkdown = makeFakeModel(markdownText);
const generateResultMd = await generateAiVisualIdentityDraft(validHumanBrief, { modelFactory: fakeFactoryMarkdown });
assert.equal(generateResultMd.label, 'Wa’y Siyasi Editorial System');

// Test face violation rejection
const violationEnvelope = {
  ...mockOutputEnvelope,
  label: 'Face Policy Violation Test',
  description: 'Showing face clearly',
  config: {
    ...mockOutputEnvelope.config,
    subject: {
      ...mockOutputEnvelope.config.subject,
      custom_description: 'smiling beautiful face'
    }
  }
};
const fakeFactoryViolation = makeFakeModel(JSON.stringify(violationEnvelope));
await assert.rejects(async () => {
  await generateAiVisualIdentityDraft(validHumanBrief, { modelFactory: fakeFactoryViolation });
}, (err) => {
  return err.code === 'FACELESS_POLICY_VIOLATION';
});

// Test refinement preserves unchanged Schema v2 blocks
const refinedEnvelope = {
  ...mockOutputEnvelope,
  label: 'Wa’y Siyasi Refined Noir',
  config: {
    ...mockOutputEnvelope.config,
    visual_language: {
      ...mockOutputEnvelope.config.visual_language,
      primary_style: 'shadow_silhouette'
    }
  }
};
const fakeFactoryRefine = makeFakeModel(JSON.stringify(refinedEnvelope));
const refineResult = await refineAiVisualIdentityDraft({
  brief: validHumanBrief,
  current_draft: mockOutputEnvelope,
  instruction: 'Ubah gaya utama menjadi shadow silhouette'
}, { modelFactory: fakeFactoryRefine });

assert.equal(refineResult.label, 'Wa’y Siyasi Refined Noir');
assert.equal(refineResult.config.visual_language.primary_style, 'shadow_silhouette');
assert.ok(refineResult.config.mode_routing); // Preserved!

console.log('  ✅ Single-pass generator & refinement tests passed.');
console.log('🎉 All AI Visual Identity Builder tests passed successfully!');

try {
  const { closePgPool } = await import('../lib/db-pg.js');
  await closePgPool();
} catch (e) {
  // ignore if db not initialized
}
process.exit(0);
