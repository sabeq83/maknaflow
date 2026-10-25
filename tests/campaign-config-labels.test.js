import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDemographicLabel,
  getVisualOverrideLabel,
  parseVisualOverrides,
  SUBJECT_LABELS,
  CHARACTER_LABELS,
  LIGHTING_LABELS
} from '../lib/campaign-config-labels.js';

test('campaign-config-labels exports required constant dictionaries', () => {
  assert.ok(SUBJECT_LABELS);
  assert.ok(CHARACTER_LABELS);
  assert.ok(LIGHTING_LABELS);
  assert.equal(SUBJECT_LABELS.syari_classic, "Wanita Gamis Syar'i");
  assert.equal(CHARACTER_LABELS.faceless, 'Faceless');
  assert.equal(LIGHTING_LABELS.window_daylight, 'Cahaya Alami dari Jendela');
});

test('getVisualOverrideLabel resolves mapped and custom labels safely', () => {
  assert.equal(getVisualOverrideLabel('character', 'faceless'), 'Faceless');
  assert.equal(getVisualOverrideLabel('character', 'pov'), 'POV');
  assert.equal(getVisualOverrideLabel('subject', 'syari_classic'), "Wanita Gamis Syar'i");
  assert.equal(getVisualOverrideLabel('lighting', 'warm_cozy'), 'Hangat dan Nyaman');

  // Fallbacks
  assert.equal(getVisualOverrideLabel('character', 'custom_character'), 'custom_character');
  assert.equal(getVisualOverrideLabel('subject', 'custom'), 'custom');
  assert.equal(getVisualOverrideLabel('non_existent_type', 'anything'), 'anything');
  assert.equal(getVisualOverrideLabel('character', null), 'Belum Ditentukan');
});

test('parseVisualOverrides parses JSON string or passes object safely', () => {
  assert.deepEqual(parseVisualOverrides(null), {});
  assert.deepEqual(parseVisualOverrides(''), {});
  assert.deepEqual(parseVisualOverrides({ custom: true }), { custom: true });
  assert.deepEqual(parseVisualOverrides('{"character_concept":"faceless"}'), { character_concept: 'faceless' });
  assert.deepEqual(parseVisualOverrides('invalid-json'), {});
});

test('getDemographicLabel delegates to centralized demographic hub', () => {
  assert.equal(getDemographicLabel('genz_casual', null, 'id-ID'), 'Gen-Z & Milenial Muda (Santai, Gaul, Akrab "Kamu/Lo")');
  assert.equal(getDemographicLabel('genz_casual', null, 'en-US'), 'Gen-Z & Young Millennials (Conversational, authentic, snappy "You")');
  assert.equal(getDemographicLabel('custom', 'Khusus Dokter Spesialis'), 'Khusus Dokter Spesialis');
});
