import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  getDemographicOptions, 
  getDemographicInstruction, 
  getDemographicLabel 
} from '../lib/demographic-constants.js';

test('getDemographicOptions returns Indonesian list by default or when specified', () => {
  const optionsId = getDemographicOptions('id-ID');
  assert.ok(Array.isArray(optionsId));
  assert.ok(optionsId.length >= 6);
  assert.equal(optionsId[0].id, 'genz_casual');
  assert.ok(optionsId[0].label.includes('Gen-Z'));
  assert.ok(optionsId[0].label.includes('Kamu/Lo'));
});

test('getDemographicOptions returns English list when en-US is specified', () => {
  const optionsEn = getDemographicOptions('en-US');
  assert.ok(Array.isArray(optionsEn));
  assert.ok(optionsEn.length >= 6);
  assert.equal(optionsEn[0].id, 'genz_casual');
  assert.ok(optionsEn[0].label.includes('Young Millennials'));
  assert.ok(optionsEn[0].label.includes('Conversational'));
});

test('getDemographicInstruction generates correct bilingual AI prompt directives', () => {
  // Indonesian test
  const instrId = getDemographicInstruction('genz_casual', '', 'id-ID');
  assert.ok(instrId.includes("Target Audiens: Gen-Z"));
  assert.ok(instrId.includes("kamu"));

  // English test
  const instrEn = getDemographicInstruction('genz_casual', '', 'en-US');
  assert.ok(instrEn.includes("Target Audience: Gen-Z & Young Millennials"));
  assert.ok(instrEn.includes("conversational, authentic, snappy"));

  // Custom Indonesian
  const customId = getDemographicInstruction('custom', 'Mahasiswa Kos Hemat', 'id-ID');
  assert.ok(customId.includes("Mahasiswa Kos Hemat"));
  assert.ok(customId.includes("Target Audiens Spesifik"));

  // Custom English
  const customEn = getDemographicInstruction('custom', 'College runners on a budget', 'en-US');
  assert.ok(customEn.includes("College runners on a budget"));
  assert.ok(customEn.includes("Target Audience: Specific Custom Audience"));
});

test('getDemographicLabel returns appropriate human-readable labels', () => {
  assert.equal(getDemographicLabel('custom', 'Khusus Atlet', 'id-ID'), 'Khusus Atlet');
  const labelId = getDemographicLabel('genz_casual', '', 'id-ID');
  assert.ok(labelId.includes('Kamu/Lo'));

  const labelEn = getDemographicLabel('genz_casual', '', 'en-US');
  assert.ok(labelEn.includes('Young Millennials'));
});
