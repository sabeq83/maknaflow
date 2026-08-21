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

console.log('  ✅ Generator & refinement mock tests passed.');
console.log('🎉 ALL AI Visual Identity Builder unit tests completed successfully!');
