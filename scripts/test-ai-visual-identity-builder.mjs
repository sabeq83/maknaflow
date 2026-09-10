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

// 1. Creative Brief Schema Validation
console.log('  1. Testing Creative Brief validation...');

// Valid briefs
const validHumanBrief = {
  seed: 'Skincare Muslimah minimalis di studio dapur Skandinavia',
  subject_kind: 'human',
  faceless_mode: 'hands_only',
  aspect_ratio: '9:16',
  variation_level: 'balanced',
  mood: 'calm'
};
const brief1 = validateAiVisualIdentityBrief(validHumanBrief);
assert.equal(brief1.subject_kind, 'human');
assert.equal(brief1.faceless_mode, 'hands_only');
assert.equal(brief1.mood, 'calm');

const validMascotBrief = {
  seed: 'Kucing lucu mascot botol herbal',
  subject_kind: 'mascot_object',
  aspect_ratio: '1:1',
  variation_level: 'conservative'
};
const brief2 = validateAiVisualIdentityBrief(validMascotBrief);
assert.equal(brief2.subject_kind, 'mascot_object');
assert.equal(brief2.faceless_mode, 'not_applicable');

// Invalid briefs
assert.throws(() => {
  validateAiVisualIdentityBrief({ seed: 'hi', subject_kind: 'human' });
}, /seed must be between 3 and 3000/);

assert.throws(() => {
  validateAiVisualIdentityBrief({ seed: 'Skincare', subject_kind: 'alien' });
}, /Invalid subject_kind/);

assert.throws(() => {
  validateAiVisualIdentityBrief({ seed: 'Skincare', subject_kind: 'human', faceless_mode: 'not_applicable' });
}, /faceless_mode cannot be not_applicable for human/);

console.log('  ✅ Creative Brief validation tests passed.');

// 2. Deterministic Compliance Report Tests
console.log('  2. Testing Compliance Report & Face Enforcement...');

const rawConfig = {
  subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic' },
  camera: { framing: 'crop_below_neck' }, // Mismatch framing with hands_only
  guardrails: { face_visibility: 'allowed' } // Try to weaken face visibility
};

const normalizedConfig = {
  subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic' },
  camera: { framing: 'forearms_and_hands' }, // Corrected!
  guardrails: { face_visibility: 'prohibited' } // Enforced!
};

const report = buildVisualIdentityComplianceReport(rawConfig, normalizedConfig);
assert.equal(report.status, 'compliant_with_corrections');
assert.ok(report.score < 100);

const hasFaceVisCheck = report.checks.find(c => c.key === 'face_visibility');
assert.equal(hasFaceVisCheck.status, 'corrected');

const hasFramingCheck = report.checks.find(c => c.key === 'camera_framing');
assert.equal(hasFramingCheck.status, 'corrected');

console.log('  ✅ Compliance report tests passed.');

// 3. Gemini Parser & Builder with Fake Gemini Model
console.log('  3. Testing generator & refinement with fake Gemini factory...');

const mockOutputEnvelope = {
  label: 'Sage Morning Skincare',
  description: 'Aesthetic skincare with sage mood',
  suggested_preset_key: 'sage_morning_skincare',
  creative_rationale: 'Calming color palette',
  config: {
    schema_version: '1',
    subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic', custom_description: '' },
    wardrobe: { mode: 'fixed', preset_key: 'sage_muted', sleeve_policy: 'wrists_covered', accessories: [] },
    environment: { preset_key: 'nordic_kitchen', props: [], material_palette: [], background_density: 'balanced' },
    lighting: { preset_key: 'window_daylight', color_temperature: 'warm_neutral', contrast: 'soft' },
    camera: { framing: 'forearms_and_hands', perspective: 'third_person', lens_look: 'natural_50mm', depth_of_field: 'shallow', movement: 'subtle_handheld' },
    style: { preset_key: 'cinematic_realistic', aspect_ratio: '9:16' },
    guardrails: { face_visibility: 'prohibited', reflection_face: 'prohibited', extra_people: 'prohibited', identity_drift: 'prohibited', wardrobe_drift: 'prohibited', required_negative_prompts: [] }
  }
};

