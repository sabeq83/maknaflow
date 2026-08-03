import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isNewSecret, maskSecret } from '../lib/secret-values.js';
import { extractLegacyOutro, resolvePlannerInstructions, resolvePromptInstructions } from '../lib/prompt-instructions.js';
import { buildOrganicPillarPrompt, buildReverseEngineeringBridgePrompt, buildReverseEngineeringPrompt } from '../lib/prompts.js';

function occurrences(text, value) {
  return text.split(value).length - 1;
}

assert.equal(maskSecret('abcdef123456'), '••••••••123456');
assert.equal(isNewSecret('••••••••123456'), false);
assert.equal(isNewSecret('new-secret'), true);
assert.equal(isNewSecret(''), false);

assert.equal(extractLegacyOutro('akhiran skrip/voiceover : produk ori ada di keranjang ya!'), 'produk ori ada di keranjang ya!');
assert.deepEqual(resolvePromptInstructions({
  custom_instruction: 'akhiran skrip/voiceover : produk ori ada di keranjang ya!'
}), { aiDirective: '', mandatoryOutroLine: 'produk ori ada di keranjang ya!' });
assert.deepEqual(resolvePromptInstructions({
  ai_directive: 'Jangan mengarang produk.',
  custom_instruction: 'Gunakan bahasa sederhana.',
  mandatory_outro_line: 'Simpan resep ini.'
}), { aiDirective: 'Jangan mengarang produk.\nGunakan bahasa sederhana.', mandatoryOutroLine: 'Simpan resep ini.' });
assert.deepEqual(resolvePlannerInstructions({
  planner_focus: 'brand_editorial', brand_context: 'Konten edukasi brand.'
}), { aiDirective: 'Konten edukasi brand.', mandatoryOutroLine: '' });

const config = {
  ai_directive: 'Jangan mengarang produk.', mandatory_outro_line: 'Simpan resep ini.',
  target_clips_count: 4, target_language: 'id-ID', visual_mode: 'pure_t2v',
  narrative_mode: 'Storytelling', brand_profile: {}, product_data: {}
};
const rePrompt = buildReverseEngineeringPrompt([], config);
const bridgePrompt = buildReverseEngineeringBridgePrompt([], config);
const opcPrompt = buildOrganicPillarPrompt([], {
  ...config, content_pillar: 'Healthy Breakfast', custom_hook: 'Sarapan sehat tidak harus rumit.',
  visual_action_guideline: 'Dapur pagi', is_bridging_active: 0, sfx_setting: 'without_sfx'
}, null, {}, null);

for (const prompt of [rePrompt, bridgePrompt, opcPrompt]) {
  assert.equal(occurrences(prompt, '## AI DIRECTIVE / INTERNAL GUARDRAIL'), 1);
  assert.equal(occurrences(prompt, 'Jangan mengarang produk.'), 1);
  assert.match(prompt, /Simpan resep ini\./);
}

const dbSource = fs.readFileSync(new URL('../lib/db.js', import.meta.url), 'utf8');
assert.match(dbSource, /await db\.exec\(`\s*DELETE FROM system_audit_logs/);
const syncSource = fs.readFileSync(new URL('./sync-local-db-to-server.js', import.meta.url), 'utf8');
assert.doesNotMatch(syncSource, /pass:\s*['"][^'"]+['"]/);
assert.match(syncSource, /--allow-clean-restore/);
assert.match(syncSource, /--confirm-target=/);

console.log('Phase 1.2 security and instruction regression tests passed.');
