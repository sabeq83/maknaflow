import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';
import {
  DAPUR_BOTANI_CONFIG,
  NUTRIBAKE_CONFIG,
  SIASAT_SEHAT_CONFIG
} from '../scripts/seed-brand-visual-identities.mjs';

test('1. Validasi Dapur Botani Contract V2 & 3D Bio-Cellular Routing', () => {
  const norm = validateAndNormalizeVisualIdentity(DAPUR_BOTANI_CONFIG);
  assert.equal(norm.schema_version, '2');
  assert.equal(norm.label, 'Dapur Botani — Earthy Botanical Apothecary & 3D Bio-Cellular');
  assert.equal(norm.subject.kind, 'human');
  assert.equal(norm.subject.faceless_mode, 'hands_only');
  assert.ok(norm.environment.material_palette.includes('rough black slate stone'));
  assert.ok(norm.environment.props.includes('rustic granite pestle'));
  assert.equal(norm.lighting.color_temperature, 'warm');
  assert.equal(norm.camera.lens_look, 'macro_closeup');
  assert.equal(norm.guardrails.face_visibility, 'prohibited');
  assert.equal(norm.mode_routing.mechanism, 'symbolic_surrealism');
  assert.ok(norm.guardrails.required_negative_prompts.includes('human face'));
  assert.ok(norm.guardrails.required_negative_prompts.includes('syari dress'));
  assert.ok(norm.guardrails.required_negative_prompts.includes('white marble veining'));
});

test('2. Validasi Nutribake Contract V2 (Strict Anti-Marble & Modern Baking Guarantee)', () => {
  const norm = validateAndNormalizeVisualIdentity(NUTRIBAKE_CONFIG);
  assert.equal(norm.schema_version, '2');
  assert.equal(norm.label, 'Nutribake — Clean Modern Kitchen & Sensory Baking');
  assert.equal(norm.subject.kind, 'human');
  assert.equal(norm.subject.faceless_mode, 'hands_only');
  assert.ok(norm.environment.material_palette.includes('seamless flat matte warm-grey quartz countertop'));
  assert.ok(norm.environment.props.includes('copper pastry tools'));
  assert.equal(norm.lighting.color_temperature, 'neutral');
  assert.equal(norm.camera.lens_look, 'macro_closeup');
  assert.equal(norm.guardrails.face_visibility, 'prohibited');
  assert.ok(norm.guardrails.required_negative_prompts.includes('white marble veining'));
  assert.ok(norm.guardrails.required_negative_prompts.includes('syari dress'));
  assert.ok(norm.guardrails.required_negative_prompts.includes('rough black slate'));
});

test('3. Validasi Siasat Sehat Contract V2 (Clinical Biohacking & 3D High-Tech Anatomy)', () => {
  const norm = validateAndNormalizeVisualIdentity(SIASAT_SEHAT_CONFIG);
  assert.equal(norm.schema_version, '2');
  assert.equal(norm.label, 'Siasat Sehat — Clinical Biohacking & 3D High-Tech Anatomy');
  assert.equal(norm.subject.kind, 'human');
  assert.equal(norm.subject.faceless_mode, 'hands_only');
  assert.ok(norm.environment.material_palette.includes('matte charcoal micro-cement countertop'));
  assert.ok(norm.environment.props.includes('magnetic vortex mixer'));
  assert.equal(norm.lighting.color_temperature, 'cool');
  assert.equal(norm.camera.lens_look, 'macro_closeup');
  assert.equal(norm.guardrails.face_visibility, 'prohibited');
  assert.equal(norm.mode_routing.mechanism, 'symbolic_surrealism');
  assert.ok(norm.guardrails.required_negative_prompts.includes('caucasian male'));
  assert.ok(norm.guardrails.required_negative_prompts.includes('white marble'));
});

test('4. Cross-Brand Differentiation & Zero Surface Conflict Guarantee', () => {
  const botani = validateAndNormalizeVisualIdentity(DAPUR_BOTANI_CONFIG);
  const nutri = validateAndNormalizeVisualIdentity(NUTRIBAKE_CONFIG);
  const siasat = validateAndNormalizeVisualIdentity(SIASAT_SEHAT_CONFIG);

  // Surface materials must be completely distinct
  const botaniSurface = botani.environment.material_palette[0];
  const nutriSurface = nutri.environment.material_palette[0];
  const siasatSurface = siasat.environment.material_palette[0];

  assert.notEqual(botaniSurface, nutriSurface);
  assert.notEqual(botaniSurface, siasatSurface);
  assert.notEqual(nutriSurface, siasatSurface);

  // Lighting temperatures must be distinctly categorized (warm, neutral, cool)
  assert.equal(botani.lighting.color_temperature, 'warm');
  assert.equal(nutri.lighting.color_temperature, 'neutral');
  assert.equal(siasat.lighting.color_temperature, 'cool');

  // HabitFolk uses white marble, none of our 3 presets may use white marble in material palette
  for (const preset of [botani, nutri, siasat]) {
    for (const mat of preset.environment.material_palette) {
      assert.ok(!mat.toLowerCase().includes('white marble'), `Preset ${preset.label} contains white marble: ${mat}`);
    }
  }
});