// Fake Gemini Model factory
const makeFakeModel = (responseText) => {
  return async () => {
    let callCount = 0;
    return {
      generateContent: async (prompt) => {
        callCount++;
        if (callCount > 1) {
          throw new Error('Limit exceeded: More than one model call was made!');
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

// Test happy path with clean JSON
const fakeFactoryClean = makeFakeModel(JSON.stringify(mockOutputEnvelope));
const generateResult = await generateAiVisualIdentityDraft(validHumanBrief, { modelFactory: fakeFactoryClean });
assert.equal(generateResult.label, 'Sage Morning Skincare');
assert.equal(generateResult.suggested_preset_key, 'sage_morning_skincare');
assert.equal(generateResult.compliance.status, 'compliant');

// Test markdown wrapped JSON still parsed
const markdownText = `\`\`\`json
${JSON.stringify(mockOutputEnvelope)}
\`\`\``;
const fakeFactoryMarkdown = makeFakeModel(markdownText);
const generateResultMd = await generateAiVisualIdentityDraft(validHumanBrief, { modelFactory: fakeFactoryMarkdown });
assert.equal(generateResultMd.label, 'Sage Morning Skincare');

// Test incomplete envelope structure (rejected)
const incompleteEnvelope = {
  label: 'Missing Config'
};
const fakeFactoryIncomplete = makeFakeModel(JSON.stringify(incompleteEnvelope));
await assert.rejects(async () => {
  await generateAiVisualIdentityDraft(validHumanBrief, { modelFactory: fakeFactoryIncomplete });
}, /config block is required/);

// Test face violation envelope (rejection)
const violationEnvelope = {
  ...mockOutputEnvelope,
  label: 'Beautiful Face Skincare',
  description: 'Show face details',
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

// Test refinement returning full draft
const refinedEnvelope = {
  ...mockOutputEnvelope,
  label: 'Sage Morning Skincare Refined',
  config: {
    ...mockOutputEnvelope.config,
    lighting: {
      ...mockOutputEnvelope.config.lighting,
      preset_key: 'golden_hour'
    }
  }
};
const fakeFactoryRefine = makeFakeModel(JSON.stringify(refinedEnvelope));
const refineResult = await refineAiVisualIdentityDraft({
  brief: validHumanBrief,
  current_draft: mockOutputEnvelope,
  instruction: 'Change lighting preset to golden hour'
}, { modelFactory: fakeFactoryRefine });

assert.equal(refineResult.label, 'Sage Morning Skincare Refined');
assert.equal(refineResult.config.lighting.preset_key, 'golden_hour');

// Test Indonesian Male generation & resolution without Muslimah/Kitchen leakage
const indonesianMaleBrief = {
  seed: 'pria indonesia hanya nampak tangan, mulai siku hingga tangan, warna kulit kuning langsat, memakai jam tangan premium.',
  subject_kind: 'human',
  faceless_mode: 'hands_only',
  aspect_ratio: '9:16',
  variation_level: 'balanced'
};

const indonesianMaleEnvelope = {
  label: 'Indonesian Male Premium Watch',
  description: 'Clean Indonesian male hands with luxury watch',
  suggested_preset_key: 'indonesian_male_premium_watch',
  creative_rationale: 'Southeast Asian male demographic with warm skin tones and watchmaker workspace',
  config: {
    schema_version: '1',
    subject: {
      kind: 'human',
      faceless_mode: 'hands_only',
      demographic_key: 'southeast_asian_male',
      custom_description: 'featuring warm light-tan smooth skin, wearing a luxury silver chronograph wristwatch',
      character_count: 1
    },
    wardrobe: {
      mode: 'fixed',
      preset_key: 'male_caramel',
      custom_description: '',
      primary_color: 'Caramel',
      secondary_color: '',
      material: 'cotton',
      sleeve_policy: 'forearms_exposed',
      accessories: ['luxury silver wristwatch']
    },
    environment: {
      preset_key: 'general_workspace',
      custom_description: 'minimalist dark wood desk with precision tools',
      material_palette: ['dark wood', 'leather'],
      props: ['watchmaker tools'],
      background_density: 'minimal'
    },
    lighting: {
      preset_key: 'window_daylight',
      custom_description: '',
      color_temperature: 'warm_neutral',
      contrast: 'soft'
    },
    camera: {
      framing: 'forearms_and_hands',
      perspective: 'third_person',
      lens_look: 'natural_50mm',
      depth_of_field: 'shallow',
      movement: 'subtle_handheld'
    },
    style: {
      preset_key: 'cinematic_realistic',
      custom_description: '',
      aspect_ratio: '9:16'
    },
    guardrails: {
      face_visibility: 'prohibited',
      reflection_face: 'prohibited',
      extra_people: 'prohibited',
      identity_drift: 'prohibited',
      wardrobe_drift: 'prohibited',
      required_negative_prompts: []
    }
  }
};

const fakeFactoryIndoMale = makeFakeModel(JSON.stringify(indonesianMaleEnvelope));
const indoMaleResult = await generateAiVisualIdentityDraft(indonesianMaleBrief, { modelFactory: fakeFactoryIndoMale });
assert.equal(indoMaleResult.label, 'Indonesian Male Premium Watch');
assert.ok(indoMaleResult.resolved_preview.subject_prompt.includes('Southeast Asian man'));
assert.ok(!indoMaleResult.resolved_preview.subject_prompt.includes('Muslimah'));
assert.ok(!indoMaleResult.resolved_preview.environment_prompt.includes('Nordic'));

// Test 100% Custom Freeform Demographic & Environment Synthesis
const customEnvelope = {
  label: 'Urban Coffee Barista',
  description: 'Specialty coffee barista hands pouring latte art',
  suggested_preset_key: 'urban_coffee_barista',
  creative_rationale: 'Rustic vintage coffee shop vibe',
  config: {
    schema_version: '1',
    subject: {
      kind: 'human',
      faceless_mode: 'hands_only',
      demographic_key: 'custom',
      custom_description: 'a young artisan barista with tanned hands and neat rolled-up leather apron cuffs',
      character_count: 1
    },
    wardrobe: {
      mode: 'custom',
      preset_key: 'custom',
      custom_description: 'wearing a dark indigo denim shirt and rugged brown leather apron',
      sleeve_policy: 'forearms_exposed',
      accessories: ['barista ring']
    },
    environment: {
      preset_key: 'custom',
      custom_description: 'inside a cozy vintage brick espresso bar with warm rustic wooden countertops',
      material_palette: ['brick', 'reclaimed wood'],
      props: ['espresso machine', 'ceramic cups'],
      background_density: 'balanced'
    },
    lighting: {
      preset_key: 'golden_hour',
      custom_description: 'warm Edison bulb glow mixed with afternoon golden light',
      color_temperature: 'warm',
      contrast: 'medium'
    },
    camera: {
      framing: 'hands_closeup',
      perspective: 'first_person',
      lens_look: 'macro_closeup',
      depth_of_field: 'shallow',
      movement: 'still'
    },
    style: {
      preset_key: 'cinematic_realistic',
      custom_description: '',
      aspect_ratio: '9:16'
    },
    guardrails: {
      face_visibility: 'prohibited',
      reflection_face: 'prohibited',
      extra_people: 'prohibited',
      identity_drift: 'prohibited',
      wardrobe_drift: 'prohibited',
      required_negative_prompts: []
    }
  }
};

const fakeFactoryCustom = makeFakeModel(JSON.stringify(customEnvelope));
const customResult = await generateAiVisualIdentityDraft({ seed: 'Barista kopi di kafe vintage', subject_kind: 'human', faceless_mode: 'hands_only' }, { modelFactory: fakeFactoryCustom });
assert.ok(customResult.resolved_preview.subject_prompt.includes('artisan barista with tanned hands'));
assert.ok(customResult.resolved_preview.subject_prompt.includes('strictly faceless framing'));
assert.ok(!customResult.resolved_preview.subject_prompt.includes('Muslimah'));
assert.ok(customResult.resolved_preview.wardrobe_prompt.includes('dark indigo denim shirt'));
// Test Non-Human Animal Mascot (Cat Barista) resolution
const catBaristaEnvelope = {
  label: '3D Claymation British Shorthair Cat Barista',
  description: 'Adorable cat barista pouring latte art',
  suggested_preset_key: 'cat_barista_3d',
  creative_rationale: 'Cute non-human mascot for cafe campaigns',
  config: {
    schema_version: '1',
    subject: {
      kind: 'animal',
      faceless_mode: 'not_applicable',
      demographic_key: 'custom',
      custom_description: 'An adorable 3D claymation British Shorthair cat with soft textured grey fur and round expressive eyes',
      character_count: 1
    },
    wardrobe: {
      mode: 'custom',
      preset_key: 'custom',
      custom_description: 'Miniature rich brown leather barista apron tied neatly around the waist, paired with a tiny white chef hat resting atop the head',
      primary_color: 'Leather Brown (#8B4513)',
      secondary_color: 'Pure White (#FFFFFF)',
      material: 'leather',
      sleeve_policy: 'not_applicable',
      accessories: ['tiny white chef hat']
    },
    environment: {
      preset_key: 'custom',
      custom_description: 'inside a cozy vintage wood-paneled coffee shop with warm ambient lighting',
      material_palette: ['wood', 'brass'],
      props: ['espresso machine', 'mini ceramic cup'],
      background_density: 'balanced'
    },
    lighting: {
      preset_key: 'golden_hour',
      custom_description: 'warm cozy golden light',
      color_temperature: 'warm',
      contrast: 'soft'
    },
    camera: {
      framing: 'object_or_animal',
      perspective: 'third_person',
      lens_look: 'natural_50mm',
      depth_of_field: 'shallow',
      movement: 'still'
    },
    style: {
      preset_key: '3d_claymation_cozy',
      custom_description: '',
      aspect_ratio: '9:16'
    },
    guardrails: {
      face_visibility: 'prohibited',
      reflection_face: 'prohibited',
      extra_people: 'prohibited',
      identity_drift: 'prohibited',
      wardrobe_drift: 'prohibited',
      required_negative_prompts: []
    }
  }
};

const fakeFactoryCat = makeFakeModel(JSON.stringify(catBaristaEnvelope));
const catResult = await generateAiVisualIdentityDraft({ seed: 'Seekor kucing barista 3D claymation', subject_kind: 'animal', faceless_mode: 'not_applicable' }, { modelFactory: fakeFactoryCat });
assert.notEqual(catResult.resolved_preview.subject_prompt, 'custom');
assert.ok(catResult.resolved_preview.subject_prompt.includes('British Shorthair cat'));
assert.ok(catResult.resolved_preview.wardrobe_prompt.includes('barista apron'));
assert.ok(catResult.resolved_preview.environment_prompt.includes('wood-paneled coffee shop'));

console.log('  ✅ Generator & refinement mock tests passed.');
console.log('  ✅ Southeast Asian Male, Freeform Custom, and Non-Human Animal tests passed without leakage.');
console.log('🎉 ALL AI Visual Identity Builder unit tests completed successfully!');
process.exit(0);
